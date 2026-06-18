import pytest
from helpers import get, post, _request, GATEWAY


def _has_error_field(data):
    if not isinstance(data, dict):
        return False
    return bool(data.get("error") or data.get("message") or data.get("returnCode"))


class TestErrorConsistency:
    SUITE_ID   = 46
    SUITE_NAME = "Error shape: all 4xx responses return JSON with error/message field"

    # ── 401 responses ─────────────────────────────────────────────────────────

    def test_401_users_me_is_json(self):
        code, data = get(f"{GATEWAY}/api/users/me")
        assert code == 401, f"Expected 401, got {code}"
        assert isinstance(data, dict), \
            f"401 response should be JSON dict, got {type(data).__name__}: {data!r}"

    def test_401_has_message_field(self):
        code, data = get(f"{GATEWAY}/api/users/me")
        if code != 401:
            pytest.skip(f"Expected 401, got {code}")
        assert _has_error_field(data), \
            f"401 JSON missing error/message/returnCode: {list(data.keys()) if isinstance(data, dict) else data}"

    def test_401_admin_route_is_json(self):
        code, data = get(f"{GATEWAY}/api/admin/users")
        assert code == 401, f"Expected 401, got {code}"
        assert isinstance(data, dict), \
            f"401 response on /admin/users should be JSON, got {type(data).__name__}"

    def test_401_reservations_is_json(self):
        code, data = get(f"{GATEWAY}/api/reservations/1")
        assert code == 401, f"Expected 401, got {code}"
        assert isinstance(data, dict), \
            f"401 response should be JSON, got {type(data).__name__}"

    # ── 403 responses ─────────────────────────────────────────────────────────

    def test_403_admin_route_user_token_is_json(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = get(f"{GATEWAY}/api/admin/users", token=user_token)
        assert code == 403, f"Expected 403, got {code}"
        assert isinstance(data, dict), \
            f"403 response should be JSON dict, got {type(data).__name__}: {data!r}"

    def test_403_has_message_field(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = get(f"{GATEWAY}/api/admin/users", token=user_token)
        if code != 403:
            pytest.skip(f"Expected 403, got {code}")
        assert _has_error_field(data), \
            f"403 JSON missing error/message/returnCode: {list(data.keys()) if isinstance(data, dict) else data}"

    def test_403_analytics_user_token_is_json(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = get(f"{GATEWAY}/api/analytics/global", token=user_token)
        assert code == 403, f"Expected 403, got {code}"
        assert isinstance(data, dict), \
            f"403 analytics response should be JSON, got {type(data).__name__}"

    # ── 404 responses ─────────────────────────────────────────────────────────

    def test_404_reservation_is_json(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = get(f"{GATEWAY}/api/reservations/999999", token=user_token)
        assert code == 404, f"Expected 404, got {code}"
        assert isinstance(data, dict), \
            f"404 reservation response should be JSON, got {type(data).__name__}: {data!r}"

    def test_404_reservation_has_message(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = get(f"{GATEWAY}/api/reservations/999999", token=user_token)
        if code != 404:
            pytest.skip(f"Expected 404, got {code}")
        assert _has_error_field(data), \
            f"404 JSON missing error/message/returnCode: {list(data.keys()) if isinstance(data, dict) else data}"

    def test_404_charger_is_json(self):
        code, data = get(f"{GATEWAY}/api/chargers/id/999999")
        assert code == 404, f"Expected 404, got {code}"
        assert isinstance(data, dict), \
            f"404 charger response should be JSON, got {type(data).__name__}: {data!r}"

    def test_404_provider_is_json(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/providers/999999", token=admin_token)
        assert code == 404, f"Expected 404, got {code}"
        assert isinstance(data, dict), \
            f"404 provider response should be JSON, got {type(data).__name__}: {data!r}"

    def test_404_user_is_json(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/admin/users/999999", token=admin_token)
        assert code == 404, f"Expected 404, got {code}"
        assert isinstance(data, dict), \
            f"404 user response should be JSON, got {type(data).__name__}: {data!r}"

    # ── 409 responses ─────────────────────────────────────────────────────────

    def test_409_double_booking_is_json(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, chargers = get(f"{GATEWAY}/api/chargers/status/available",
                             token=user_token)
        if code != 200 or not isinstance(chargers, list) or not chargers:
            pytest.skip("no available charger")
        c1 = chargers[0]
        c2 = chargers[1] if len(chargers) > 1 else chargers[0]
        cid1     = c1.get("chargerId") or c1.get("id")
        cid2     = c2.get("chargerId") or c2.get("id")
        pname1   = c1.get("providerName") or "bluePlug"
        pname2   = c2.get("providerName") or "bluePlug"
        code1, r1 = post(f"{GATEWAY}/api/reservations/",
                          {"chargerId": cid1, "duration": 10, "providerName": pname1},
                          token=user_token)
        if code1 != 201:
            pytest.skip(f"First reservation failed: {code1}")
        rid = r1.get("reservationId")
        try:
            code2, data = post(f"{GATEWAY}/api/reservations/",
                                {"chargerId": cid2, "duration": 10, "providerName": pname2},
                                token=user_token)
            assert code2 == 409, f"Double booking should be 409, got {code2}"
            assert isinstance(data, dict), \
                f"409 response should be JSON dict, got {type(data).__name__}: {data!r}"
            assert _has_error_field(data), \
                f"409 JSON missing error/message: {list(data.keys()) if isinstance(data, dict) else data}"
        finally:
            _request("POST", f"{GATEWAY}/api/reservations/{rid}/cancel", token=user_token)

    # ── Error body is never bare HTML ─────────────────────────────────────────

    def test_error_responses_not_html(self, user_token):
        urls_and_expected = [
            (f"{GATEWAY}/api/users/me", None, 401),
            (f"{GATEWAY}/api/reservations/999999", user_token, 404),
            (f"{GATEWAY}/api/chargers/id/999999", None, 404),
        ]
        for url, token, expected_code in urls_and_expected:
            code, data = get(url, token=token)
            if code != expected_code:
                continue
            # If data is a string, it should not start with "<" (HTML)
            if isinstance(data, str):
                assert not data.lstrip().startswith("<"), \
                    f"Response to {url} looks like HTML: {data[:100]}"
