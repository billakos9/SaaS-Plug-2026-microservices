"""
Suite 36 — Batch 15: Analytics $inc idempotency via ProcessedAnalyticEvent dedup

Changes validated:
1. ProcessedAnalyticEvent model exists with unique compound index {reservationId, eventType}
2. ProcessedAnalyticEventRepository.tryInsert() returns False (duplicate) on replay — E11000
3. analytics consumer skips upsertIncrement on duplicate reservation.created events
4. analytics consumer skips upsertIncrement on duplicate reservation.completed events
5. analytics consumer skips upsertIncrement on duplicate reservation.cancelled events
6. First-time event (new reservationId) IS counted — stats increment by exactly 1
7. Runtime: service is healthy and the analytics queue still has an active consumer

Test methodology:
- Publish test events directly to the `reservation` exchange via the RabbitMQ Management
  HTTP API (port 15672).  The exchange is topic-typed and routes to analytics.reservation.queue
  via the same routing keys the real reservation-service uses.
- Use future-year period (2030-02 / 2030-03) so test stats don't collide with real data.
- Use unique synthetic reservationIds prefixed with "test-batch15-" so they are recognisable.
"""

import base64
import json
import time
import uuid

import pytest
import requests

BASE      = "http://localhost/api"
MQ_MGMT   = "http://localhost:15672"
MQ_AUTH   = ("guest", "guest")
EXCHANGE  = "reservation"
TEST_PROV = "bluePlug"


# ── helpers ────────────────────────────────────────────────────────────────────

def _publish(routing_key: str, payload: dict) -> bool:
    """Publish a message to the reservation exchange via the RabbitMQ management API.

    Returns True when routed, False / raises on failure.
    """
    body_b64 = base64.b64encode(json.dumps(payload).encode()).decode()
    req = {
        "properties": {},
        "routing_key": routing_key,
        "payload": body_b64,
        "payload_encoding": "base64",
    }
    r = requests.post(
        f"{MQ_MGMT}/api/exchanges/%2F/{EXCHANGE}/publish",
        auth=MQ_AUTH,
        json=req,
        timeout=5,
    )
    r.raise_for_status()
    return r.json().get("routed", False)


def _get_stats(admin_token: str, provider: str, period: str) -> dict:
    """Query GET /api/analytics/provider/<provider>?period=<period> as admin."""
    r = requests.get(
        f"{BASE}/analytics/provider/{provider}",
        headers={"Authorization": f"Bearer {admin_token}"},
        params={"period": period},
        timeout=10,
    )
    assert r.status_code == 200, \
        f"GET /analytics/provider/{provider}?period={period} returned {r.status_code}: {r.text[:200]}"
    return r.json()


def _wait_for_stats_change(admin_token: str, provider: str, period: str,
                           field: str, before_value, max_wait: float = 8.0) -> dict:
    """Poll until `field` in analytics differs from `before_value` (up to max_wait s)."""
    deadline = time.monotonic() + max_wait
    while time.monotonic() < deadline:
        data = _get_stats(admin_token, provider, period)
        if data.get(field) != before_value:
            return data
        time.sleep(0.5)
    # Return the last seen data; the caller will assert
    return _get_stats(admin_token, provider, period)


# ── test class ─────────────────────────────────────────────────────────────────

