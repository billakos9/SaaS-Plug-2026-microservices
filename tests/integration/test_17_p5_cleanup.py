import subprocess
import pytest
from helpers import get, GATEWAY


class TestP5Cleanup:
    SUITE_ID   = 17
    SUITE_NAME = "P5 Cleanup (N6 deleted route / N5 narrow binding / #15 no double charger call)"

    def test_internal_by_provider_route_deleted(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, _ = get(
            f"{GATEWAY}/api/reservations/internal/by-provider?providerName=bluePlug",
            token=admin_token,
        )
        assert code == 404, \
            f"GET /api/reservations/internal/by-provider should be 404 (route deleted), got HTTP {code}"

    def test_internal_route_file_absent_from_container(self):
        result = subprocess.run(
            ["docker", "exec", "reservation_service",
             "test", "-f", "src/routes/internal.route.js"],
            capture_output=True,
        )
        assert result.returncode != 0, \
            "src/routes/internal.route.js still exists in reservation-service container"

    def test_no_provider_wildcard_binding(self):
        result = subprocess.run(
            ["docker", "exec", "admin_service", "grep", "-r", r"provider\.\*",
             "src/infrastructure/rabbitMQ.js"],
            capture_output=True, text=True,
        )
        assert result.returncode != 0, \
            f"admin-service rabbitMQ.js still has provider.* wildcard: {result.stdout.strip()[:120]}"

    def test_analytics_service_no_charger_service_url(self):
        result = subprocess.run(
            ["docker", "exec", "admin_service", "grep", "-n", "CHARGER_SERVICE_URL",
             "src/services/analytics.service.js"],
            capture_output=True, text=True,
        )
        assert result.returncode != 0, \
            f"analytics.service.js still references CHARGER_SERVICE_URL: {result.stdout.strip()[:120]}"

    def test_admin_analytics_returns_charger_data(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, resp = get(f"{GATEWAY}/api/admin/analytics", token=admin_token)
        chargers      = resp.get("chargers", {}) if isinstance(resp, dict) else {}
        charger_total = chargers.get("total")
        assert code == 200 and isinstance(charger_total, int) and charger_total > 0, \
            f"GET /api/admin/analytics HTTP {code}, chargers.total={charger_total}"

    def test_admin_analytics_providers_returns_3(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, resp = get(f"{GATEWAY}/api/admin/analytics/providers", token=admin_token)
        count = len(resp) if isinstance(resp, list) else 0
        assert code == 200 and count == 3, \
            f"GET /api/admin/analytics/providers HTTP {code}, providers={count}"
