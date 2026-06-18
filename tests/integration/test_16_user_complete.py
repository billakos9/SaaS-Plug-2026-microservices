import pytest
from helpers import get, post, GATEWAY


class TestUserInitiatedComplete:
    SUITE_ID   = 16
    SUITE_NAME = "User-Initiated Reservation Complete"

    def test_complete_flow_ownership_and_time_guard(self, user_token, user2_token):
        if not user_token:
            pytest.skip("user login failed")

        code, chargers = get(f"{GATEWAY}/api/chargers", token=user_token)
        available = [c for c in (chargers if isinstance(chargers, list) else [])
                     if c.get("status") == "available"]
        assert available, "No available chargers for complete test"

        charger       = available[0]
        charger_id    = charger.get("chargerId") or charger.get("id")
        provider_name = charger.get("providerName") or "bluePlug"
        assert charger_id, f"Could not extract chargerId from {charger}"

        code_c, res_created = post(
            f"{GATEWAY}/api/reservations/",
            {"chargerId": charger_id, "providerName": provider_name, "duration": 30},
            token=user_token,
        )
        reservation_id = res_created.get("reservationId") if isinstance(res_created, dict) else None
        assert code_c == 201, f"Setup reservation HTTP {code_c}: {res_created}"
        assert reservation_id, "No reservationId in 201 response"

        # Wrong user → 403 (ownership check fires before time guard)
        if user2_token:
            code_403, body_403 = post(
                f"{GATEWAY}/api/reservations/{reservation_id}/complete", {}, token=user2_token
            )
            assert code_403 == 403, \
                f"Wrong user complete should be 403, got HTTP {code_403}: {body_403}"

        # Owner, unexpired session → 400 (time guard)
        code_400, body_400 = post(
            f"{GATEWAY}/api/reservations/{reservation_id}/complete", {}, token=user_token
        )
        assert code_400 == 400, \
            f"Unexpired session complete should be 400 (time guard), got HTTP {code_400}: {body_400}"

        # Cleanup: cancel
        code_cancel, body_cancel = post(
            f"{GATEWAY}/api/reservations/{reservation_id}/cancel", {}, token=user_token
        )
        assert code_cancel == 200, f"Cancel cleanup HTTP {code_cancel}: {body_cancel}"
