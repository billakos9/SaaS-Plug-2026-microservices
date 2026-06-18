import time
import pytest
from helpers import get, post, _request, GATEWAY, CREDS


def _login(email, password):
    code, data = post(f"{GATEWAY}/api/auth/login", {"email": email, "password": password})
    return data.get("accessToken") if code == 200 and isinstance(data, dict) else None


def _get_available_charger(token):
    code, chargers = get(f"{GATEWAY}/api/chargers/status/available", token=token)
    if code == 200 and isinstance(chargers, list) and chargers:
        return chargers[0]
    return None


def _create_reservation(token, charger=None):
    if charger is None:
        charger = _get_available_charger(token)
    if charger is None:
        return None, None
    cid      = charger.get("chargerId") or charger.get("id")
    provider = charger.get("providerName") or "bluePlug"
    code, data = post(f"{GATEWAY}/api/reservations/",
                      {"chargerId": cid, "duration": 10, "providerName": provider},
                      token=token)
    if code == 201 and isinstance(data, dict):
        return data.get("reservationId"), charger
    return None, charger


class TestReservationLifecycle:
    SUITE_ID   = 40
    SUITE_NAME = "Reservation Service: Complete lifecycle + all edge cases"

    # ── GET /:id ──────────────────────────────────────────────────────────────

    def test_get_reservation_by_id_structure(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        rid, charger = _create_reservation(user_token)
        if not rid:
            pytest.skip("could not create reservation (no available charger?)")
        try:
            code, data = get(f"{GATEWAY}/api/reservations/{rid}", token=user_token)
            assert code == 200, f"GET /api/reservations/{rid} HTTP {code}"
            assert isinstance(data, dict), f"Response not a dict: {data}"
            for field in ("reservationId", "status", "duration", "userId", "createdAt"):
                assert field in data, f"Field '{field}' missing: {list(data.keys())}"
            assert data.get("status") == "active", f"Expected active, got {data.get('status')}"
        finally:
            _request("POST", f"{GATEWAY}/api/reservations/{rid}/cancel", token=user_token)

    def test_get_reservation_by_id_nonexistent(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = get(f"{GATEWAY}/api/reservations/999999", token=user_token)
        assert code == 404, f"Non-existent reservation should be 404, got {code}"
        assert isinstance(data, dict), f"404 body not a dict"
        has_error = "error" in data or "message" in data or "returnCode" in data
        assert has_error, f"404 JSON missing error/message: {list(data.keys())}"

    def test_get_reservation_by_id_no_token_401(self):
        code, _ = get(f"{GATEWAY}/api/reservations/1")
        assert code == 401, f"No token on GET /reservations/:id should be 401, got {code}"

    # ── GET /user/:userId ─────────────────────────────────────────────────────

    def test_get_reservations_by_user_id_own(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, me = get(f"{GATEWAY}/api/users/me", token=user_token)
        if code != 200:
            pytest.skip("GET /me failed")
        uid = me.get("userId")
        code2, data = get(f"{GATEWAY}/api/reservations/user/{uid}", token=user_token)
        assert code2 == 200, f"GET /reservations/user/{uid} HTTP {code2}"
        assert isinstance(data, list), f"Expected list, got {type(data)}"

    def test_get_reservations_by_user_id_wrong_user(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        # userId 999999 almost certainly not this user
        code, _ = get(f"{GATEWAY}/api/reservations/user/999999", token=user_token)
        assert code == 403, f"Different userId should return 403, got {code}"

    # ── Cancel edge cases ─────────────────────────────────────────────────────

    def test_cancel_nonexistent_reservation_returns_404(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = _request("POST", f"{GATEWAY}/api/reservations/999999/cancel",
                               token=user_token)
        assert code == 404, f"Cancel non-existent should be 404, got {code}"
        assert isinstance(data, dict), "404 body not a dict"

    def test_cancel_wrong_owner_returns_403(self, user_token, user2_token):
        if not user_token or not user2_token:
            pytest.skip("login failed")
        rid, _ = _create_reservation(user_token)
        if not rid:
            pytest.skip("no available charger for user1")
        try:
            code, data = _request("POST", f"{GATEWAY}/api/reservations/{rid}/cancel",
                                   token=user2_token)
            assert code == 403, f"Wrong owner cancel should be 403, got {code}: {data}"
        finally:
            _request("POST", f"{GATEWAY}/api/reservations/{rid}/cancel", token=user_token)

    def test_cancel_already_cancelled_returns_409(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        rid, _ = _create_reservation(user_token)
        if not rid:
            pytest.skip("no available charger")
        _request("POST", f"{GATEWAY}/api/reservations/{rid}/cancel", token=user_token)
        time.sleep(1)
        code, data = _request("POST", f"{GATEWAY}/api/reservations/{rid}/cancel",
                               token=user_token)
        assert code == 409, f"Double-cancel should be 409, got {code}: {data}"

    # ── Complete edge cases ───────────────────────────────────────────────────

    def test_complete_nonexistent_reservation_returns_404(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = _request("POST", f"{GATEWAY}/api/reservations/999999/complete",
                               token=user_token)
        assert code == 404, f"Complete non-existent should be 404, got {code}"

    def test_complete_wrong_owner_returns_403(self, user_token, user2_token):
        if not user_token or not user2_token:
            pytest.skip("login failed")
        rid, _ = _create_reservation(user_token)
        if not rid:
            pytest.skip("no available charger")
        try:
            code, data = _request("POST", f"{GATEWAY}/api/reservations/{rid}/complete",
                                   token=user2_token)
            assert code == 403, f"Wrong owner complete should be 403, got {code}: {data}"
        finally:
            _request("POST", f"{GATEWAY}/api/reservations/{rid}/cancel", token=user_token)

    def test_complete_already_cancelled_returns_409(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        rid, _ = _create_reservation(user_token)
        if not rid:
            pytest.skip("no available charger")
        _request("POST", f"{GATEWAY}/api/reservations/{rid}/cancel", token=user_token)
        time.sleep(1)
        code, data = _request("POST", f"{GATEWAY}/api/reservations/{rid}/complete",
                               token=user_token)
        assert code == 409, f"Complete on cancelled reservation should be 409, got {code}: {data}"

    def test_complete_active_unexpired_returns_400(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        rid, _ = _create_reservation(user_token)
        if not rid:
            pytest.skip("no available charger")
        try:
            code, data = _request("POST", f"{GATEWAY}/api/reservations/{rid}/complete",
                                   token=user_token)
            # An active, unexpired reservation should be rejected (time guard)
            assert code >= 400, f"Complete unexpired reservation should fail, got {code}: {data}"
        finally:
            _request("POST", f"{GATEWAY}/api/reservations/{rid}/cancel", token=user_token)

    # ── Fields on create and cancel ───────────────────────────────────────────

    def test_reservation_fields_on_create(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        charger = _get_available_charger(user_token)
        if not charger:
            pytest.skip("no available charger")
        cid = charger.get("chargerId") or charger.get("id")
        provider = charger.get("providerName") or "bluePlug"
        code, data = post(f"{GATEWAY}/api/reservations/",
                          {"chargerId": cid, "duration": 15, "providerName": provider},
                          token=user_token)
        if code != 201:
            pytest.skip(f"Reservation creation returned {code}")
        rid = data.get("reservationId")
        try:
            for field in ("reservationId", "status", "duration", "createdAt"):
                assert field in data, f"Field '{field}' missing from create response: {list(data.keys())}"
            assert data.get("status") == "active", f"Status should be active: {data.get('status')}"
            assert data.get("duration") == 15, f"duration should be 15 min: {data.get('duration')}"
        finally:
            if rid:
                _request("POST", f"{GATEWAY}/api/reservations/{rid}/cancel", token=user_token)

    def test_reservation_fields_on_cancel(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        rid, _ = _create_reservation(user_token)
        if not rid:
            pytest.skip("no available charger")
        code, data = _request("POST", f"{GATEWAY}/api/reservations/{rid}/cancel",
                               token=user_token)
        assert code == 200, f"Cancel HTTP {code}: {data}"
        assert isinstance(data, dict), f"Cancel response not a dict: {data}"
        assert data.get("status") == "cancelled", f"status should be cancelled: {data.get('status')}"
        actual_dur = data.get("actualDurationSeconds")
        assert actual_dur is not None, "actualDurationSeconds missing from cancel response"
        assert isinstance(actual_dur, (int, float)) and actual_dur >= 0, \
            f"actualDurationSeconds should be non-negative: {actual_dur}"
        orig_dur = data.get("duration")
        assert orig_dur is not None, "duration missing from cancel response"

    def test_reservation_duration_preserved_on_cancel(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        charger = _get_available_charger(user_token)
        if not charger:
            pytest.skip("no available charger")
        cid = charger.get("chargerId") or charger.get("id")
        provider = charger.get("providerName") or "bluePlug"
        code, data = post(f"{GATEWAY}/api/reservations/",
                          {"chargerId": cid, "duration": 20, "providerName": provider},
                          token=user_token)
        if code != 201:
            pytest.skip(f"Create returned {code}")
        rid = data.get("reservationId")
        code2, cancel_data = _request("POST", f"{GATEWAY}/api/reservations/{rid}/cancel",
                                       token=user_token)
        assert code2 == 200
        assert cancel_data.get("duration") == 20, \
            f"duration should still be 20 after cancel, got {cancel_data.get('duration')}"
