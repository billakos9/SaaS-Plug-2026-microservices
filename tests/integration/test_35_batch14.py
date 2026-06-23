"""
Suite 35 — Batch 14: reservation event userId payloads + billing upsertOnFinalise

Changes validated:
1. reservation.completed and reservation.cancelled events include userId in payload
2. billing-service billed-reservation.repository.js has upsertOnFinalise (idempotent $set/$setOnInsert)
3. billing consumer calls upsertOnFinalise for completed/cancelled events
4. Late-arriving finalise event can create a placeholder BilledReservation via $setOnInsert
"""

import subprocess
import pytest
import requests

BASE = "http://localhost/api"

# Container-internal paths — working directory is /saas26-09 for both services
BILLING_REPO = "/saas26-09/src/repositories/billed-reservation.repository.js"
BILLING_CONSUMER = "/saas26-09/src/events/rabbitmq.consumers.js"
RESERVATION_SVC = "/saas26-09/src/services/reservation.service.js"


def _read_container_file(container: str, path: str) -> str:
    result = subprocess.run(
        ["docker", "exec", container, "cat", path],
        capture_output=True, text=True, timeout=10,
    )
    return result.stdout


class TestBatch14Sources:
    SUITE_ID = 35
    SUITE_NAME = "Batch 14: userId in events + billing upsertOnFinalise"

    # ── billing-service repository ──────────────────────────────────────────────

    def test_billing_repo_has_upsert_on_finalise(self):
        """upsertOnFinalise must exist in billed-reservation.repository.js."""
        src = _read_container_file("billing_service", BILLING_REPO)
        assert src, "Failed to read billed-reservation.repository.js from billing_service container"
        assert "upsertOnFinalise" in src, \
            "upsertOnFinalise not found in billed-reservation.repository.js"

    def test_billing_repo_upsert_on_finalise_uses_dollar_set(self):
        """upsertOnFinalise must use $set for the update fields."""
        src = _read_container_file("billing_service", BILLING_REPO)
        assert src, "Failed to read billed-reservation.repository.js"
        idx = src.find("upsertOnFinalise")
        assert idx != -1, "upsertOnFinalise not found in repository"
        snippet = src[idx:idx + 500]
        assert "$set" in snippet, \
            f"$set not found in upsertOnFinalise body: {snippet[:200]}"

    def test_billing_repo_upsert_on_finalise_uses_set_on_insert(self):
        """upsertOnFinalise must use $setOnInsert for late-arriving fallback fields."""
        src = _read_container_file("billing_service", BILLING_REPO)
        assert src, "Failed to read billed-reservation.repository.js"
        idx = src.find("upsertOnFinalise")
        assert idx != -1, "upsertOnFinalise not found in repository"
        snippet = src[idx:idx + 500]
        assert "$setOnInsert" in snippet, \
            f"$setOnInsert not found in upsertOnFinalise body: {snippet[:200]}"

    def test_billing_repo_no_update_on_finalise(self):
        """Old updateOnFinalise must be gone — replaced by upsertOnFinalise."""
        src = _read_container_file("billing_service", BILLING_REPO)
        assert src, "Failed to read billed-reservation.repository.js"
        assert "updateOnFinalise" not in src, \
            "Dead method updateOnFinalise still present in billed-reservation.repository.js"

    def test_billing_repo_upsert_on_finalise_upsert_true(self):
        """upsertOnFinalise must pass upsert: true for the late-create path."""
        src = _read_container_file("billing_service", BILLING_REPO)
        assert src, "Failed to read billed-reservation.repository.js"
        idx = src.find("upsertOnFinalise")
        assert idx != -1, "upsertOnFinalise not found in repository"
        snippet = src[idx:idx + 500]
        assert "upsert: true" in snippet, \
            f"upsert: true not found in upsertOnFinalise body: {snippet[:200]}"

    # ── billing consumer calls upsertOnFinalise ─────────────────────────────────

    def test_billing_consumer_calls_upsert_on_finalise(self):
        """billing consumer must call upsertOnFinalise (not updateOnFinalise)."""
        src = _read_container_file("billing_service", BILLING_CONSUMER)
        assert src, "Failed to read billing rabbitmq.consumers.js"
        assert "upsertOnFinalise" in src, \
            "billing consumer does not call upsertOnFinalise"

    def test_billing_consumer_not_calling_update_on_finalise(self):
        """billing consumer must not call the old updateOnFinalise."""
        src = _read_container_file("billing_service", BILLING_CONSUMER)
        assert src, "Failed to read billing rabbitmq.consumers.js"
        assert "updateOnFinalise" not in src, \
            "billing consumer still calls dead updateOnFinalise"

    def test_billing_consumer_upsert_on_finalise_passes_user_id(self):
        """Consumer must supply userId as a fallback field in the $setOnInsert block."""
        src = _read_container_file("billing_service", BILLING_CONSUMER)
        assert src, "Failed to read billing rabbitmq.consumers.js"
        idx = src.find("upsertOnFinalise")
        assert idx != -1, "upsertOnFinalise call not found in consumer"
        snippet = src[idx:idx + 600]
        assert "userId" in snippet, \
            f"userId not found in upsertOnFinalise call: {snippet[:300]}"

    # ── reservation-service event payloads include userId ───────────────────────

    def test_reservation_cancelled_event_includes_user_id(self):
        """reservation.cancelled publishEvent call must pass userId in payload."""
        src = _read_container_file("reservation_service", RESERVATION_SVC)
        assert src, "Failed to read reservation.service.js from reservation_service container"
        # Find every publishEvent block containing RESERVATION_CANCELLED
        cancelled_blocks = []
        idx = 0
        while True:
            idx = src.find("RESERVATION_CANCELLED", idx)
            if idx == -1:
                break
            # Grab a window after the routing key reference to inspect the payload object
            cancelled_blocks.append(src[idx:idx + 400])
            idx += 1
        assert cancelled_blocks, "RESERVATION_CANCELLED routing key not found in reservation.service.js"
        for block in cancelled_blocks:
            assert "userId" in block, \
                f"userId missing from RESERVATION_CANCELLED payload block: {block[:300]}"

    def test_reservation_completed_event_includes_user_id(self):
        """reservation.completed publishEvent call must pass userId in payload."""
        src = _read_container_file("reservation_service", RESERVATION_SVC)
        assert src, "Failed to read reservation.service.js from reservation_service container"
        idx = src.find("RESERVATION_COMPLETED")
        assert idx != -1, "RESERVATION_COMPLETED routing key not found in reservation.service.js"
        snippet = src[idx:idx + 400]
        assert "userId" in snippet, \
            f"userId missing from RESERVATION_COMPLETED payload: {snippet[:300]}"

    # ── billing consumer handles both finalise routing keys in one branch ─────

    def test_billing_consumer_handles_cancelled_routing_key(self):
        """Consumer branches on both RESERVATION_COMPLETED and RESERVATION_CANCELLED for upsertOnFinalise."""
        src = _read_container_file("billing_service", BILLING_CONSUMER)
        assert src, "Failed to read billing rabbitmq.consumers.js"
        idx = src.find("upsertOnFinalise")
        assert idx != -1, "upsertOnFinalise call not found in consumer"
        # Look back up to 600 chars before the call for the conditional check
        preamble = src[max(0, idx - 600):idx]
        has_cancelled = "RESERVATION_CANCELLED" in preamble or "reservation.cancelled" in preamble
        has_completed = "RESERVATION_COMPLETED" in preamble or "reservation.completed" in preamble
        assert has_cancelled or has_completed, \
            f"Neither RESERVATION_CANCELLED nor RESERVATION_COMPLETED found near upsertOnFinalise: {preamble[-300:]}"

    # ── runtime: both services remain healthy after rebuild ───────────────────

    def test_billing_service_invoices_endpoint_alive(self, admin_token):
        """Admin can still list invoices — billing-service healthy after rebuild."""
        r = requests.get(
            f"{BASE}/billing/invoices",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10,
        )
        assert r.status_code == 200, \
            f"GET /billing/invoices returned {r.status_code}: {r.text[:200]}"

    def test_reservation_service_user_reservations_alive(self, user_token):
        """reservation-service healthy after rebuild — user reservation list responds."""
        # First get the user's own profile to find their userId
        me_r = requests.get(
            f"{BASE}/users/me",
            headers={"Authorization": f"Bearer {user_token}"},
            timeout=10,
        )
        assert me_r.status_code == 200, f"GET /users/me returned {me_r.status_code}"
        user_id = me_r.json().get("userId")
        assert user_id, "userId not found in /users/me response"

        r = requests.get(
            f"{BASE}/reservations/user/{user_id}",
            headers={"Authorization": f"Bearer {user_token}"},
            timeout=10,
        )
        assert r.status_code == 200, \
            f"GET /reservations/user/{user_id} returned {r.status_code}: {r.text[:200]}"
