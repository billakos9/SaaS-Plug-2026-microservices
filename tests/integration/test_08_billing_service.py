import pytest
from helpers import get, GATEWAY


class TestBillingService:
    SUITE_ID   = 8
    SUITE_NAME = "Billing Service"

    def test_provider_gets_own_invoices(self, provider_token):
        if not provider_token:
            pytest.skip("provider login failed")
        code, data = get(f"{GATEWAY}/api/billing/invoices/my", token=provider_token)
        assert code == 200, f"GET /api/billing/invoices/my (provider) HTTP {code}"
        assert isinstance(data, list), f"Expected array, got {type(data)}"

    def test_admin_gets_all_invoices(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/billing/invoices/", token=admin_token)
        assert code == 200, f"GET /api/billing/invoices/ (admin) HTTP {code}"
        assert isinstance(data, list), f"Expected array, got {type(data)}"

    def test_user_blocked_from_invoices(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, _ = get(f"{GATEWAY}/api/billing/invoices/", token=user_token)
        assert code == 403, \
            f"GET /api/billing/invoices/ with user token should be 403, got HTTP {code}"
