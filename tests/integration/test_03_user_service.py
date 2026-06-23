import pytest
from helpers import get, GATEWAY


class TestUserService:
    SUITE_ID   = 3
    SUITE_NAME = "User Service"

    def test_get_me_returns_profile(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = get(f"{GATEWAY}/api/users/me", token=user_token)
        assert code == 200, f"GET /api/users/me HTTP {code}"
        assert isinstance(data, dict), f"Expected dict, got {type(data)}"
        assert "userId" in data and "email" in data, f"Missing userId or email: {data}"

    def test_admin_can_list_users(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/admin/users", token=admin_token)
        assert code == 200, f"GET /api/admin/users HTTP {code}"
        assert isinstance(data, list) and len(data) > 0, \
            f"Expected non-empty list, got {type(data)} len={len(data) if isinstance(data, list) else '?'}"
