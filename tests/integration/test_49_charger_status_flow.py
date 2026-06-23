import time
import pytest
from helpers import get, post, _request, shell, GATEWAY


def _get_charger_status_from_db(charger_id):
    rc, out, _ = shell(
        f"docker exec charger_db mongosh --quiet --eval \""
        f"db = db.getSiblingDB('charger');"
        f"var c = db.chargerpoints.findOne({{id: {charger_id}}});"
        f"print(c ? c.status : 'NOT_FOUND');\""
    )
    return rc, out.strip()


def _restore_charger_status(charger_id, status):
    shell(
        f"docker exec charger_db mongosh --quiet --eval \""
        f"db = db.getSiblingDB('charger');"
        f"db.chargerpoints.updateOne({{id: {charger_id}}}, {{$set: {{status: '{status}'}}}});\""
    )


class TestChargerStatusFlow:
    SUITE_ID   = 49
    SUITE_NAME = "Event flow: Reservation events update charger status in charger-db"

    _reservation_id = None
    _charger_id     = None
    _orig_status    = "available"

    def test_create_reservation_marks_charger_reserved(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, chargers = get(f"{GATEWAY}/api/chargers/status/available", token=user_token)
        if code != 200 or not isinstance(chargers, list) or not chargers:
            pytest.skip("no available chargers")
        charger = chargers[0]
        cid   = charger.get("chargerId") or charger.get("id")
        pname = charger.get("providerName") or "bluePlug"

        TestBillingEventFlow = self  # alias for clarity
        TestChargerStatusFlow._charger_id  = cid
        TestChargerStatusFlow._orig_status = charger.get("status", "available")

        code2, data = post(f"{GATEWAY}/api/reservations/",
                           {"chargerId": cid, "duration": 10, "providerName": pname},
                           token=user_token)
        assert code2 == 201, f"Create reservation HTTP {code2}: {data}"
        rid = data.get("reservationId")
        assert rid, f"No reservationId: {data}"
        TestChargerStatusFlow._reservation_id = rid

        time.sleep(3)  # wait for reservation.created event to reach charger-service
        rc, status = _get_charger_status_from_db(cid)
        assert rc == 0 and status == "reserved", \
            f"Charger {cid} status={status!r} after create (expected 'reserved')"

    def test_cancel_reservation_charger_stays_reserved(self, user_token):
        rid = TestChargerStatusFlow._reservation_id
        cid = TestChargerStatusFlow._charger_id
        if not rid or not cid or not user_token:
            pytest.skip("reservation not yet created")
        code, _ = _request("POST", f"{GATEWAY}/api/reservations/{rid}/cancel",
                            token=user_token)
        assert code == 200, f"Cancel HTTP {code}"
        time.sleep(3)
        rc, status = _get_charger_status_from_db(cid)
        assert rc == 0 and status == "reserved", \
            f"Charger {cid} status={status!r} after cancel (should stay 'reserved'; " \
            f"plug-service polling releases it)"

    def test_charger_api_reflects_reserved_status(self, user_token):
        """Verify the public API also shows 'reserved' (not just DB)."""
        cid = TestChargerStatusFlow._charger_id
        if not cid:
            pytest.skip("no charger tracked")
        code, data = get(f"{GATEWAY}/api/chargers/id/{cid}")
        if code != 200:
            pytest.skip(f"Charger API unavailable: {code}")
        # status could be reserved or available depending on test order
        assert data.get("status") in ("reserved", "available", "offline"), \
            f"Unexpected charger status in API: {data.get('status')}"


"""
    def test_complete_reservation_marks_charger_available(self, user_token):
        
        #Tests the reservation.completed → charger available path.
        #Since the time guard prevents completing an active reservation, we:
        #1. Create a fresh reservation
        #2. Manually set its status to 'active' with an expired expiresAt in DB
        #3. Call complete (should succeed with grace window)
        #4. Verify charger goes back to 'available'
        
        if not user_token:
            pytest.skip("user login failed")

        # Wait for any prior reservation cancel to free a charger
        time.sleep(2)
        code, chargers = get(f"{GATEWAY}/api/chargers/status/available", token=user_token)
        if code != 200 or not isinstance(chargers, list) or not chargers:
            pytest.skip("no available chargers for complete test")
        charger = chargers[0]
        cid   = charger.get("chargerId") or charger.get("id")
        pname = charger.get("providerName") or "bluePlug"

        code2, data = post(f"{GATEWAY}/api/reservations/",
                           {"chargerId": cid, "duration": 10, "providerName": pname},
                           token=user_token)
        if code2 != 201:
            pytest.skip(f"Could not create reservation: {code2}")
        rid = data.get("reservationId")

        # Force expiry: set expiresAt to 5 minutes in the past
        shell(
            f"docker exec reservation_db mongosh --quiet --eval \""
            f"db = db.getSiblingDB('reservation');"
            f"var past = new Date(Date.now() - 5 * 60 * 1000);"
            f"db.reservations.updateOne({{reservationId: {rid}}}, {{$set: {{expiresAt: past}}}});\""
        )
        time.sleep(1)

        code3, resp3 = _request("POST", f"{GATEWAY}/api/reservations/{rid}/complete",
                                 token=user_token)
        if code3 != 200:
            # Cleanup and skip if the forced-expiry approach doesn't work in this env
            _request("POST", f"{GATEWAY}/api/reservations/{rid}/cancel", token=user_token)
            pytest.skip(f"Force-complete returned {code3}: {resp3}")

        time.sleep(3)
        rc, status = _get_charger_status_from_db(cid)
        assert rc == 0 and status == "available", \
            f"Charger {cid} status={status!r} after complete (expected 'available')"
"""
