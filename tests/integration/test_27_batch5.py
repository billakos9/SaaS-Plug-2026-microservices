"""Suite 27 — Batch 5: Reservation controller try/catch, analytics createdAt, admin provider JWT."""

import time
import pytest
from helpers import get, post, _request, GATEWAY, MQ_API


class TestBatch5Changes:
    SUITE_ID   = 27
    SUITE_NAME = "Batch 5: Reservation Controller / Analytics createdAt / Admin Provider JWT"

    # ── B5-1: reservation-service controller returns structured 404 (not crash) ──

    def test_b5_1_cancel_nonexistent_returns_404(self, user_token):
        code, _ = _request("POST", f"{GATEWAY}/api/reservations/99999999/cancel",
                           token=user_token)
        assert code == 404, f"HTTP {code}"

    def test_b5_1_404_body_is_structured_json(self, user_token):
        code, data = _request("POST", f"{GATEWAY}/api/reservations/99999999/cancel",
                              token=user_token)
        assert isinstance(data, dict) and "returnCode" in data, \
            f"type={type(data).__name__}, body={str(data)[:120]}"

    # ── B5-3: analytics consumer uses payload.createdAt ─────────────────────────

    def test_b5_3_analytics_consumer_uses_created_at(self):
        from pathlib import Path
        p = Path("services/analytics-service/src/events/rabbitmq.consumers.js")
        assert p.exists(), f"source file not found: {p}"
        src = p.read_text()
        assert "payload.createdAt" in src, \
            f"payload.createdAt not found in {p}"

    def test_b5_3_analytics_global_returns_200(self, admin_token):
        code, _ = get(f"{GATEWAY}/api/analytics/global", token=admin_token, timeout=8)
        assert code == 200, f"HTTP {code}"

    def test_b5_3_analytics_global_has_total_reservations(self, admin_token):
        _, data = get(f"{GATEWAY}/api/analytics/global", token=admin_token, timeout=8)
        assert isinstance(data, dict) and "totalReservations" in data, \
            f"keys={list(data.keys()) if isinstance(data, dict) else type(data).__name__}"

    # ── B5-4: reservation.cancelled payload includes createdAt ──────────────────

    def test_b5_4_cancelled_payload_includes_created_at(self):
        from pathlib import Path
        p = Path("services/reservation-service/src/services/reservation.service.js")
        assert p.exists(), f"source file not found: {p}"
        src = p.read_text()
        assert src.count("createdAt:") >= 2, \
            f"Expected ≥2 occurrences of createdAt: in reservation.service.js, found {src.count('createdAt:')}"

    # ── B5-5: POST /api/admin/providers forwards admin JWT and provider appears in list ──

    def test_b5_5_admin_register_provider_returns_201(self, admin_token):
        ts    = int(time.time())
        code, data = _request("POST", f"{GATEWAY}/api/admin/providers",
                              body={"providerName": f"b5s27_{ts}", "email": f"b5s27_{ts}@example.com",
                                    "password": "TestPass123!", "apiBaseUrl": "http://test.example.com",
                                    "apiKey": "testkey123"},
                              token=admin_token)
        assert code == 201, f"HTTP {code}: {str(data)[:120]}"

    def test_b5_5_register_provider_response_has_provider_name(self, admin_token):
        ts    = int(time.time()) + 1
        pname = f"b5s27b_{ts}"
        code, data = _request("POST", f"{GATEWAY}/api/admin/providers",
                              body={"providerName": pname, "email": f"b5s27b_{ts}@example.com",
                                    "password": "TestPass123!", "apiBaseUrl": "http://test.example.com",
                                    "apiKey": "testkey123"},
                              token=admin_token)
        assert code == 201, f"HTTP {code}"
        ret_name = data.get("providerName") if isinstance(data, dict) else None
        assert ret_name == pname, f"got providerName={ret_name!r}"
        # Cleanup
        time.sleep(1)
        list_code, list_data = get(f"{GATEWAY}/api/providers", token=admin_token)
        if list_code == 200 and isinstance(list_data, list):
            for p in list_data:
                if isinstance(p, dict) and p.get("providerName") == pname:
                    pid = p.get("providerId")
                    if pid:
                        _request("DELETE", f"{GATEWAY}/api/admin/providers/delete/{pid}",
                                 token=admin_token)
                    break
