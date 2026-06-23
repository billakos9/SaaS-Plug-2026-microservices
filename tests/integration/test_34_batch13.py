"""
Suite 34 — Batch 13: Dead-code sweep + { new: true } → { returnDocument: "after" } migration.

Affected repositories:
  - billing-service:     invoice.repository.js, billed-reservation.repository.js
  - reservation-service: reservation.repository.js
  - admin-service:       admin.repository.js
  - provider-service:    provider.repository.js

Dead code removed:
  - AdminService.register() (with its ADMIN_REGISTRATION_KEY dependency)
  - ADMIN_REGISTRATION_KEY export from admin-service config/env.js
  - publishChannel / publishChPromise from admin-service rabbitMQ.js
    (admin-service is consumer-only; no publish channel was ever used)
"""

import pytest
import requests
from pathlib import Path

BASE = "http://localhost/api"
ROOT = Path("/home/giorgos/SaaS/project/saas26-09")


# ── helpers ────────────────────────────────────────────────────────────────────

def _src(rel: str) -> str:
    """Return file contents as string, or empty string if missing."""
    p = ROOT / rel
    return p.read_text() if p.exists() else ""


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ══════════════════════════════════════════════════════════════════════════════
# CLASS: source-level checks (no live HTTP needed)
# ══════════════════════════════════════════════════════════════════════════════

class TestBatch13Sources:
    """Static source checks for the { new: true } migration and dead-code sweep."""

    SUITE_ID   = 34
    SUITE_NAME = "Batch 13: returnDocument migration + dead-code sweep"

    # ── billing-service: invoice.repository.js ─────────────────────────────────

    def test_invoice_repo_no_new_true(self):
        src = _src("services/billing-service/src/repositories/invoice.repository.js")
        assert "{ new: true" not in src, \
            "invoice.repository.js still contains '{ new: true' — not migrated"

    def test_invoice_repo_has_return_document_after(self):
        src = _src("services/billing-service/src/repositories/invoice.repository.js")
        assert 'returnDocument: "after"' in src, \
            "invoice.repository.js missing returnDocument: 'after'"

    # ── billing-service: billed-reservation.repository.js ─────────────────────

    def test_billed_reservation_repo_no_new_true(self):
        src = _src("services/billing-service/src/repositories/billed-reservation.repository.js")
        assert "{ new: true" not in src, \
            "billed-reservation.repository.js still contains '{ new: true'"

    def test_billed_reservation_repo_has_return_document_after(self):
        src = _src("services/billing-service/src/repositories/billed-reservation.repository.js")
        assert 'returnDocument: "after"' in src, \
            "billed-reservation.repository.js missing returnDocument: 'after'"

    # ── reservation-service: reservation.repository.js ────────────────────────

    def test_reservation_repo_no_new_true(self):
        src = _src("services/reservation-service/src/repositories/reservation.repository.js")
        assert "{ new: true" not in src, \
            "reservation.repository.js still contains '{ new: true'"

    def test_reservation_repo_has_return_document_after(self):
        src = _src("services/reservation-service/src/repositories/reservation.repository.js")
        assert 'returnDocument: "after"' in src, \
            "reservation.repository.js missing returnDocument: 'after'"

    # ── admin-service: admin.repository.js ────────────────────────────────────

    def test_admin_repo_no_new_true(self):
        src = _src("services/admin-service/src/repositories/admin.repository.js")
        assert "{ new: true" not in src, \
            "admin.repository.js still contains '{ new: true'"

    def test_admin_repo_has_return_document_after(self):
        src = _src("services/admin-service/src/repositories/admin.repository.js")
        assert 'returnDocument: "after"' in src, \
            "admin.repository.js missing returnDocument: 'after'"

    # ── provider-service: provider.repository.js ──────────────────────────────

    def test_provider_repo_no_new_true(self):
        src = _src("services/provider-service/src/repositories/provider.repository.js")
        assert "{ new: true" not in src, \
            "provider.repository.js still contains '{ new: true'"

    def test_provider_repo_has_return_document_after(self):
        src = _src("services/provider-service/src/repositories/provider.repository.js")
        assert 'returnDocument: "after"' in src, \
            "provider.repository.js missing returnDocument: 'after'"

    # ── global: no service repository retains { new: true } ───────────────────

    def test_no_new_true_in_batch13_repositories(self):
        """The four repositories targeted by Batch 13 must not use { new: true }."""
        batch13_repos = [
            "services/billing-service/src/repositories/invoice.repository.js",
            "services/billing-service/src/repositories/billed-reservation.repository.js",
            "services/reservation-service/src/repositories/reservation.repository.js",
            "services/admin-service/src/repositories/admin.repository.js",
            "services/provider-service/src/repositories/provider.repository.js",
        ]
        offenders = []
        for rel in batch13_repos:
            src = _src(rel)
            if "{ new: true" in src:
                offenders.append(rel)
        assert offenders == [], \
            f"Batch 13 target files still using '{{ new: true }}': {offenders}"

    # ── dead code: AdminService.register() removed ────────────────────────────

    def test_admin_service_no_register_method(self):
        src = _src("services/admin-service/src/services/admin.service.js")
        assert "static async register(" not in src, \
            "AdminService.register() was not removed — dead code sweep incomplete"

    def test_admin_service_no_admin_registration_key_import(self):
        src = _src("services/admin-service/src/services/admin.service.js")
        assert "ADMIN_REGISTRATION_KEY" not in src, \
            "admin.service.js still imports ADMIN_REGISTRATION_KEY — dead code sweep incomplete"

    # ── dead code: ADMIN_REGISTRATION_KEY removed from env.js ─────────────────

    def test_admin_env_no_admin_registration_key(self):
        src = _src("services/admin-service/src/config/env.js")
        assert "ADMIN_REGISTRATION_KEY" not in src, \
            "admin-service env.js still exports ADMIN_REGISTRATION_KEY"

    # ── dead code: publishChannel / publishChPromise removed from rabbitMQ.js ─

    def test_admin_rabbitmq_no_publish_channel(self):
        src = _src("services/admin-service/src/infrastructure/rabbitMQ.js")
        assert "publishChannel" not in src, \
            "admin-service rabbitMQ.js still declares publishChannel — dead code not removed"

    def test_admin_rabbitmq_no_publish_ch_promise(self):
        src = _src("services/admin-service/src/infrastructure/rabbitMQ.js")
        assert "publishChPromise" not in src, \
            "admin-service rabbitMQ.js still declares publishChPromise — dead code not removed"

    def test_admin_rabbitmq_has_consume_channel(self):
        """consumeChannel must still be present — admin-service is a consumer."""
        src = _src("services/admin-service/src/infrastructure/rabbitMQ.js")
        assert "consumeChannel" in src, \
            "admin-service rabbitMQ.js unexpectedly lost consumeChannel"


