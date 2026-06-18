import time
import pytest
from helpers import get, post, _request, shell, GATEWAY


def _get_available_charger(token):
    code, chargers = get(f"{GATEWAY}/api/chargers/status/available", token=token)
    if code == 200 and isinstance(chargers, list) and chargers:
        return chargers[0]
    return None


def _check_billing_db(reservation_id):
    rc, out, _ = shell(
        f"docker exec billing_db mongosh --quiet --eval \""
        f"db = db.getSiblingDB('billing');"
        f"var d = db.billedreservations.findOne({{reservationId: {reservation_id}}});"
        f"print(d ? JSON.stringify({{status: d.status, reservationId: d.reservationId,"
        f" providerName: d.providerName, userId: d.userId, createdAt: d.createdAt}}) : 'NOT_FOUND');\""
    )
    return rc, out.strip()


class TestBillingEventFlow:
    SUITE_ID   = 48
    SUITE_NAME = "Event flow: Reservation events land in billing-db BilledReservation"

    _reservation_id = None
    _charger_id     = None

    def test_create_reservation_creates_billed_snapshot(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        charger = _get_available_charger(user_token)
        if not charger:
            pytest.skip("no available charger")
        cid    = charger.get("chargerId") or charger.get("id")
        pname  = charger.get("providerName") or "bluePlug"
        code, data = post(f"{GATEWAY}/api/reservations/",
                          {"chargerId": cid, "duration": 10, "providerName": pname},
                          token=user_token)
        assert code == 201, f"Create reservation HTTP {code}: {data}"
        rid = data.get("reservationId")
        assert rid, f"No reservationId in response: {data}"
        TestBillingEventFlow._reservation_id = rid
        TestBillingEventFlow._charger_id     = cid
        time.sleep(3)
        rc, out = _check_billing_db(rid)
        assert rc == 0 and out != "NOT_FOUND", \
            f"BilledReservation for {rid} not found in billing-db after 3s (out={out!r})"

    def test_billed_snapshot_status_active(self):
        rid = TestBillingEventFlow._reservation_id
        if not rid:
            pytest.skip("reservation not yet created")
        rc, out = _check_billing_db(rid)
        if out == "NOT_FOUND":
            pytest.skip("BilledReservation not found")
        import json
        try:
            doc = json.loads(out)
        except Exception:
            pytest.skip(f"Could not parse billing doc: {out}")
        assert doc.get("status") == "active", \
            f"BilledReservation status={doc.get('status')} (expected 'active')"

    def test_billed_snapshot_has_provider_and_user(self):
        rid = TestBillingEventFlow._reservation_id
        if not rid:
            pytest.skip("reservation not yet created")
        rc, out = _check_billing_db(rid)
        if out == "NOT_FOUND":
            pytest.skip("BilledReservation not found")
        import json
        try:
            doc = json.loads(out)
        except Exception:
            pytest.skip(f"Could not parse billing doc: {out}")
        assert doc.get("providerName"), f"providerName missing: {doc}"
        assert doc.get("userId") is not None, f"userId missing: {doc}"

    def test_billed_snapshot_full_fields(self, admin_token):
        rid = TestBillingEventFlow._reservation_id
        if not rid:
            pytest.skip("reservation not yet created")
        rc, out, _ = shell(
            f"docker exec billing_db mongosh --quiet --eval \""
            f"db = db.getSiblingDB('billing');"
            f"var d = db.billedreservations.findOne({{reservationId: {rid}}});"
            f"if (!d) {{ print('NOT_FOUND'); }} else {{"
            f"  var ok = d.reservationId !== undefined && d.userId !== undefined"
            f"           && d.providerName && d.originalDurationMinutes !== undefined"
            f"           && d.status && d.createdAt;"
            f"  print(ok ? 'OK' : 'MISSING:' + JSON.stringify({{"
            f"    rid:!!d.reservationId, uid:!!d.userId, pname:!!d.providerName,"
            f"    dur:d.originalDurationMinutes!==undefined, status:!!d.status,"
            f"    cat:!!d.createdAt"
            f"  }}));"
            f"}}\""
        )
        result = out.strip()
        assert rc == 0 and result == "OK", \
            f"BilledReservation {rid} missing required fields: {result}"

    def test_cancel_reservation_updates_billed_snapshot(self, user_token):
        rid = TestBillingEventFlow._reservation_id
        if not rid or not user_token:
            pytest.skip("reservation not yet created or user login failed")
        code, _ = _request("POST", f"{GATEWAY}/api/reservations/{rid}/cancel",
                            token=user_token)
        assert code == 200, f"Cancel HTTP {code}"
        time.sleep(3)
        rc, out, _ = shell(
            f"docker exec billing_db mongosh --quiet --eval \""
            f"db = db.getSiblingDB('billing');"
            f"var d = db.billedreservations.findOne({{reservationId: {rid}}});"
            f"print(d ? d.status : 'NOT_FOUND');\""
        )
        status = out.strip()
        assert status == "cancelled", \
            f"BilledReservation {rid} status={status!r} after cancel (expected 'cancelled')"

    def test_billed_snapshot_actual_duration_set_after_cancel(self):
        rid = TestBillingEventFlow._reservation_id
        if not rid:
            pytest.skip("reservation not yet created")
        rc, out, _ = shell(
            f"docker exec billing_db mongosh --quiet --eval \""
            f"db = db.getSiblingDB('billing');"
            f"var d = db.billedreservations.findOne({{reservationId: {rid}}});"
            f"print(d ? (d.actualDurationSeconds !== undefined && d.actualDurationSeconds !== null"
            f"           ? 'SET' : 'NULL') : 'NOT_FOUND');\""
        )
        result = out.strip()
        assert result == "SET", \
            f"actualDurationSeconds not set after cancel for reservation {rid} (got {result!r})"

    def test_billing_event_idempotent_upsert(self):
        rid = TestBillingEventFlow._reservation_id
        if not rid:
            pytest.skip("reservation not yet created")
        # Count billed reservations with this reservationId — should be exactly 1
        rc, out, _ = shell(
            f"docker exec billing_db mongosh --quiet --eval \""
            f"db = db.getSiblingDB('billing');"
            f"print(db.billedreservations.countDocuments({{reservationId: {rid}}}));\""
        )
        try:
            count = int(out.strip())
        except ValueError:
            count = -1
        assert count == 1, \
            f"Expected exactly 1 BilledReservation for {rid}, found {count}"
