import pytest
from helpers import get, GATEWAY


class TestAdminService:
    SUITE_ID   = 9
    SUITE_NAME = "Admin Service"

    @pytest.mark.parametrize("path", [
        "/api/admin/users",
        "/api/admin/system-health",
    ])
    def test_admin_routes_accessible(self, path, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, _ = get(f"{GATEWAY}{path}", token=admin_token)
        assert code == 200, f"GET {path} (admin) HTTP {code}"

    def test_user_blocked_from_admin_users(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, _ = get(f"{GATEWAY}/api/admin/users", token=user_token)
        assert code == 403, \
            f"GET /api/admin/users with user token should be 403, got HTTP {code}"
