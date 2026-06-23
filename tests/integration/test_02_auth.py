import pytest
from helpers import get, post, GATEWAY, CREDS


class TestAuthentication:
    SUITE_ID   = 2
    SUITE_NAME = "Authentication"

    @pytest.mark.parametrize("role", ["user", "admin", "provider"])
    def test_login_returns_token_and_role(self, role):
        c    = CREDS[role]
        code, data = post(f"{GATEWAY}/api/auth/login",
                          {"email": c["email"], "password": c["password"]})
        token    = data.get("accessToken") or data.get("token") if isinstance(data, dict) else None
        got_role = data.get("role") if isinstance(data, dict) else None
        assert code == 200, f"{role} login HTTP {code}"
        assert bool(token),   f"{role} login: no accessToken in response"
        assert got_role == role, f"{role} login: expected role={role}, got role={got_role}"

    def test_invalid_password_rejected(self):
        code, _ = post(f"{GATEWAY}/api/auth/login",
                       {"email": CREDS["user"]["email"], "password": "wrongpassword"})
        assert 400 <= (code or 0) < 500, f"Expected 4xx for wrong password, got HTTP {code}"

    def test_missing_token_on_protected_route(self):
        code, _ = get(f"{GATEWAY}/api/users/me")
        assert code == 401, f"Expected 401 without token on /api/users/me, got HTTP {code}"
