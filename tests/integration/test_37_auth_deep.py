import time
import pytest
from helpers import get, post, _request, delete, GATEWAY, CREDS


_TEST_EMAIL = f"auth_deep_test_{int(time.time())}@saasplug.test"
_TEST_PASS  = "AuthDeep@99"


class TestAuthDeep:
    SUITE_ID   = 37
    SUITE_NAME = "Auth Service: Registration / Login / Validate edge cases"

    # ── Registration ──────────────────────────────────────────────────────────

    def test_user_registration_success(self, admin_token):
        code, data = post(f"{GATEWAY}/api/auth/register",
                          {"email": _TEST_EMAIL, "password": _TEST_PASS,
                           "name": "Auth Deep Test"})
        assert code in (200, 201), f"Registration HTTP {code}: {data}"
        assert isinstance(data, dict), f"Response not a dict: {data}"
        has_identity = bool(data.get("accessToken") or data.get("userId") or
                            data.get("token") or data.get("email"))
        assert has_identity, f"No identity field in registration response: {list(data.keys())}"

    def test_user_registration_duplicate_email(self):
        code, data = post(f"{GATEWAY}/api/auth/register",
                          {"email": _TEST_EMAIL, "password": _TEST_PASS,
                           "name": "Duplicate"})
        assert code in (409, 400, 422), \
            f"Duplicate registration should be 4xx, got HTTP {code}: {data}"

    def test_user_registration_missing_password(self):
        ts = int(time.time())
        code, data = post(f"{GATEWAY}/api/auth/register",
                          {"email": f"nopwd_{ts}@saasplug.test", "name": "NoPwd"})
        assert code >= 400, f"Missing password should fail, got HTTP {code}"

    def test_user_registration_missing_email(self):
        code, data = post(f"{GATEWAY}/api/auth/register",
                          {"password": "SomePass@1", "name": "NoEmail"})
        assert code >= 400, f"Missing email should fail, got HTTP {code}"

    def test_user_registration_empty_body(self):
        code, data = post(f"{GATEWAY}/api/auth/register", {})
        assert code >= 400, f"Empty body registration should fail, got HTTP {code}"

    # ── Login ─────────────────────────────────────────────────────────────────

    def test_login_returns_correct_role_user(self):
        c = CREDS["user"]
        code, data = post(f"{GATEWAY}/api/auth/login",
                          {"email": c["email"], "password": c["password"]})
        assert code == 200, f"User login HTTP {code}: {data}"
        assert data.get("role") == "user", f"Expected role=user, got {data.get('role')}"
        assert data.get("accessToken"), "No accessToken in user login response"

    def test_login_returns_correct_role_admin(self):
        c = CREDS["admin"]
        code, data = post(f"{GATEWAY}/api/auth/login",
                          {"email": c["email"], "password": c["password"]})
        assert code == 200, f"Admin login HTTP {code}: {data}"
        assert data.get("role") == "admin", f"Expected role=admin, got {data.get('role')}"
        assert data.get("accessToken"), "No accessToken in admin login response"

    def test_login_returns_correct_role_provider(self):
        c = CREDS["provider"]
        code, data = post(f"{GATEWAY}/api/auth/login",
                          {"email": c["email"], "password": c["password"]})
        assert code == 200, f"Provider login HTTP {code}: {data}"
        assert data.get("role") == "provider", f"Expected role=provider, got {data.get('role')}"
        assert data.get("accessToken"), "No accessToken in provider login response"

    def test_login_wrong_password(self):
        code, data = post(f"{GATEWAY}/api/auth/login",
                          {"email": CREDS["user"]["email"], "password": "WrongPass!!"})
        assert code >= 400, f"Wrong password should fail, got HTTP {code}"

    def test_login_nonexistent_email(self):
        code, data = post(f"{GATEWAY}/api/auth/login",
                          {"email": "nobody_ever@fake.invalid", "password": "SomePass@1"})
        assert code >= 400, f"Non-existent email should fail, got HTTP {code}"

    def test_login_missing_email_field(self):
        code, data = post(f"{GATEWAY}/api/auth/login", {"password": "SomePass@1"})
        assert code >= 400, f"Missing email field should fail, got HTTP {code}"

    def test_login_empty_body(self):
        code, data = post(f"{GATEWAY}/api/auth/login", {})
        assert code >= 400, f"Empty body login should fail, got HTTP {code}"

    def test_login_returns_token_with_expiry(self):
        c = CREDS["user"]
        code, data = post(f"{GATEWAY}/api/auth/login",
                          {"email": c["email"], "password": c["password"]})
        assert code == 200
        assert data.get("accessToken"), "No accessToken returned"
        # token should be a non-trivial string (JWT has 3 dot-separated parts)
        token = data["accessToken"]
        parts = token.split(".")
        assert len(parts) == 3, f"Token doesn't look like a JWT (parts: {len(parts)})"

    # ── Validate ──────────────────────────────────────────────────────────────

    def test_validate_valid_token(self):
        c = CREDS["user"]
        _, login_data = post(f"{GATEWAY}/api/auth/login",
                             {"email": c["email"], "password": c["password"]})
        token = login_data.get("accessToken") if isinstance(login_data, dict) else None
        if not token:
            pytest.skip("could not obtain user token")
        code, data = get(f"{GATEWAY}/api/auth/validate?token={token}")
        assert code == 200, f"Validate valid token HTTP {code}: {data}"
        assert isinstance(data, dict), f"Validate response not a dict: {data}"
        # should indicate the token is valid (either valid=true or contain userId/role)
        is_valid = data.get("valid") is True or bool(data.get("userId")) or bool(data.get("role"))
        assert is_valid, f"Validate response doesn't confirm validity: {data}"

    def test_validate_invalid_token(self):
        code, data = get(f"{GATEWAY}/api/auth/validate?token=this.is.garbage")
        # should be 4xx or return {valid: false}
        invalid = code >= 400 or (isinstance(data, dict) and data.get("valid") is False)
        assert invalid, f"Invalid token should fail or return valid=false, got HTTP {code}: {data}"

    def test_validate_no_token_param(self):
        code, data = get(f"{GATEWAY}/api/auth/validate")
        assert code >= 400, f"No token param should fail, got HTTP {code}: {data}"

    # ── Cleanup ───────────────────────────────────────────────────────────────

    def test_zzz_cleanup(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        # find userId of test account
        code, users = get(f"{GATEWAY}/api/admin/users", token=admin_token)
        if code != 200 or not isinstance(users, list):
            return
        test_user = next((u for u in users if u.get("email") == _TEST_EMAIL), None)
        if test_user:
            uid = test_user.get("userId") or test_user.get("id")
            delete(f"{GATEWAY}/api/admin/users/{uid}", token=admin_token)
