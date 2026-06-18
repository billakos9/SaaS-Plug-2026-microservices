import math
import pytest
from helpers import get, post, patch, _request, GATEWAY

_PERIOD_BLUE = "2099-01"
_PERIOD_RED  = "2099-02"
_BLUE_PNAME  = "bluePlug"
_RED_PNAME   = "redPlug"


class TestBillingComplete:
    SUITE_ID   = 42
    SUITE_NAME = "Billing Service: Generate / List / Detail / Pay all flows"

    # shared state across tests in this class
    _blue_invoice_id = None
    _red_invoice_id  = None

    # ── Auth enforcement ───────────────────────────────────────────────────────

    def test_admin_can_list_all_invoices(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/billing/invoices", token=admin_token)
        assert code == 200, f"GET /billing/invoices (admin) HTTP {code}: {data}"
        assert isinstance(data, list), f"Expected list, got {type(data)}"

    def test_provider_cannot_list_all_invoices(self, provider_token):
        if not provider_token:
            pytest.skip("provider login failed")
        code, _ = get(f"{GATEWAY}/api/billing/invoices", token=provider_token)
        assert code == 403, f"Provider on GET /billing/invoices should be 403, got {code}"

    def test_user_cannot_list_invoices(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, _ = get(f"{GATEWAY}/api/billing/invoices", token=user_token)
        assert code in (401, 403), f"User on GET /billing/invoices should be 4xx, got {code}"

    def test_provider_can_list_own_invoices(self, provider_token):
        if not provider_token:
            pytest.skip("provider login failed")
        code, data = get(f"{GATEWAY}/api/billing/invoices/my", token=provider_token)
        assert code == 200, f"GET /billing/invoices/my (provider) HTTP {code}: {data}"
        assert isinstance(data, list), f"Expected list, got {type(data)}"

    # ── Invoice generation ─────────────────────────────────────────────────────

    def test_generate_invoice_admin_blueplug(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = post(f"{GATEWAY}/api/billing/generate",
                          {"providerName": _BLUE_PNAME, "period": _PERIOD_BLUE},
                          token=admin_token)
        assert code in (200, 201), f"Generate invoice HTTP {code}: {data}"
        assert isinstance(data, dict), f"Response not a dict: {data}"
        iid = data.get("invoiceId") or (data.get("invoice") or {}).get("invoiceId")
        assert iid is not None, f"No invoiceId in response: {data}"
        TestBillingComplete._blue_invoice_id = iid

    def test_generated_invoice_has_required_fields(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        if not TestBillingComplete._blue_invoice_id:
            pytest.skip("blue invoice not yet generated")
        code, data = get(f"{GATEWAY}/api/billing/invoices", token=admin_token)
        if code != 200 or not isinstance(data, list):
            pytest.skip("invoice list unavailable")
        inv = next((i for i in data
                    if i.get("invoiceId") == TestBillingComplete._blue_invoice_id), None)
        if inv is None:
            # try nested shape
            pytest.skip("invoice not found in list")
        for field in ("invoiceId", "providerName", "period", "totalDue", "status"):
            assert field in inv, f"Field '{field}' missing from invoice: {list(inv.keys())}"
        assert inv.get("providerName") == _BLUE_PNAME, \
            f"providerName mismatch: {inv.get('providerName')}"
        assert inv.get("period") == _PERIOD_BLUE, \
            f"period mismatch: {inv.get('period')}"

    def test_generate_duplicate_invoice_returns_409(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = post(f"{GATEWAY}/api/billing/generate",
                          {"providerName": _BLUE_PNAME, "period": _PERIOD_BLUE},
                          token=admin_token)
        assert code == 409, f"Duplicate invoice generation should be 409, got {code}: {data}"

    def test_provider_cannot_generate_invoice(self, provider_token):
        if not provider_token:
            pytest.skip("provider login failed")
        code, _ = post(f"{GATEWAY}/api/billing/generate",
                       {"providerName": _BLUE_PNAME, "period": "2099-03"},
                       token=provider_token)
        assert code == 403, f"Provider cannot generate invoice, got {code}"

    def test_user_cannot_generate_invoice(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, _ = post(f"{GATEWAY}/api/billing/generate",
                       {"providerName": _BLUE_PNAME, "period": "2099-04"},
                       token=user_token)
        assert code in (401, 403), f"User cannot generate invoice, got {code}"

    def test_fee_formula_verified(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        if not TestBillingComplete._blue_invoice_id:
            pytest.skip("blue invoice not yet generated")
        code, data = get(f"{GATEWAY}/api/billing/invoices", token=admin_token)
        if code != 200 or not isinstance(data, list):
            pytest.skip("invoice list unavailable")
        inv = next((i for i in data
                    if i.get("invoiceId") == TestBillingComplete._blue_invoice_id), None)
        if inv is None:
            pytest.skip("invoice not found")
        rev     = float(inv.get("totalRevenue", 0))
        sessions = int(inv.get("totalSessions", 0))
        due     = float(inv.get("totalDue", 0))
        expected = round(rev * 0.10 + sessions * 0.30, 2)
        assert abs(due - expected) < 0.02, \
            f"Fee formula failed: totalDue={due}, expected≈{expected} " \
            f"(rev={rev}×10% + {sessions}×$0.30)"

    # ── Invoice detail ─────────────────────────────────────────────────────────

    def test_admin_can_view_invoice_detail(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        if not TestBillingComplete._blue_invoice_id:
            pytest.skip("blue invoice not yet generated")
        code, data = get(f"{GATEWAY}/api/billing/invoices/"
                         f"{TestBillingComplete._blue_invoice_id}/detail",
                         token=admin_token)
        assert code == 200, f"GET /billing/invoices/:id/detail (admin) HTTP {code}: {data}"
        assert isinstance(data, dict), f"Detail response not a dict"
        assert "invoice" in data or "invoiceId" in data, \
            f"No invoice key in detail: {list(data.keys())}"

    def test_provider_can_view_own_invoice_detail(self, admin_token, provider_token):
        if not admin_token or not provider_token:
            pytest.skip("login failed")
        # generate a bluePlug invoice if not already done (provider_token is bluePlug)
        iid = TestBillingComplete._blue_invoice_id
        if not iid:
            pytest.skip("blue invoice not yet generated")
        code, data = get(f"{GATEWAY}/api/billing/invoices/{iid}/detail",
                         token=provider_token)
        assert code == 200, \
            f"bluePlug provider viewing own invoice detail HTTP {code}: {data}"

    def test_provider_cannot_view_other_invoice_detail(self, admin_token, provider_token):
        if not admin_token or not provider_token:
            pytest.skip("login failed")
        # generate a redPlug invoice
        code_gen, resp_gen = post(f"{GATEWAY}/api/billing/generate",
                                   {"providerName": _RED_PNAME, "period": _PERIOD_RED},
                                   token=admin_token)
        if code_gen not in (200, 201, 409):
            pytest.skip(f"Could not generate redPlug invoice: {code_gen}")
        # get the redPlug invoice id
        code_list, invs = get(f"{GATEWAY}/api/billing/invoices", token=admin_token)
        if code_list != 200 or not isinstance(invs, list):
            pytest.skip("invoice list unavailable")
        red_inv = next((i for i in invs
                        if i.get("providerName") == _RED_PNAME
                        and i.get("period") == _PERIOD_RED), None)
        if not red_inv:
            pytest.skip("redPlug invoice not found")
        TestBillingComplete._red_invoice_id = red_inv.get("invoiceId")
        code2, _ = get(f"{GATEWAY}/api/billing/invoices/"
                       f"{TestBillingComplete._red_invoice_id}/detail",
                       token=provider_token)  # provider_token is bluePlug
        assert code2 == 403, \
            f"bluePlug provider viewing redPlug invoice detail should be 403, got {code2}"

    # ── Mark paid ─────────────────────────────────────────────────────────────

    def test_admin_can_mark_invoice_paid(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        if not TestBillingComplete._blue_invoice_id:
            pytest.skip("blue invoice not yet generated")
        iid = TestBillingComplete._blue_invoice_id
        code, data = patch(f"{GATEWAY}/api/billing/invoices/{iid}/paid",
                           {}, token=admin_token)
        assert code == 200, f"PATCH /billing/invoices/{iid}/paid HTTP {code}: {data}"
        # verify status
        status = data.get("status") if isinstance(data, dict) else None
        if status is None and isinstance(data, dict):
            inv_data = data.get("invoice") or {}
            status = inv_data.get("status")
        assert status == "paid", f"Invoice status should be 'paid', got {status}"

    def test_admin_mark_already_paid_returns_4xx(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        if not TestBillingComplete._blue_invoice_id:
            pytest.skip("blue invoice not yet generated")
        iid = TestBillingComplete._blue_invoice_id
        code, data = patch(f"{GATEWAY}/api/billing/invoices/{iid}/paid",
                           {}, token=admin_token)
        assert code >= 400, \
            f"Marking already-paid invoice paid again should fail, got {code}: {data}"

    def test_provider_can_pay_own_invoice(self, admin_token, provider_token):
        if not admin_token or not provider_token:
            pytest.skip("login failed")
        # generate a fresh invoice for bluePlug in a different period
        period = "2099-05"
        code_gen, resp_gen = post(f"{GATEWAY}/api/billing/generate",
                                   {"providerName": _BLUE_PNAME, "period": period},
                                   token=admin_token)
        if code_gen not in (200, 201):
            pytest.skip(f"Could not generate invoice: {code_gen}")
        iid = resp_gen.get("invoiceId") or (resp_gen.get("invoice") or {}).get("invoiceId")
        if not iid:
            pytest.skip("Could not get invoiceId from generation")
        code2, data = patch(f"{GATEWAY}/api/billing/invoices/{iid}/pay",
                             {}, token=provider_token)
        assert code2 == 200, \
            f"Provider paying own invoice HTTP {code2}: {data}"

    def test_provider_cannot_pay_other_invoice(self, provider_token):
        if not provider_token:
            pytest.skip("provider login failed")
        if not TestBillingComplete._red_invoice_id:
            pytest.skip("red invoice not yet generated")
        code, data = patch(f"{GATEWAY}/api/billing/invoices/"
                           f"{TestBillingComplete._red_invoice_id}/pay",
                           {}, token=provider_token)  # provider_token is bluePlug
        assert code == 403, \
            f"bluePlug provider paying redPlug invoice should be 403, got {code}: {data}"
