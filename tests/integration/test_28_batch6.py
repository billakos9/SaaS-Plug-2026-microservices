"""Suite 28 — Batch 6 (N20): AbortSignal.timeout(3000) added to safeFetch in analytics-service and admin-service."""

import pytest
from helpers import get, GATEWAY


class TestBatch6SafeFetchTimeout:
    SUITE_ID   = 28
    SUITE_NAME = "Batch 6: safeFetch AbortSignal.timeout(3000) — analytics + admin"

    # ── Source checks ─────────────────────────────────────────────────────────

    def test_analytics_service_safefetch_has_abortsignal(self):
        from pathlib import Path
        p = Path("services/analytics-service/src/services/analytics.service.js")
        assert p.exists(), f"source file not found: {p}"
        src = p.read_text()
        assert "AbortSignal.timeout" in src, \
            f"AbortSignal.timeout not found in analytics-service safeFetch"

    def test_admin_service_safefetch_has_abortsignal(self):
        from pathlib import Path
        p = Path("services/admin-service/src/services/analytics.service.js")
        assert p.exists(), f"source file not found: {p}"
        src = p.read_text()
        assert "AbortSignal.timeout" in src, \
            f"AbortSignal.timeout not found in admin-service safeFetch"

    # ── Runtime: services still work after the patch ──────────────────────────

    def test_analytics_global_returns_200(self, admin_token):
        code, _ = get(f"{GATEWAY}/api/analytics/global", token=admin_token, timeout=8)
        assert code == 200, f"GET /api/analytics/global HTTP {code}"

    def test_analytics_global_has_total_reservations(self, admin_token):
        _, data = get(f"{GATEWAY}/api/analytics/global", token=admin_token, timeout=8)
        assert isinstance(data, dict) and "totalReservations" in data, \
            f"keys={list(data.keys()) if isinstance(data, dict) else type(data).__name__}"

    def test_admin_system_health_returns_200(self, admin_token):
        code, _ = get(f"{GATEWAY}/api/admin/system-health", token=admin_token, timeout=12)
        assert code == 200, f"GET /api/admin/system-health HTTP {code}"
