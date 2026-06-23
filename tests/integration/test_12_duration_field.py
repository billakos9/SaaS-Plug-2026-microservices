import pytest
from helpers import get, post, shell, _request, GATEWAY


class TestDurationFieldPreservation:
    SUITE_ID   = 12
    SUITE_NAME = "Duration Field Preservation (Issue #14)"

    def test_duration_preserved_and_actual_written_on_cancel(self, user_token, admin_token):
        """
        Create a reservation, cancel it, then verify via MongoDB:
          - duration == original planned minutes (unchanged)
          - actualDurationSeconds is a non-negative integer
        """
        if not user_token:
            pytest.skip("user login failed")

        code, chargers = get(f"{GATEWAY}/api/chargers", token=user_token)
        assert code == 200, f"GET /api/chargers HTTP {code}"
        avail = [c for c in chargers if isinstance(c, dict) and c.get("status") == "available"]
        assert avail, "no available chargers for duration test"

        charger    = avail[0]
        charger_id = charger.get("chargerId") or charger.get("id")
        provider   = charger.get("providerName") or "bluePlug"

        planned_minutes = 45
        code_r, resp_r  = post(f"{GATEWAY}/api/reservations/",
                               {"chargerId": charger_id, "duration": planned_minutes,
                                "providerName": provider},
                               token=user_token)

        if code_r == 409:
            code_m, me = get(f"{GATEWAY}/api/users/me", token=user_token)
            uid = me.get("userId") if code_m == 200 and isinstance(me, dict) else None
            assert uid, "Could not resolve userId after 409"
            code_u, user_res = get(f"{GATEWAY}/api/reservations/user/{uid}", token=user_token)
            active = [r for r in (user_res if isinstance(user_res, list) else [])
                      if r.get("status") == "active"]
            assert active, "No active reservation found after 409"
            reservation_id  = active[0]["reservationId"]
            planned_minutes = active[0]["duration"]
        elif code_r == 201:
            reservation_id = resp_r.get("reservationId")
            assert reservation_id, f"No reservationId in 201 response: {resp_r}"
        else:
            pytest.fail(f"POST /api/reservations/ unexpected HTTP {code_r}: {resp_r}")

        code_c, resp_c = post(f"{GATEWAY}/api/reservations/{reservation_id}/cancel",
                              {}, token=user_token)
        assert code_c == 200, f"Cancel HTTP {code_c}: {resp_c}"

        cancel_duration = resp_c.get("duration") if isinstance(resp_c, dict) else None
        assert cancel_duration == planned_minutes, \
            f"cancel response: duration={cancel_duration}, expected {planned_minutes}"

        rc, out, err = shell(
            f"docker exec reservation_db mongosh --quiet --eval \""
            f"db = db.getSiblingDB('reservation');"
            f"var r = db.reservations.findOne({{reservationId: {reservation_id}}});"
            f"if (r) print(r.actualDurationSeconds + ' ' + r.duration);"
            f"else print('NOT_FOUND');\""
        )
        assert rc == 0 and out.strip() != "NOT_FOUND", \
            f"DB lookup failed: rc={rc} out={out!r} err={err!r}"

        parts = out.strip().split()
        assert len(parts) >= 2, f"Unexpected DB output: {out!r}"
        db_actual = int(parts[0])
        db_dur    = int(parts[1])

        assert db_actual >= 0, f"actualDurationSeconds={db_actual} (expected >= 0)"
        assert db_dur == planned_minutes, \
            f"DB duration={db_dur} (expected {planned_minutes}, unchanged)"
