import pytest
from helpers import get, post, GATEWAY


class TestReservationService:
    SUITE_ID   = 6
    SUITE_NAME = "Reservation Service"

    def test_get_user_reservation_list(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, me = get(f"{GATEWAY}/api/users/me", token=user_token)
        user_id  = me.get("userId") if code == 200 and isinstance(me, dict) else None
        assert user_id is not None, "Could not determine userId from /api/users/me"

        code2, data = get(f"{GATEWAY}/api/reservations/user/{user_id}", token=user_token)
        assert code2 == 200, f"GET /api/reservations/user/{user_id} HTTP {code2}"
        assert isinstance(data, list), f"Expected list, got {type(data)}"

    def test_double_booking_guard(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, chargers = get(f"{GATEWAY}/api/chargers", token=user_token)
        if code != 200 or not isinstance(chargers, list):
            pytest.skip("charger list unavailable")

        avail = [c for c in chargers if c.get("status") == "available"]
        if not avail:
            pytest.skip("no available chargers for double-booking test")

        charger       = avail[0]
        charger_id    = charger.get("chargerId") or charger.get("id")
        provider_name = charger.get("providerName") or "bluePlug"

        code_r, resp_r = post(
            f"{GATEWAY}/api/reservations/",
            {"chargerId": charger_id, "duration": 30, "providerName": provider_name},
            token=user_token,
        )
        if code_r == 201:
            assert code_r == 201, f"First reservation HTTP {code_r}: {resp_r}"
            code_r2, _ = post(
                f"{GATEWAY}/api/reservations/",
                {"chargerId": charger_id, "duration": 15, "providerName": provider_name},
                token=user_token,
            )
            assert code_r2 == 409, \
                f"Second reservation should be 409 (double-booking guard), got HTTP {code_r2}"
        elif code_r == 409:
            # User already has an active reservation — guard is already active
            pass
        else:
            pytest.fail(f"POST /api/reservations/ unexpected HTTP {code_r}: {resp_r}")
