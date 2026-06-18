import re
import pytest
from helpers import get, GATEWAY, CREDS


class TestAnalyticsComplete:
    SUITE_ID   = 43
    SUITE_NAME = "Analytics Service: All endpoints / auth levels / period param"

    # ── GET /api/analytics/global ─────────────────────────────────────────────

    def test_global_provider_token_200(self, provider_token):
        if not provider_token:
            pytest.skip("provider login failed")
        code, data = get(f"{GATEWAY}/api/analytics/global", token=provider_token)
        assert code == 200, f"GET /analytics/global (provider) HTTP {code}: {data}"

    def test_global_admin_token_200(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/analytics/global", token=admin_token)
        assert code == 200, f"GET /analytics/global (admin) HTTP {code}: {data}"

    def test_global_user_token_403(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, _ = get(f"{GATEWAY}/api/analytics/global", token=user_token)
        assert code == 403, f"User token on /analytics/global should be 403, got {code}"

    def test_global_no_token_401(self):
        code, _ = get(f"{GATEWAY}/api/analytics/global")
        assert code == 401, f"No token on /analytics/global should be 401, got {code}"

    def test_global_structure(self, provider_token):
        if not provider_token:
            pytest.skip("provider login failed")
        code, data = get(f"{GATEWAY}/api/analytics/global", token=provider_token)
        if code != 200:
            pytest.skip("global analytics unavailable")
        assert isinstance(data, dict), f"Expected dict, got {type(data)}"
        for field in ("totalReservations", "totalEnergyKwh", "totalRevenue"):
            assert field in data, \
                f"Field '{field}' missing from global analytics: {list(data.keys())}"

    def test_global_charger_counts(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/analytics/global", token=admin_token)
        if code != 200 or not isinstance(data, dict):
            pytest.skip("global analytics unavailable")
        has_chargers = "totalChargers" in data or "chargers" in data
        assert has_chargers, \
            f"charger count missing from global analytics: {list(data.keys())}"

    # ── GET /api/analytics/providers ─────────────────────────────────────────

    def test_providers_list_provider_token_200(self, provider_token):
        if not provider_token:
            pytest.skip("provider login failed")
        code, data = get(f"{GATEWAY}/api/analytics/providers", token=provider_token)
        assert code == 200, f"GET /analytics/providers (provider) HTTP {code}: {data}"
        assert isinstance(data, (list, dict)), f"Unexpected type: {type(data)}"

    def test_providers_list_user_403(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, _ = get(f"{GATEWAY}/api/analytics/providers", token=user_token)
        assert code == 403, f"User on /analytics/providers should be 403, got {code}"

    # ── GET /api/analytics/provider/:name ────────────────────────────────────

    def test_provider_own_report_200(self, provider_token):
        if not provider_token:
            pytest.skip("provider login failed")
        code, data = get(f"{GATEWAY}/api/analytics/provider/bluePlug",
                         token=provider_token)
        assert code == 200, f"bluePlug provider own report HTTP {code}: {data}"

    def test_provider_own_report_structure(self, provider_token):
        if not provider_token:
            pytest.skip("provider login failed")
        code, data = get(f"{GATEWAY}/api/analytics/provider/bluePlug",
                         token=provider_token)
        if code != 200 or not isinstance(data, dict):
            pytest.skip("provider report unavailable")
        for field in ("totalReservations", "totalEnergyKwh", "totalRevenue"):
            assert field in data, \
                f"Field '{field}' missing from provider report: {list(data.keys())}"

    def test_provider_cross_provider_403(self, provider_token):
        if not provider_token:
            pytest.skip("provider login failed")
        # provider_token is bluePlug; accessing redPlug should be 403
        code, _ = get(f"{GATEWAY}/api/analytics/provider/redPlug",
                      token=provider_token)
        assert code == 403, \
            f"bluePlug accessing redPlug analytics should be 403, got {code}"

    def test_provider_admin_any_200(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/analytics/provider/redPlug",
                         token=admin_token)
        assert code == 200, f"Admin accessing redPlug analytics HTTP {code}: {data}"

    def test_provider_user_token_403(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, _ = get(f"{GATEWAY}/api/analytics/provider/bluePlug",
                      token=user_token)
        assert code == 403, f"User token on /analytics/provider/:name should be 403, got {code}"

    def test_provider_with_period_param(self, provider_token):
        if not provider_token:
            pytest.skip("provider login failed")
        code, data = get(f"{GATEWAY}/api/analytics/provider/bluePlug?period=2025-01",
                         token=provider_token)
        assert code == 200, f"Provider report with period param HTTP {code}: {data}"

    def test_provider_nonexistent_name(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/analytics/provider/doesNotExist99",
                         token=admin_token)
        # Could be 404 or 200 with zeroes — either is acceptable
        assert code in (200, 404), \
            f"Non-existent provider analytics should be 200 or 404, got {code}"

    # ── GET /api/analytics/history/global ────────────────────────────────────

    def test_history_global_200(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/analytics/history/global", token=admin_token)
        assert code == 200, f"GET /analytics/history/global HTTP {code}: {data}"
        assert isinstance(data, list), f"Expected list, got {type(data)}"

    def test_history_global_structure(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/analytics/history/global", token=admin_token)
        if code != 200 or not isinstance(data, list) or not data:
            pytest.skip("global history unavailable or empty")
        item = data[0]
        for field in ("period", "totalReservations", "totalEnergyKwh", "totalRevenue"):
            assert field in item, \
                f"Field '{field}' missing from history item: {list(item.keys())}"

    def test_history_global_period_format(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/analytics/history/global", token=admin_token)
        if code != 200 or not isinstance(data, list) or not data:
            pytest.skip("global history unavailable or empty")
        pattern = re.compile(r"^\d{4}-\d{2}$")
        for item in data[:5]:  # check first 5
            period = item.get("period", "")
            assert pattern.match(period), \
                f"period '{period}' doesn't match YYYY-MM format"

    def test_history_global_user_401(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, _ = get(f"{GATEWAY}/api/analytics/history/global", token=user_token)
        assert code in (401, 403), \
            f"User on /analytics/history/global should be 4xx, got {code}"

    # ── GET /api/analytics/history/provider/:name ─────────────────────────────

    def test_history_provider_own_200(self, provider_token):
        if not provider_token:
            pytest.skip("provider login failed")
        code, data = get(f"{GATEWAY}/api/analytics/history/provider/bluePlug",
                         token=provider_token)
        assert code == 200, f"Provider history bluePlug HTTP {code}: {data}"
        assert isinstance(data, list), f"Expected list, got {type(data)}"

    def test_history_provider_cross_403(self, provider_token):
        if not provider_token:
            pytest.skip("provider login failed")
        code, _ = get(f"{GATEWAY}/api/analytics/history/provider/redPlug",
                      token=provider_token)
        assert code == 403, \
            f"bluePlug accessing redPlug history should be 403, got {code}"

    def test_history_provider_admin_bypass(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/analytics/history/provider/redPlug",
                         token=admin_token)
        assert code == 200, \
            f"Admin accessing redPlug history should bypass self-check, got {code}: {data}"
