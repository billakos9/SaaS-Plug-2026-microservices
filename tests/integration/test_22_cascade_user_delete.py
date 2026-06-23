import time
import pytest
from helpers import get, post, shell, _request, GATEWAY


class TestCascadeUserDelete:
    SUITE_ID   = 22
    SUITE_NAME = "Cascade: user.deleted cancels active reservations (Issue #5)"

    def test_user_delete_cancels_active_reservation(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")

        ts         = int(time.time())
        test_email = f"cascade22.{ts}@saasplug.test"

        code_reg, resp_reg = post(f"{GATEWAY}/api/auth/register",
                                  {"email": test_email, "password": "Casc@2233",
                                   "name": "Cascade22 User"})
        assert code_reg in (200, 201), f"Register HTTP {code_reg}: {resp_reg}"
        new_uid = resp_reg.get("userId") if isinstance(resp_reg, dict) else None

        code_l, resp_l = post(f"{GATEWAY}/api/auth/login",
                              {"email": test_email, "password": "Casc@2233"})
        assert code_l == 200, f"Login HTTP {code_l}"
        user_token = resp_l.get("accessToken") if isinstance(resp_l, dict) else None
        assert user_token, "No accessToken from login"

        if not new_uid:
            _, me = get(f"{GATEWAY}/api/users/me", token=user_token)
            new_uid = me.get("userId") if isinstance(me, dict) else None
        assert new_uid, "Could not determine userId"

        code_ch, chargers = get(f"{GATEWAY}/api/chargers", token=user_token)
        avail = [c for c in (chargers if isinstance(chargers, list) else [])
                 if c.get("status") == "available"]
        if not avail:
            _request("DELETE", f"{GATEWAY}/api/admin/users/{new_uid}", token=admin_token)
            pytest.skip("no available chargers")

        charger    = avail[0]
        charger_id = charger.get("chargerId") or charger.get("id")
        provider   = charger.get("providerName") or "bluePlug"

        code_r, resp_r = post(f"{GATEWAY}/api/reservations/",
                              {"chargerId": charger_id, "duration": 30,
                               "providerName": provider},
                              token=user_token)
        reservation_id = resp_r.get("reservationId") if isinstance(resp_r, dict) else None
        assert code_r == 201 and reservation_id, \
            f"Create reservation HTTP {code_r}: {resp_r}"

        rc_pre, out_pre, _ = shell(
            f"docker exec reservation_db mongosh --quiet --eval \""
            f"db = db.getSiblingDB('reservation');"
            f"var r = db.reservations.findOne({{reservationId: {reservation_id}}});"
            f"print(r ? r.status : 'NOT_FOUND');\""
        )
        assert out_pre.strip() == "active", \
            f"Reservation {reservation_id} pre-delete status='{out_pre.strip()}'"

        code_del, resp_del = _request("DELETE",
                                      f"{GATEWAY}/api/admin/users/{new_uid}",
                                      token=admin_token)
        assert code_del == 200, f"DELETE user HTTP {code_del}: {resp_del}"

        time.sleep(6)

        rc_post, out_post, err_post = shell(
            f"docker exec reservation_db mongosh --quiet --eval \""
            f"db = db.getSiblingDB('reservation');"
            f"var r = db.reservations.findOne({{reservationId: {reservation_id}}});"
            f"print(r ? r.status : 'NOT_FOUND');\""
        )
        assert out_post.strip() == "cancelled", \
            f"Reservation {reservation_id} post-delete status='{out_post.strip()}' " \
            f"(rc={rc_post}, err={err_post!r})"

    def test_outbox_has_user_deleted_entry(self):
        rc, out, _ = shell(
            "docker exec user_db mongosh --quiet --eval \""
            "db = db.getSiblingDB('user');"
            "var c = db.outboxevents.countDocuments({routingKey: 'user.deleted'});"
            "print(c);\""
        )
        try:
            count = int(out.strip())
        except ValueError:
            count = 0
        assert rc == 0 and count >= 1, \
            f"user-db outboxevents: expected >= 1 user.deleted entry, got count={count}"