# ══════════════════════════════════════════════════════════════════════════════
# CLASS: runtime checks — affected endpoints still work correctly
# ══════════════════════════════════════════════════════════════════════════════

class TestBatch13Runtime:
    """Live HTTP smoke tests proving the migrated services still function."""

    SUITE_ID   = 34
    SUITE_NAME = "Batch 13: returnDocument migration + dead-code sweep"

    def test_admin_list_users_returns_200(self, admin_token):
        """admin.repository.update() path exercised indirectly; admin service is up."""
        r = requests.get(f"{BASE}/admin/users", headers=_auth(admin_token))
        assert r.status_code == 200, \
            f"GET /admin/users → {r.status_code} (admin-service may be broken after migration)"

    def test_admin_list_providers_returns_200(self, admin_token):
        r = requests.get(f"{BASE}/admin/providers", headers=_auth(admin_token))
        assert r.status_code == 200, \
            f"GET /admin/providers → {r.status_code}"

    def test_provider_list_returns_200(self, admin_token):
        """provider.repository uses returnDocument after; service must be alive."""
        r = requests.get(f"{BASE}/providers", headers=_auth(admin_token))
        assert r.status_code == 200, \
            f"GET /providers → {r.status_code} (provider-service may be broken after migration)"

    def test_billing_invoices_admin_returns_200(self, admin_token):
        """invoice.repository uses returnDocument after; billing service must be alive."""
        r = requests.get(f"{BASE}/billing/invoices/", headers=_auth(admin_token))
        assert r.status_code == 200, \
            f"GET /billing/invoices/ → {r.status_code} (billing-service may be broken after migration)"

    def test_reservation_history_returns_200(self, user_token):
        """reservation.repository uses returnDocument after; reservation service must be alive.

        Route is /reservations/user/<userId>; first fetch the user id from /users/me,
        then call the history endpoint.
        """
        # Get userId
        me = requests.get(f"{BASE}/users/me", headers=_auth(user_token))
        assert me.status_code == 200, f"GET /users/me → {me.status_code}"
        user_id = me.json().get("userId")
        assert user_id is not None, "userId missing from /users/me response"
        # Fetch history
        r = requests.get(f"{BASE}/reservations/user/{user_id}", headers=_auth(user_token))
        assert r.status_code == 200, \
            f"GET /reservations/user/{user_id} → {r.status_code} (reservation-service may be broken)"

    def test_system_health_all_operational(self, admin_token):
        """All services must still report healthy after Batch 13 changes."""
        r = requests.get(f"{BASE}/admin/system-health", headers=_auth(admin_token))
        assert r.status_code == 200, \
            f"GET /admin/system-health → {r.status_code}"
        body = r.json()
        services = body.get("services", [])
        degraded = [s for s in services if s.get("status") != "operational"]
        assert degraded == [], \
            f"Degraded services after Batch 13: {[s['name'] for s in degraded]}"
