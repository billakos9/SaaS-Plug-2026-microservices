import time
import pytest
from helpers import get, post, put, _request, GATEWAY

_TS = int(time.time())


class TestAdminManagement:
    SUITE_ID   = 44
    SUITE_NAME = "Admin Service: All management endpoints + proxy coverage"

    # ── Admin profile & accounts ──────────────────────────────────────────────

    def test_admin_profile_structure(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/admin/profile", token=admin_token)
        assert code == 200, f"GET /api/admin/profile HTTP {code}: {data}"
        assert isinstance(data, dict), f"Response not a dict: {data}"
        assert "email" in data, f"email missing from admin profile: {list(data.keys())}"
        assert data.get("role") == "admin", f"Expected role=admin, got {data.get('role')}"

    def test_admin_profile_no_password_field(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/admin/profile", token=admin_token)
        if code != 200:
            pytest.skip("profile unavailable")
        assert "password" not in data, "password exposed in admin profile"

    def test_admin_accounts_list(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/admin/accounts", token=admin_token)
        assert code == 200, f"GET /api/admin/accounts HTTP {code}: {data}"
        assert isinstance(data, list) and len(data) > 0, "Expected non-empty admin list"

    def test_admin_accounts_user_blocked(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, _ = get(f"{GATEWAY}/api/admin/accounts", token=user_token)
        assert code == 403, f"User on /api/admin/accounts should be 403, got {code}"

    # ── Admin analytics ────────────────────────────────────────────────────────

    def test_admin_analytics_structure(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/admin/analytics", token=admin_token)
        assert code == 200, f"GET /api/admin/analytics HTTP {code}: {data}"
        assert isinstance(data, dict), f"Expected dict, got {type(data)}"
        has_sessions = "globalSessions" in data or "totalReservations" in data
        has_chargers = "totalChargers" in data or "chargers" in data
        assert has_sessions, f"No sessions field in analytics: {list(data.keys())}"
        assert has_chargers, f"No chargers field in analytics: {list(data.keys())}"

    def test_admin_analytics_charger_count_positive(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/admin/analytics", token=admin_token)
        if code != 200 or not isinstance(data, dict):
            pytest.skip("analytics unavailable")
        total = data.get("totalChargers") or (data.get("chargers") or {}).get("total") or 0
        assert total > 0, f"totalChargers should be > 0, got {total}"

    def test_admin_analytics_providers_structure(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/admin/analytics/providers", token=admin_token)
        assert code == 200, f"GET /api/admin/analytics/providers HTTP {code}: {data}"
        assert isinstance(data, (list, dict)), f"Unexpected type: {type(data)}"
        # If it's a list directly, check the items
        items = data if isinstance(data, list) else data.get("providers", [])
        assert len(items) >= 3, f"Expected at least 3 providers in breakdown, got {len(items)}"
        item = items[0]
        assert "providerName" in item or "name" in item, \
            f"No providerName/name in provider breakdown item: {list(item.keys())}"

    def test_admin_analytics_user_blocked(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, _ = get(f"{GATEWAY}/api/admin/analytics", token=user_token)
        assert code == 403, f"User on /api/admin/analytics should be 403, got {code}"

    # ── System health ──────────────────────────────────────────────────────────

    def test_system_health_200(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/admin/system-health", token=admin_token)
        assert code == 200, f"GET /api/admin/system-health HTTP {code}: {data}"
        assert isinstance(data, dict), f"Expected dict, got {type(data)}"

    def test_system_health_has_services(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/admin/system-health", token=admin_token)
        if code != 200:
            pytest.skip("system-health unavailable")
        # services may be in data["services"] or data["statuses"] or a flat dict
        service_data = data.get("services") or data.get("statuses") or data
        assert isinstance(service_data, (list, dict)), \
            f"No services field in system-health: {list(data.keys())}"
        if isinstance(service_data, list):
            assert len(service_data) >= 6, \
                f"Expected at least 6 services, got {len(service_data)}"

    # ── Proxy: Users ───────────────────────────────────────────────────────────

    def test_admin_users_list(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/admin/users", token=admin_token)
        assert code == 200, f"GET /api/admin/users HTTP {code}"
        assert isinstance(data, list) and len(data) > 0, "Expected non-empty user list"

    def test_admin_users_structure(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/admin/users", token=admin_token)
        if code != 200 or not isinstance(data, list) or not data:
            pytest.skip("user list unavailable")
        item = data[0]
        assert "email" in item, f"email missing from user: {list(item.keys())}"
        has_id = "userId" in item or "id" in item
        assert has_id, f"No userId/id in user: {list(item.keys())}"

    def test_admin_user_by_id_200(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, users = get(f"{GATEWAY}/api/admin/users", token=admin_token)
        if code != 200 or not isinstance(users, list) or not users:
            pytest.skip("user list unavailable")
        uid = users[0].get("userId") or users[0].get("id")
        code2, data = get(f"{GATEWAY}/api/admin/users/{uid}", token=admin_token)
        assert code2 == 200, f"GET /api/admin/users/{uid} HTTP {code2}: {data}"
        assert isinstance(data, dict), "Response not a dict"

    def test_admin_user_nonexistent_404(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/admin/users/999999", token=admin_token)
        assert code == 404, f"Non-existent user should be 404, got {code}: {data}"

    # ── Proxy: Providers ───────────────────────────────────────────────────────

    def test_admin_providers_list(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/admin/providers", token=admin_token)
        assert code == 200, f"GET /api/admin/providers HTTP {code}"
        assert isinstance(data, list) and len(data) >= 3, \
            f"Expected ≥3 providers, got {len(data) if isinstance(data, list) else data}"

    def test_admin_providers_structure(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/admin/providers", token=admin_token)
        if code != 200 or not isinstance(data, list) or not data:
            pytest.skip("provider list unavailable")
        item = data[0]
        assert "providerName" in item, f"providerName missing: {list(item.keys())}"
        assert "providerId" in item, f"providerId missing: {list(item.keys())}"

    def test_admin_provider_by_id_200(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, providers = get(f"{GATEWAY}/api/admin/providers", token=admin_token)
        if code != 200 or not isinstance(providers, list) or not providers:
            pytest.skip("provider list unavailable")
        pid = providers[0].get("providerId")
        code2, data = get(f"{GATEWAY}/api/admin/providers/{pid}", token=admin_token)
        assert code2 == 200, f"GET /api/admin/providers/{pid} HTTP {code2}: {data}"

    def test_admin_provider_nonexistent_404(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/admin/providers/999999", token=admin_token)
        assert code == 404, f"Non-existent provider should be 404, got {code}: {data}"

    def test_admin_provider_update(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        # Use bluePlug (id=1); restore URL after
        code, providers = get(f"{GATEWAY}/api/admin/providers", token=admin_token)
        if code != 200 or not isinstance(providers, list):
            pytest.skip("provider list unavailable")
        blue = next((p for p in providers if p.get("providerName") == "bluePlug"), None)
        if not blue:
            pytest.skip("bluePlug provider not found")
        pid = blue.get("providerId")
        orig_url = blue.get("apiBaseUrl")
        new_url  = "http://updated-admin44.local"
        code2, data = put(f"{GATEWAY}/api/admin/providers/{pid}",
                          {"apiBaseUrl": new_url}, token=admin_token)
        assert code2 == 200, f"PUT /api/admin/providers/{pid} HTTP {code2}: {data}"
        updated_url = data.get("apiBaseUrl")
        # restore
        put(f"{GATEWAY}/api/admin/providers/{pid}",
            {"apiBaseUrl": orig_url}, token=admin_token)
        assert updated_url == new_url, \
            f"apiBaseUrl not updated: got {updated_url}"

    # ── Proxy: Chargers ────────────────────────────────────────────────────────

    def test_admin_chargers_list(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/admin/chargers", token=admin_token)
        assert code == 200, f"GET /api/admin/chargers HTTP {code}"
        assert isinstance(data, list) and len(data) > 0, "Expected non-empty charger list"

    def test_admin_chargers_by_status(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/admin/chargers/status/available",
                         token=admin_token)
        assert code == 200, f"GET /api/admin/chargers/status/available HTTP {code}"
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        for c in data:
            assert c.get("status") == "available", \
                f"Charger {c.get('id')} status={c.get('status')} in available filter"

    def test_admin_charger_by_id(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, chargers = get(f"{GATEWAY}/api/admin/chargers", token=admin_token)
        if code != 200 or not isinstance(chargers, list) or not chargers:
            pytest.skip("charger list unavailable")
        cid = chargers[0].get("id") or chargers[0].get("chargerId")
        code2, data = get(f"{GATEWAY}/api/admin/chargers/{cid}", token=admin_token)
        assert code2 == 200, f"GET /api/admin/chargers/{cid} HTTP {code2}: {data}"
        assert isinstance(data, dict), "Response not a dict"

    # ── Auth enforcement across admin routes ───────────────────────────────────

    def test_user_blocked_from_admin_routes(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, _ = get(f"{GATEWAY}/api/admin/users", token=user_token)
        assert code == 403, f"User on /api/admin/users should be 403, got {code}"

    def test_provider_blocked_from_admin_routes(self, provider_token):
        if not provider_token:
            pytest.skip("provider login failed")
        code, _ = get(f"{GATEWAY}/api/admin/users", token=provider_token)
        assert code == 403, f"Provider on /api/admin/users should be 403, got {code}"

    def test_no_token_blocked_from_admin(self):
        code, _ = get(f"{GATEWAY}/api/admin/users")
        assert code == 401, f"No token on /api/admin/users should be 401, got {code}"
