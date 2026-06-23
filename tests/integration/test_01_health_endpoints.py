import pytest
from helpers import get, GATEWAY


class TestHealthEndpoints:
    SUITE_ID   = 1
    SUITE_NAME = "Service Health Endpoints"

    # Per-service /health routes are intentionally blocked at the gateway (Issue N8).
    @pytest.mark.parametrize("path", [
        "/api/auth/health",
        "/api/chargers/health",
        "/api/reservations/health",
        "/api/providers/health",
        "/api/analytics/health",
        "/api/admin/health",
        "/api/billing/health",
    ])
    def test_per_service_health_blocked(self, path):
        code, _ = get(f"{GATEWAY}{path}")
        assert code == 404, f"GET {path} should be blocked (404) at gateway, got HTTP {code}"

    def test_system_health_returns_200(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/admin/system-health", token=admin_token)
        assert code == 200, f"GET /api/admin/system-health HTTP {code}"

    def test_all_services_operational(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/admin/system-health", token=admin_token)
        if code != 200:
            pytest.skip(f"system-health returned HTTP {code}")

        def svc_status(v):
            if isinstance(v, str):   return v
            if isinstance(v, dict):  return v.get("status", "unknown")
            return str(v)

        services  = {k: svc_status(v) for k, v in data.items()} if isinstance(data, dict) else {}
        down_svcs = [k for k, st in services.items() if st not in ("ok", "operational")]
        assert len(down_svcs) == 0, f"Services down: {down_svcs}"