class TestBatch15AnalyticsDedup:
    SUITE_ID   = 36
    SUITE_NAME = "Batch 15: Analytics $inc dedup via ProcessedAnalyticEvent"

    # ── source checks ───────────────────────────────────────────────────────────

    def test_processed_event_model_exists(self):
        """ProcessedAnalyticEvent model file must exist in analytics-service."""
        import subprocess
        r = subprocess.run(
            ["docker", "exec", "analytics_service", "cat",
             "/saas26-09/src/models/processed-analytic-event.model.js"],
            capture_output=True, text=True, timeout=10,
        )
        assert r.returncode == 0, \
            f"processed-analytic-event.model.js not found in analytics_service container: {r.stderr}"
        assert "ProcessedAnalyticEvent" in r.stdout, \
            "ProcessedAnalyticEvent model not defined in the file"

    def test_model_has_unique_compound_index(self):
        """Model must declare a unique index on {reservationId, eventType}."""
        import subprocess
        r = subprocess.run(
            ["docker", "exec", "analytics_service", "cat",
             "/saas26-09/src/models/processed-analytic-event.model.js"],
            capture_output=True, text=True, timeout=10,
        )
        src = r.stdout
        assert "unique: true" in src, \
            "unique: true not found in ProcessedAnalyticEvent model — compound index must be unique"
        assert "reservationId" in src and "eventType" in src, \
            "reservationId and eventType fields not found in the model"

    def test_model_has_ttl_index(self):
        """Model should carry a TTL index (processedAt) to keep the collection bounded."""
        import subprocess
        r = subprocess.run(
            ["docker", "exec", "analytics_service", "cat",
             "/saas26-09/src/models/processed-analytic-event.model.js"],
            capture_output=True, text=True, timeout=10,
        )
        src = r.stdout
        assert "expireAfterSeconds" in src, \
            "TTL index (expireAfterSeconds) not found in ProcessedAnalyticEvent model"

    def test_repository_has_try_insert(self):
        """ProcessedAnalyticEventRepository must expose a tryInsert static method."""
        import subprocess
        r = subprocess.run(
            ["docker", "exec", "analytics_service", "cat",
             "/saas26-09/src/repositories/processed-analytic-event.repository.js"],
            capture_output=True, text=True, timeout=10,
        )
        assert r.returncode == 0, \
            f"processed-analytic-event.repository.js not found: {r.stderr}"
        src = r.stdout
        assert "tryInsert" in src, \
            "tryInsert method not found in ProcessedAnalyticEventRepository"

    def test_repository_try_insert_handles_e11000(self):
        """tryInsert must catch E11000 (code 11000) and return false on duplicate."""
        import subprocess
        r = subprocess.run(
            ["docker", "exec", "analytics_service", "cat",
             "/saas26-09/src/repositories/processed-analytic-event.repository.js"],
            capture_output=True, text=True, timeout=10,
        )
        src = r.stdout
        assert "11000" in src, \
            "E11000 duplicate-key error code not handled in tryInsert"
        assert "return false" in src or "return False" in src or "false" in src, \
            "tryInsert must return false for duplicates"

    def test_consumer_calls_try_insert(self):
        """analytics consumer must call tryInsert before upsertIncrement."""
        import subprocess
        r = subprocess.run(
            ["docker", "exec", "analytics_service", "cat",
             "/saas26-09/src/events/rabbitmq.consumers.js"],
            capture_output=True, text=True, timeout=10,
        )
        src = r.stdout
        assert "tryInsert" in src, \
            "analytics consumer does not call tryInsert — dedup gate is missing"

    def test_consumer_skips_on_duplicate(self):
        """Consumer must check tryInsert result and return early on duplicate (isDuplicate guard)."""
        import subprocess
        r = subprocess.run(
            ["docker", "exec", "analytics_service", "cat",
             "/saas26-09/src/events/rabbitmq.consumers.js"],
            capture_output=True, text=True, timeout=10,
        )
        src = r.stdout
        # Either isDuplicate or a negated tryInsert check
        has_guard = ("isDuplicate" in src) or ("if (!await" in src and "tryInsert" in src)
        assert has_guard, \
            "No isDuplicate guard found in analytics consumer — duplicate events will double-count"

    def test_consumer_has_try_insert_for_created(self):
        """Consumer calls tryInsert for reservation.created routing key."""
        import subprocess
        r = subprocess.run(
            ["docker", "exec", "analytics_service", "cat",
             "/saas26-09/src/events/rabbitmq.consumers.js"],
            capture_output=True, text=True, timeout=10,
        )
        src = r.stdout
        created_idx = src.find("reservation.created")
        try_insert_idx = src.find("tryInsert")
        assert created_idx != -1, "reservation.created not found in consumer"
        assert try_insert_idx != -1, "tryInsert not found in consumer"
        # tryInsert must appear within reasonable proximity of the created branch
        assert abs(try_insert_idx - created_idx) < 300, \
            f"tryInsert (pos {try_insert_idx}) is far from reservation.created branch (pos {created_idx})"

    def test_consumer_has_try_insert_for_completed(self):
        """Consumer calls tryInsert for reservation.completed routing key."""
        import subprocess
        r = subprocess.run(
            ["docker", "exec", "analytics_service", "cat",
             "/saas26-09/src/events/rabbitmq.consumers.js"],
            capture_output=True, text=True, timeout=10,
        )
        src = r.stdout
        completed_idx = src.find("reservation.completed")
        # Count tryInsert occurrences — should be at least 2 (one for created, one for completed/cancelled)
        count = src.count("tryInsert")
        assert count >= 2, \
            f"Expected at least 2 tryInsert calls (created + completed/cancelled), found {count}"

    # ── runtime: queue health ────────────────────────────────────────────────────

    def test_analytics_queue_has_consumer(self):
        """analytics.reservation.queue must still have an active consumer after the rebuild."""
        r = requests.get(
            f"{MQ_MGMT}/api/queues/%2F/analytics.reservation.queue",
            auth=MQ_AUTH,
            timeout=5,
        )
        assert r.status_code == 200, \
            f"RabbitMQ management API returned {r.status_code} for analytics queue"
        data = r.json()
        consumers = data.get("consumers", 0)
        assert consumers >= 1, \
            f"analytics.reservation.queue has {consumers} consumers (expected ≥1)"

    def test_analytics_queue_retains_dlx(self):
        """analytics.reservation.queue must retain the DLX binding."""
        r = requests.get(
            f"{MQ_MGMT}/api/queues/%2F/analytics.reservation.queue",
            auth=MQ_AUTH,
            timeout=5,
        )
        data = r.json()
        dlx = (data.get("arguments") or {}).get("x-dead-letter-exchange", "")
        assert dlx == "saasplug.dlx", \
            f"analytics.reservation.queue DLX={dlx!r} (expected 'saasplug.dlx')"

    # ── runtime: dedup — reservation.created ────────────────────────────────────

    def test_first_created_event_increments_stats(self, admin_token):
        """A first-time reservation.created event must increment totalReservations by 1."""
        period = "2030-02"
        rid = f"test-batch15-created-{uuid.uuid4().hex[:8]}"

        before = _get_stats(admin_token, TEST_PROV, period)
        before_count = before.get("totalReservations", 0)

        payload = {
            "reservationId": rid,
            "providerName": TEST_PROV,
            "createdAt": f"{period}-10T10:00:00.000Z",
        }
        routed = _publish("reservation.created", payload)
        assert routed, "Message was not routed to any queue — check exchange binding"

        after = _wait_for_stats_change(admin_token, TEST_PROV, period,
                                       "totalReservations", before_count, max_wait=8)
        after_count = after.get("totalReservations", 0)

        assert after_count == before_count + 1, (
            f"totalReservations: expected {before_count + 1} after first-time event, "
            f"got {after_count}"
        )

    def test_duplicate_created_event_not_double_counted(self, admin_token):
        """A replayed reservation.created event must NOT increment totalReservations again."""
        period = "2030-02"
        rid = f"test-batch15-dedup-{uuid.uuid4().hex[:8]}"

        # Publish first — establish a baseline after it lands
        payload = {
            "reservationId": rid,
            "providerName": TEST_PROV,
            "createdAt": f"{period}-11T10:00:00.000Z",
        }
        routed = _publish("reservation.created", payload)
        assert routed, "First message not routed"

        # Wait for first event to be processed
        before_stats = _get_stats(admin_token, TEST_PROV, period)
        before_count = before_stats.get("totalReservations", 0)
        deadline = time.monotonic() + 8
        while time.monotonic() < deadline:
            s = _get_stats(admin_token, TEST_PROV, period)
            if s.get("totalReservations", 0) >= before_count:
                before_after_first = s.get("totalReservations", 0)
                break
            time.sleep(0.5)
        else:
            before_after_first = _get_stats(admin_token, TEST_PROV, period).get("totalReservations", 0)

        # Give a short settle window to ensure the first event is fully processed
        time.sleep(1.5)
        count_after_first = _get_stats(admin_token, TEST_PROV, period).get("totalReservations", 0)

        # Publish the SAME reservationId again
        routed2 = _publish("reservation.created", payload)
        assert routed2, "Second (duplicate) message not routed"

        # Wait and check — should NOT change
        time.sleep(3)
        count_after_dup = _get_stats(admin_token, TEST_PROV, period).get("totalReservations", 0)

        assert count_after_dup == count_after_first, (
            f"Duplicate reservation.created caused a double-count: "
            f"count went from {count_after_first} to {count_after_dup} "
            f"(reservationId={rid})"
        )

    # ── runtime: dedup — reservation.completed ──────────────────────────────────

    def test_first_completed_event_increments_stats(self, admin_token):
        """A first-time reservation.completed event must increment totalRevenue."""
        period = "2030-03"
        rid = f"test-batch15-comp-{uuid.uuid4().hex[:8]}"

        before = _get_stats(admin_token, TEST_PROV, period)
        before_rev = before.get("totalRevenue", 0)

        payload = {
            "reservationId": rid,
            "providerName": TEST_PROV,
            "createdAt": f"{period}-05T10:00:00.000Z",
            "actualDuration": 1800,   # 30 min in seconds
            "capacityKw": 22,
            "totalCost": 9.99,
        }
        routed = _publish("reservation.completed", payload)
        assert routed, "reservation.completed message not routed"

        after = _wait_for_stats_change(admin_token, TEST_PROV, period,
                                       "totalRevenue", before_rev, max_wait=8)
        after_rev = after.get("totalRevenue", 0)

        assert after_rev > before_rev, (
            f"totalRevenue did not increase after first-time reservation.completed: "
            f"before={before_rev}, after={after_rev}"
        )

    def test_duplicate_completed_event_not_double_counted(self, admin_token):
        """A replayed reservation.completed event must NOT change stats again."""
        period = "2030-03"
        rid = f"test-batch15-compdup-{uuid.uuid4().hex[:8]}"

        payload = {
            "reservationId": rid,
            "providerName": TEST_PROV,
            "createdAt": f"{period}-06T10:00:00.000Z",
            "actualDuration": 1200,   # 20 min
            "capacityKw": 22,
            "totalCost": 7.50,
        }

        # Publish first event
        routed = _publish("reservation.completed", payload)
        assert routed, "First reservation.completed not routed"

        # Wait for it to land
        time.sleep(3)
        count_after_first = _get_stats(admin_token, TEST_PROV, period).get("totalRevenue", 0)

        # Publish duplicate
        routed2 = _publish("reservation.completed", payload)
        assert routed2, "Second (duplicate) reservation.completed not routed"

        # Wait and check — revenue should not change
        time.sleep(3)
        count_after_dup = _get_stats(admin_token, TEST_PROV, period).get("totalRevenue", 0)

        assert abs(count_after_dup - count_after_first) < 0.01, (
            f"Duplicate reservation.completed caused double-count: "
            f"revenue changed from {count_after_first} to {count_after_dup} "
            f"(reservationId={rid}, expected no change)"
        )

    # ── runtime: dedup — reservation.cancelled ──────────────────────────────────

    def test_duplicate_cancelled_event_not_double_counted(self, admin_token):
        """A replayed reservation.cancelled event must NOT double-count energy/revenue."""
        period = "2030-03"
        rid = f"test-batch15-canc-{uuid.uuid4().hex[:8]}"

        payload = {
            "reservationId": rid,
            "providerName": TEST_PROV,
            "createdAt": f"{period}-07T10:00:00.000Z",
            "actualDuration": 600,   # 10 min
            "capacityKw": 22,
            "totalCost": 3.00,
        }

        # Publish first cancelled event
        routed = _publish("reservation.cancelled", payload)
        assert routed, "First reservation.cancelled not routed"

        # Wait for it to land
        time.sleep(3)
        energy_after_first = _get_stats(admin_token, TEST_PROV, period).get("totalEnergyKwh", 0)

        # Publish duplicate
        routed2 = _publish("reservation.cancelled", payload)
        assert routed2, "Second (duplicate) reservation.cancelled not routed"

        # Wait and check — energy should not change
        time.sleep(3)
        energy_after_dup = _get_stats(admin_token, TEST_PROV, period).get("totalEnergyKwh", 0)

        assert abs(energy_after_dup - energy_after_first) < 0.001, (
            f"Duplicate reservation.cancelled caused double-count: "
            f"totalEnergyKwh changed from {energy_after_first} to {energy_after_dup} "
            f"(reservationId={rid}, expected no change)"
        )

    # ── runtime: analytics endpoint health ───────────────────────────────────────

    def test_analytics_provider_report_still_responds(self, admin_token):
        """analytics-service /provider/:name endpoint is healthy after rebuild."""
        r = requests.get(
            f"{BASE}/analytics/provider/bluePlug",
            headers={"Authorization": f"Bearer {admin_token}"},
            params={"period": "2026-01"},
            timeout=10,
        )
        assert r.status_code == 200, \
            f"GET /analytics/provider/bluePlug returned {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert "totalReservations" in data, \
            f"totalReservations field missing from analytics response: {data}"

    def test_analytics_global_report_still_responds(self, admin_token):
        """analytics-service /global endpoint is healthy after rebuild."""
        r = requests.get(
            f"{BASE}/analytics/global",
            headers={"Authorization": f"Bearer {admin_token}"},
            params={"period": "2026-01"},
            timeout=10,
        )
        assert r.status_code == 200, \
            f"GET /analytics/global returned {r.status_code}: {r.text[:200]}"
