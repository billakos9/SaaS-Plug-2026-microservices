"""Suite 29 — Batch 7 (N24/N25/N27): plug-service knownChargers guard + outer try/catch removal + billing upsertOnCreate."""

import pytest
from helpers import get, GATEWAY, MQ_API


class TestBatch7PlugBilling:
    SUITE_ID   = 29
    SUITE_NAME = "Batch 7: plug-service charger guard / try-catch removal / billing upsertOnCreate"

    # ── N25: outer try/catch removed — plug consumer must still be alive ──────

    def test_plug_reservation_queue_has_consumer(self):
        code, data = get(f"{MQ_API}/api/queues/%2F/plug.reservation.queue",
                         basic=("guest", "guest"), timeout=5)
        consumers = data.get("consumers", -1) if isinstance(data, dict) else -1
        assert consumers >= 1, \
            f"plug.reservation.queue: consumers={consumers} (expected ≥1 after try/catch removal)"

    def test_plug_reservation_queue_retains_dlx(self):
        code, data = get(f"{MQ_API}/api/queues/%2F/plug.reservation.queue",
                         basic=("guest", "guest"), timeout=5)
        dlx = (data.get("arguments") or {}).get("x-dead-letter-exchange", "") \
              if isinstance(data, dict) else ""
        assert dlx == "saasplug.dlx", \
            f"plug.reservation.queue DLX={dlx!r} (expected 'saasplug.dlx')"

    # ── N24: knownChargers.set() only runs after successful publishEvent ──────

    def test_polling_job_has_known_chargers_set(self):
        from pathlib import Path
        p = Path("services/plug-service/src/jobs/provider-polling.job.js")
        assert p.exists(), f"source file not found: {p}"
        src = p.read_text()
        assert "knownChargers.set" in src, "knownChargers.set not found in provider-polling.job.js"

    def test_polling_job_set_after_publish(self):
        from pathlib import Path
        p = Path("services/plug-service/src/jobs/provider-polling.job.js")
        src = p.read_text()
        pub_pos = src.find("publishEvent")
        set_pos = src.find("knownChargers.set")
        assert pub_pos >= 0, "publishEvent not found in provider-polling.job.js"
        assert set_pos > pub_pos, \
            f"knownChargers.set() (pos {set_pos}) must appear after publishEvent (pos {pub_pos})"

    # ── N27: billing upsertOnCreate ───────────────────────────────────────────

    def test_billing_repo_has_upsert_on_create(self):
        from pathlib import Path
        p = Path("services/billing-service/src/repositories/billed-reservation.repository.js")
        assert p.exists(), f"source file not found: {p}"
        src = p.read_text()
        assert "upsertOnCreate" in src, "upsertOnCreate method not found in billed-reservation.repository.js"

    def test_billing_repo_uses_set_on_insert(self):
        from pathlib import Path
        p = Path("services/billing-service/src/repositories/billed-reservation.repository.js")
        src = p.read_text()
        assert "$setOnInsert" in src, \
            "$setOnInsert not found — upsertOnCreate must use $setOnInsert for idempotency"

    def test_billing_consumers_use_upsert_on_create(self):
        from pathlib import Path
        p = Path("services/billing-service/src/events/rabbitmq.consumers.js")
        assert p.exists(), f"source file not found: {p}"
        src = p.read_text()
        assert "upsertOnCreate" in src, \
            "billing consumers.js: reservation.created handler must use upsertOnCreate"

    def test_billing_service_alive(self, user_token):
        """billing-service returns 403 for user on /my (not 502/500 — service is up)."""
        code, _ = get(f"{GATEWAY}/api/billing/invoices/my", token=user_token, timeout=5)
        assert code == 403, f"Expected 403 (user blocked), got HTTP {code}"
