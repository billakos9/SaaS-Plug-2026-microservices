import time
import pytest
from helpers import get, post, put, delete, _request, GATEWAY

_TS         = int(time.time())
_TEST_PNAME = f"testProv41_{_TS}"
_TEST_EMAIL = f"prov41_{_TS}@saasplug.test"
_CANONICAL  = {"bluePlug", "redPlug", "greenPlug"}


class TestProviderManagement:
    SUITE_ID   = 41
    SUITE_NAME = "Provider Service: All endpoints + DTO field stripping"

    # ── GET /api/providers ────────────────────────────────────────────────────

    def test_provider_list_with_user_token(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = get(f"{GATEWAY}/api/providers", token=user_token)
        assert code == 200, f"GET /api/providers (user token) HTTP {code}: {data}"
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        assert len(data) > 0, "Provider list is empty"

    def test_provider_list_no_token_returns_401(self):
        code, _ = get(f"{GATEWAY}/api/providers")
        assert code == 401, f"GET /api/providers without token should be 401, got {code}"

    def test_provider_list_structure(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = get(f"{GATEWAY}/api/providers", token=user_token)
        if code != 200 or not isinstance(data, list) or not data:
            pytest.skip("provider list unavailable")
        item = data[0]
        for field in ("providerId", "providerName", "email", "apiBaseUrl"):
            assert field in item, f"Field '{field}' missing from provider: {list(item.keys())}"

    def test_provider_list_no_api_key(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = get(f"{GATEWAY}/api/providers", token=user_token)
        if code != 200 or not isinstance(data, list):
            pytest.skip("provider list unavailable")
        for p in data:
            assert "apiKey" not in p, \
                f"apiKey exposed in provider list for '{p.get('providerName')}'"

    def test_provider_list_no_password(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = get(f"{GATEWAY}/api/providers", token=user_token)
        if code != 200 or not isinstance(data, list):
            pytest.skip("provider list unavailable")
        for p in data:
            assert "password" not in p, \
                f"password exposed in provider list for '{p.get('providerName')}'"

    def test_provider_list_canonical_providers_present(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/providers", token=admin_token)
        if code != 200 or not isinstance(data, list):
            pytest.skip("provider list unavailable")
        found = {p.get("providerName") for p in data}
        missing = _CANONICAL - found
        assert not missing, f"Canonical providers missing: {missing}"

    # ── GET /api/providers/:id ────────────────────────────────────────────────

    def test_provider_get_by_id(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, providers = get(f"{GATEWAY}/api/providers", token=admin_token)
        if code != 200 or not isinstance(providers, list) or not providers:
            pytest.skip("provider list unavailable")
        pid = providers[0].get("providerId")
        assert pid is not None, "No providerId in provider list"
        code2, data = get(f"{GATEWAY}/api/providers/{pid}", token=admin_token)
        assert code2 == 200, f"GET /api/providers/{pid} HTTP {code2}: {data}"
        assert isinstance(data, dict), f"Response not a dict: {data}"
        assert data.get("providerId") == pid, \
            f"Returned providerId={data.get('providerId')} != requested {pid}"

    def test_provider_get_by_id_no_api_key(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, providers = get(f"{GATEWAY}/api/providers", token=admin_token)
        if code != 200 or not isinstance(providers, list) or not providers:
            pytest.skip("provider list unavailable")
        pid = providers[0].get("providerId")
        code2, data = get(f"{GATEWAY}/api/providers/{pid}", token=admin_token)
        if code2 != 200:
            pytest.skip("provider GET failed")
        assert "apiKey" not in data, \
            f"apiKey exposed in provider detail response: {list(data.keys())}"

    def test_provider_get_nonexistent_returns_404(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/providers/999999", token=admin_token)
        assert code == 404, f"Non-existent provider should be 404, got {code}: {data}"
        assert isinstance(data, dict), "404 body should be dict"

    # ── POST /api/admin/providers (create) ────────────────────────────────────

    def test_provider_create_success(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = post(f"{GATEWAY}/api/admin/providers",
                          {"providerName": _TEST_PNAME, "email": _TEST_EMAIL,
                           "password": "Prov41@pass", "apiBaseUrl": "http://test41.local",
                           "apiKey": "testkey41"},
                          token=admin_token)
        assert code == 201, f"POST /api/admin/providers HTTP {code}: {data}"
        assert isinstance(data, dict), f"Response not a dict: {data}"

    def test_provider_create_missing_providerName_returns_4xx(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = post(f"{GATEWAY}/api/admin/providers",
                          {"email": f"nopname_{_TS}@test.local",
                           "apiBaseUrl": "http://test.local", "apiKey": "k"},
                          token=admin_token)
        assert code >= 400, f"Create without providerName should fail, got {code}: {data}"

    def test_provider_create_missing_apiBaseUrl_returns_4xx(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = post(f"{GATEWAY}/api/admin/providers",
                          {"providerName": f"nourl_{_TS}", "email": f"nourl_{_TS}@test.local",
                           "apiKey": "k"},
                          token=admin_token)
        assert code >= 400, f"Create without apiBaseUrl should fail, got {code}: {data}"

    def test_provider_user_token_cannot_create(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, _ = post(f"{GATEWAY}/api/admin/providers",
                       {"providerName": "blocked", "email": "x@y.com",
                        "apiBaseUrl": "http://x.local", "apiKey": "k"},
                       token=user_token)
        assert code == 403, f"User token on POST /admin/providers should be 403, got {code}"

    # ── PUT /api/admin/providers/:id (update) ─────────────────────────────────

    def test_provider_update_apiBaseUrl(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        # find the test provider
        code, providers = get(f"{GATEWAY}/api/providers", token=admin_token)
        if code != 200 or not isinstance(providers, list):
            pytest.skip("provider list unavailable")
        test_prov = next((p for p in providers if p.get("providerName") == _TEST_PNAME), None)
        if not test_prov:
            pytest.skip(f"Test provider '{_TEST_PNAME}' not found")
        pid = test_prov.get("providerId")
        new_url = "http://updated41.local"
        code2, data = put(f"{GATEWAY}/api/admin/providers/{pid}",
                          {"apiBaseUrl": new_url}, token=admin_token)
        assert code2 == 200, f"PUT /api/admin/providers/{pid} HTTP {code2}: {data}"
        assert data.get("apiBaseUrl") == new_url, \
            f"apiBaseUrl not updated: {data.get('apiBaseUrl')}"

    def test_provider_update_nonexistent_returns_404(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = put(f"{GATEWAY}/api/admin/providers/999999",
                         {"apiBaseUrl": "http://x.local"}, token=admin_token)
        assert code == 404, f"Update non-existent provider should be 404, got {code}: {data}"

    # ── DELETE /api/admin/providers/delete/:id ────────────────────────────────

    def test_provider_delete_nonexistent_returns_404(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = _request("DELETE", f"{GATEWAY}/api/admin/providers/delete/999999",
                               token=admin_token)
        assert code == 404, f"Delete non-existent provider should be 404, got {code}: {data}"

    # ── Cleanup ───────────────────────────────────────────────────────────────

    def test_zzz_cleanup(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, providers = get(f"{GATEWAY}/api/providers", token=admin_token)
        if code != 200 or not isinstance(providers, list):
            return
        test_prov = next((p for p in providers if p.get("providerName") == _TEST_PNAME), None)
        if test_prov:
            pid = test_prov.get("providerId")
            _request("DELETE", f"{GATEWAY}/api/admin/providers/delete/{pid}",
                     token=admin_token)
