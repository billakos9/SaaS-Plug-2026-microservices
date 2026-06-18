import re
import pytest
from helpers import get, post, _request, GATEWAY, CREDS


class TestDataIntegrity:
    SUITE_ID   = 52
    SUITE_NAME = "Data integrity: DTO field stripping / field consistency / schema constraints"

    # ── Provider DTO field stripping ──────────────────────────────────────────

    def test_provider_list_no_api_key(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = get(f"{GATEWAY}/api/providers", token=user_token)
        if code != 200 or not isinstance(data, list):
            pytest.skip("provider list unavailable")
        for p in data:
            assert "apiKey" not in p, \
                f"apiKey exposed for provider '{p.get('providerName')}'"

    def test_provider_list_no_password(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = get(f"{GATEWAY}/api/providers", token=user_token)
        if code != 200 or not isinstance(data, list):
            pytest.skip("provider list unavailable")
        for p in data:
            assert "password" not in p, \
                f"password exposed for provider '{p.get('providerName')}'"

    def test_provider_detail_no_api_key(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, providers = get(f"{GATEWAY}/api/providers", token=admin_token)
        if code != 200 or not isinstance(providers, list) or not providers:
            pytest.skip("provider list unavailable")
        pid = providers[0].get("providerId")
        code2, data = get(f"{GATEWAY}/api/providers/{pid}", token=admin_token)
        if code2 != 200:
            pytest.skip("provider detail unavailable")
        assert "apiKey" not in data, \
            f"apiKey exposed in provider detail: {list(data.keys())}"

    def test_provider_detail_no_password(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, providers = get(f"{GATEWAY}/api/providers", token=admin_token)
        if code != 200 or not isinstance(providers, list) or not providers:
            pytest.skip("provider list unavailable")
        pid = providers[0].get("providerId")
        code2, data = get(f"{GATEWAY}/api/providers/{pid}", token=admin_token)
        if code2 != 200:
            pytest.skip("provider detail unavailable")
        assert "password" not in data, \
            f"password exposed in provider detail: {list(data.keys())}"

    # ── User DTO field stripping ───────────────────────────────────────────────

    def test_user_me_no_password_field(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = get(f"{GATEWAY}/api/users/me", token=user_token)
        if code != 200:
            pytest.skip("GET /me unavailable")
        assert "password" not in data, f"password exposed in /api/users/me response"

    def test_user_list_no_passwords(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/admin/users", token=admin_token)
        if code != 200 or not isinstance(data, list):
            pytest.skip("user list unavailable")
        for u in data:
            assert "password" not in u, \
                f"password exposed for userId={u.get('userId')}"

    # ── Reservation field integrity ────────────────────────────────────────────

    def test_reservation_duration_stored_in_minutes(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, chargers = get(f"{GATEWAY}/api/chargers/status/available",
                             token=user_token)
        if code != 200 or not isinstance(chargers, list) or not chargers:
            pytest.skip("no available charger")
        c    = chargers[0]
        cid  = c.get("chargerId") or c.get("id")
        pname = c.get("providerName") or "bluePlug"
        code2, data = post(f"{GATEWAY}/api/reservations/",
                           {"chargerId": cid, "duration": 15, "providerName": pname},
                           token=user_token)
        if code2 != 201:
            pytest.skip(f"Reservation creation failed: {code2}")
        rid = data.get("reservationId")
        try:
            assert data.get("duration") == 15, \
                f"duration should be 15 (minutes), got {data.get('duration')}"
        finally:
            _request("POST", f"{GATEWAY}/api/reservations/{rid}/cancel",
                     token=user_token)

    def test_reservation_actual_duration_null_on_active(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, chargers = get(f"{GATEWAY}/api/chargers/status/available",
                             token=user_token)
        if code != 200 or not isinstance(chargers, list) or not chargers:
            pytest.skip("no available charger")
        c     = chargers[0]
        cid   = c.get("chargerId") or c.get("id")
        pname = c.get("providerName") or "bluePlug"
        code2, data = post(f"{GATEWAY}/api/reservations/",
                           {"chargerId": cid, "duration": 10, "providerName": pname},
                           token=user_token)
        if code2 != 201:
            pytest.skip(f"Reservation creation failed: {code2}")
        rid = data.get("reservationId")
        try:
            actual = data.get("actualDurationSeconds")
            assert actual is None, \
                f"actualDurationSeconds should be null on active reservation, got {actual}"
        finally:
            _request("POST", f"{GATEWAY}/api/reservations/{rid}/cancel",
                     token=user_token)

    def test_reservation_actual_duration_set_on_cancel(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, chargers = get(f"{GATEWAY}/api/chargers/status/available",
                             token=user_token)
        if code != 200 or not isinstance(chargers, list) or not chargers:
            pytest.skip("no available charger")
        c     = chargers[0]
        cid   = c.get("chargerId") or c.get("id")
        pname = c.get("providerName") or "bluePlug"
        code2, data = post(f"{GATEWAY}/api/reservations/",
                           {"chargerId": cid, "duration": 10, "providerName": pname},
                           token=user_token)
        if code2 != 201:
            pytest.skip(f"Reservation creation failed: {code2}")
        rid = data.get("reservationId")
        code3, cancel_data = _request("POST",
                                       f"{GATEWAY}/api/reservations/{rid}/cancel",
                                       token=user_token)
        assert code3 == 200, f"Cancel HTTP {code3}"
        actual = cancel_data.get("actualDurationSeconds")
        assert actual is not None, \
            f"actualDurationSeconds not set after cancel: {cancel_data}"
        assert isinstance(actual, (int, float)) and actual >= 0, \
            f"actualDurationSeconds should be non-negative: {actual}"

    def test_reservation_duration_not_overwritten_on_cancel(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, chargers = get(f"{GATEWAY}/api/chargers/status/available",
                             token=user_token)
        if code != 200 or not isinstance(chargers, list) or not chargers:
            pytest.skip("no available charger")
        c     = chargers[0]
        cid   = c.get("chargerId") or c.get("id")
        pname = c.get("providerName") or "bluePlug"
        code2, data = post(f"{GATEWAY}/api/reservations/",
                           {"chargerId": cid, "duration": 20, "providerName": pname},
                           token=user_token)
        if code2 != 201:
            pytest.skip(f"Reservation creation failed: {code2}")
        rid = data.get("reservationId")
        code3, cancel_data = _request("POST",
                                       f"{GATEWAY}/api/reservations/{rid}/cancel",
                                       token=user_token)
        assert code3 == 200
        assert cancel_data.get("duration") == 20, \
            f"duration was overwritten on cancel: {cancel_data.get('duration')} (expected 20)"

    # ── Analytics period format ────────────────────────────────────────────────

    def test_analytics_history_periods_are_yyyy_mm(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/analytics/history/global", token=admin_token)
        if code != 200 or not isinstance(data, list) or not data:
            pytest.skip("global history unavailable")
        pattern = re.compile(r"^\d{4}-\d{2}$")
        for item in data[:10]:
            period = item.get("period", "")
            assert pattern.match(str(period)), \
                f"Period '{period}' does not match YYYY-MM format"

    # ── Admin analytics consistency ────────────────────────────────────────────

    def test_admin_analytics_charger_status_sums_to_total(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/admin/analytics", token=admin_token)
        if code != 200 or not isinstance(data, dict):
            pytest.skip("admin analytics unavailable")
        total = data.get("totalChargers") or (data.get("chargers") or {}).get("total")
        by_status = data.get("chargersByStatus") or (data.get("chargers") or {}).get("byStatus")
        if total is None or by_status is None:
            pytest.skip("charger count fields not in analytics response")
        if isinstance(by_status, dict):
            status_sum = sum(v for v in by_status.values() if isinstance(v, (int, float)))
            assert abs(status_sum - total) <= 1, \
                f"chargersByStatus sum={status_sum} != totalChargers={total}"

    # ── Charger list no internal fields ───────────────────────────────────────

    def test_charger_list_no_internal_v_field(self):
        code, data = get(f"{GATEWAY}/api/chargers/")
        if code != 200 or not isinstance(data, list) or not data:
            pytest.skip("charger list unavailable")
        for c in data[:5]:
            assert "__v" not in c, \
                f"__v (Mongoose version key) exposed for charger {c.get('id')}"

    # ── Invoice fee formula precision ─────────────────────────────────────────

    def test_billing_fee_formula_no_float_drift(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/billing/invoices", token=admin_token)
        if code != 200 or not isinstance(data, list) or not data:
            pytest.skip("invoice list unavailable")
        errors = []
        for inv in data[:10]:
            rev      = float(inv.get("totalRevenue", 0))
            sessions = int(inv.get("totalSessions", 0))
            due      = float(inv.get("totalDue", 0))
            expected = round(rev * 0.10 + sessions * 0.30, 2)
            if abs(due - expected) > 0.02:
                errors.append(
                    f"invoiceId={inv.get('invoiceId')}: "
                    f"totalDue={due}, expected≈{expected} "
                    f"(rev={rev}×10% + {sessions}×$0.30)"
                )
        assert not errors, f"Fee formula drift in {len(errors)} invoice(s):\n" + "\n".join(errors)
