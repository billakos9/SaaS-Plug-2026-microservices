import pytest
from helpers import get, post, shell, GATEWAY


class TestNormalizeReservationDuration:
    SUITE_ID   = 18
    SUITE_NAME = "normalizeReservation Duration Fix (frontend)"

    def test_duration_stored_in_minutes_and_actual_written_on_cancel(self, user_token):
        if not user_token:
            pytest.skip("user login failed")

        code_ch, chargers = get(f"{GATEWAY}/api/chargers", token=user_token)
        assert code_ch == 200, f"GET /api/chargers HTTP {code_ch}"
        avail = [c for c in chargers if c.get("status") == "available"]
        assert avail, "No available chargers"

        charger    = avail[0]
        charger_id = charger.get("chargerId") or charger.get("id")
        provider   = charger.get("providerName") or "bluePlug"

        planned_minutes = 25
        code_r, resp_r  = post(f"{GATEWAY}/api/reservations/",
                               {"chargerId": charger_id, "duration": planned_minutes,
                                "providerName": provider},
                               token=user_token)

        if code_r == 409:
            code_me, me_data = get(f"{GATEWAY}/api/users/me", token=user_token)
            uid = me_data.get("userId") if code_me == 200 and isinstance(me_data, dict) else None
            assert uid, "Could not resolve userId after 409"
            code_u, user_res = get(f"{GATEWAY}/api/reservations/user/{uid}", token=user_token)
            active = [r for r in (user_res if isinstance(user_res, list) else [])
                      if r.get("status") == "active"]
            assert active, "No active reservation found after 409"
            reservation_id  = active[0]["reservationId"]
            planned_minutes = active[0]["duration"]
        elif code_r == 201:
            reservation_id    = resp_r.get("reservationId")
            returned_duration = resp_r.get("duration") if isinstance(resp_r, dict) else None
            assert returned_duration == planned_minutes, \
                f"Backend stored duration={returned_duration}, expected {planned_minutes} minutes"
            actual_dur_sec = resp_r.get("actualDurationSeconds") if isinstance(resp_r, dict) else "MISSING"
            assert actual_dur_sec is None, \
                f"Active reservation should have actualDurationSeconds=null, got {actual_dur_sec!r}"
            assert returned_duration * 60 == planned_minutes * 60, \
                "duration * 60 does not equal expected durationSeconds"
        else:
            pytest.fail(f"POST /api/reservations/ unexpected HTTP {code_r}: {resp_r}")

        code_c, resp_c = post(f"{GATEWAY}/api/reservations/{reservation_id}/cancel",
                              {}, token=user_token)
        assert code_c == 200, f"Cancel HTTP {code_c}: {resp_c}"

        duration_after_cancel = resp_c.get("duration") if isinstance(resp_c, dict) else None
        assert duration_after_cancel == planned_minutes, \
            f"Cancelled reservation: duration={duration_after_cancel} (expected {planned_minutes})"

        rc_db, out_db, err_db = shell(
            f"docker exec reservation_db mongosh --quiet --eval \""
            f"db = db.getSiblingDB('reservation');"
            f"var r = db.reservations.findOne({{reservationId: {reservation_id}}});"
            f"if (r) print(r.actualDurationSeconds);"
            f"else print('NOT_FOUND');\""
        )
        db_val = out_db.strip() if rc_db == 0 else ""
        assert db_val and db_val not in ("NOT_FOUND", "null", "undefined"), \
            f"actualDurationSeconds not written after cancel: rc={rc_db} out={out_db!r}"

    def test_reservation_list_has_created_at(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code_me, me_data = get(f"{GATEWAY}/api/users/me", token=user_token)
        uid = me_data.get("userId") if code_me == 200 and isinstance(me_data, dict) else None
        if not uid:
            pytest.skip("could not resolve userId")
        code_list, res_list = get(f"{GATEWAY}/api/reservations/user/{uid}", token=user_token)
        if code_list != 200 or not isinstance(res_list, list) or not res_list:
            pytest.skip("reservation list unavailable")
        missing = [r.get("reservationId") for r in res_list if not r.get("createdAt")]
        assert not missing, \
            f"{len(missing)} reservation(s) missing createdAt (needed for newest-first sort)"
