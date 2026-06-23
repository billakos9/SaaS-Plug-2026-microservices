import pytest
from helpers import get, post, GATEWAY


class TestProviderService:
    SUITE_ID   = 5
    SUITE_NAME = "Provider Service"

    def test_admin_can_list_providers(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/providers", token=admin_token)
        assert code == 200, f"GET /api/providers (admin) HTTP {code}"
        assert isinstance(data, list) and len(data) == 3, \
            f"Expected exactly 3 providers, got {len(data) if isinstance(data, list) else type(data)}"

    def test_unauthenticated_list_rejected(self):
        code, _ = get(f"{GATEWAY}/api/providers")
        assert code == 401, f"Expected 401 without token, got HTTP {code}"

    def test_user_cannot_register_provider(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, _ = post(
            f"{GATEWAY}/api/providers/register",
            {"providerName": "test", "email": "t@t.com",
             "apiBaseUrl": "http://x.com", "apiKey": "x"},
            token=user_token,
        )
        assert code == 403, \
            f"POST /api/providers/register with user token should be 403, got HTTP {code}"
