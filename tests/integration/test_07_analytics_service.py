import pytest
from helpers import get, GATEWAY


class TestAnalyticsService:
    SUITE_ID   = 7
    SUITE_NAME = "Analytics Service"

    def test_user_blocked_from_global_analytics(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, _ = get(f"{GATEWAY}/api/analytics/global", token=user_token)
        assert code == 403, \
            f"GET /api/analytics/global with user token should be 403, got HTTP {code}"

    def test_admin_gets_global_analytics(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/analytics/global", token=admin_token)
        assert code == 200, f"GET /api/analytics/global (admin) HTTP {code}"
        assert isinstance(data, dict), f"Expected dict response, got {type(data)}"
