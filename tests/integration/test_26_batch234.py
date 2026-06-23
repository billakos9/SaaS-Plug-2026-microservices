import pytest
from helpers import get, post, _request, GATEWAY, CREDS


class TestBatch234Changes:
    SUITE_ID   = 26
    SUITE_NAME = "Batch 2/3/4: N17 Adapter Blocks / N18 Admin Seed / N22+N29 PUT Whitelist / N16 JSON Errors / N28+N30 Provider Indexes"

    @pytest.mark.parametrize("path", [
        "/api/adapters/blue/bluePlugAdapter/postReservations",
        "/api/adapters/red/anything",
        "/api/adapters/green/greenPlugAdapter/something",
    ])
    def test_n17_adapter_routes_blocked(self, path):
        code, _ = get(f"{GATEWAY}{path}")
        assert code == 404, f"N17: {path} should be blocked (404), got HTTP {code}"

    def test_n18_admin_seed_login_works(self):
        code, data = post(f"{GATEWAY}/api/auth/login",
                          {"email": "admin@saasplug.app", "password": "123456"})
        got_role  = data.get("role") if isinstance(data, dict) else None
        got_token = bool(data.get("accessToken")) if isinstance(data, dict) else False
        assert code == 200 and got_role == "admin" and got_token, \
            f"N18: admin login HTTP {code}, role={got_role}, token={got_token}"

    def test_n22_n29_put_me_accepts_allowed_fields(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = _request("PUT", f"{GATEWAY}/api/users/me",
                              body={"name": "Whitelist Test", "userId": 99, "role": "admin"},
                              token=user_token)
        assert code == 200, f"N22/N29: PUT /me HTTP {code}"
        assert data.get("name") == "Whitelist Test", \
            f"N22/N29: name not accepted, got name={data.get('name')}"

    def test_n22_n29_put_me_blocks_userid_injection(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = _request("PUT", f"{GATEWAY}/api/users/me",
                              body={"name": "Whitelist Test", "userId": 99, "role": "admin"},
                              token=user_token)
        assert code == 200, f"PUT /me HTTP {code}"
        assert data.get("userId") == 1, \
            f"N22/N29: userId was changed to {data.get('userId')} (expected 1)"

    def test_n22_n29_put_me_blocks_role_injection(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = _request("PUT", f"{GATEWAY}/api/users/me",
                              body={"name": "Whitelist Test", "userId": 99, "role": "admin"},
                              token=user_token)
        assert code == 200, f"PUT /me HTTP {code}"
        assert data.get("role") == "user", \
            f"N22/N29: role was changed to '{data.get('role')}' (expected 'user')"

    def test_n22_n29_put_me_blocks_email_injection(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        original_email = CREDS["user"]["email"]
        code, data = _request("PUT", f"{GATEWAY}/api/users/me",
                              body={"email": "hacked@evil.com"},
                              token=user_token)
        assert code == 200, f"PUT /me (email injection) HTTP {code}"
        assert data.get("email") == original_email, \
            f"N22/N29: email was changed to '{data.get('email')}' (expected '{original_email}')"
        # Restore name to original
        _request("PUT", f"{GATEWAY}/api/users/me",
                 body={"name": "Giorgos Papadopoulos"}, token=user_token)

    def test_n16_provider_not_found_returns_structured_json(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/providers/999999", token=admin_token)
        assert code == 404, f"N16: GET /api/providers/999999 HTTP {code}"
        assert isinstance(data, dict), \
            f"N16: 404 body is not JSON object: {type(data).__name__}"
        has_error = "error" in data or "message" in data or "returnCode" in data
        assert has_error, f"N16: 404 JSON missing error/message/returnCode: {list(data.keys())}"

    def test_n28_n30_all_3_core_providers_present(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/providers", token=admin_token)
        assert code == 200, f"N28/N30: GET /api/providers HTTP {code}"
        assert isinstance(data, list), f"N28/N30: Expected list, got {type(data)}"
        found   = {p.get("providerName") or p.get("name") for p in data}
        missing = {"bluePlug", "redPlug", "greenPlug"} - found
        assert not missing, \
            f"N28/N30: core providers missing after schema rebuild: {missing}"
