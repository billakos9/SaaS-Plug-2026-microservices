import pytest
from helpers import get, post, shell, GATEWAY

_NEW_CHARGER = {
    "id": 988877,
    "ProviderName": "bluePlug",
    "status": "available",
    "cap": 22,
    "kwhPrice": 0.35,
    "locationName": "Suite39 CRUD Test Charger",
    "connectionType": "Type2",
    "latitude": 37.975,
    "longitude": 23.735,
}

_NO_COORDS_CHARGER = {
    "id": 988878,
    "ProviderName": "redPlug",
    "status": "available",
    "cap": 11,
    "kwhPrice": 0.28,
    "locationName": "Suite39 No-Coords Charger",
    "connectionType": "CCS",
}


def _delete_charger(charger_id):
    shell(
        f"docker exec charger_db mongosh --quiet --eval \""
        f"db = db.getSiblingDB('charger');"
        f"db.chargerpoints.deleteOne({{id: {charger_id}}});\""
    )


class TestChargerCRUD:
    SUITE_ID   = 39
    SUITE_NAME = "Charger Service: Full CRUD + field validation"

    # ── GET / ─────────────────────────────────────────────────────────────────

    def test_charger_list_is_public(self):
        code, data = get(f"{GATEWAY}/api/chargers/")
        assert code == 200, f"GET /api/chargers/ HTTP {code}"
        assert isinstance(data, list) and len(data) > 0, "Expected non-empty charger list"

    def test_charger_list_structure(self):
        code, data = get(f"{GATEWAY}/api/chargers/")
        if code != 200 or not isinstance(data, list) or not data:
            pytest.skip("charger list unavailable")
        item = data[0]
        for field in ("status", "locationName"):
            assert field in item, f"Field '{field}' missing from charger: {list(item.keys())}"
        has_id = "id" in item or "chargerId" in item
        assert has_id, f"No id/chargerId field in charger: {list(item.keys())}"

    def test_charger_list_has_price_and_connection(self):
        code, data = get(f"{GATEWAY}/api/chargers/")
        if code != 200 or not isinstance(data, list) or not data:
            pytest.skip("charger list unavailable")
        item = data[0]
        assert "kwhPrice" in item or "cap" in item, \
            f"No kwhPrice/cap in charger: {list(item.keys())}"

    # ── GET /status/:status ───────────────────────────────────────────────────

    def test_charger_status_available_filter(self):
        code, data = get(f"{GATEWAY}/api/chargers/status/available")
        assert code == 200, f"GET /api/chargers/status/available HTTP {code}"
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        for c in data:
            assert c.get("status") == "available", \
                f"Charger {c.get('id')} has status={c.get('status')} (expected available)"

    def test_charger_status_offline_filter(self):
        code, data = get(f"{GATEWAY}/api/chargers/status/offline")
        assert code == 200, f"GET /api/chargers/status/offline HTTP {code}"
        assert isinstance(data, list), "Expected list for offline chargers"
        for c in data:
            assert c.get("status") == "offline", \
                f"Charger has status={c.get('status')} in offline filter"

    def test_charger_status_invalid_returns_empty_or_4xx(self):
        code, data = get(f"{GATEWAY}/api/chargers/status/totallyfakestatus")
        # Acceptable: either 4xx (validation error) or 200 with empty list
        ok = code >= 400 or (code == 200 and isinstance(data, list) and len(data) == 0)
        assert ok, f"Invalid status: expected 4xx or empty list, got HTTP {code}: {data}"

    # ── GET /id/:id ───────────────────────────────────────────────────────────

    def test_charger_by_id_structure(self):
        code, chargers = get(f"{GATEWAY}/api/chargers/")
        if code != 200 or not isinstance(chargers, list) or not chargers:
            pytest.skip("charger list unavailable")
        first = chargers[0]
        cid = first.get("id") or first.get("chargerId")
        assert cid is not None, "Cannot extract charger id"
        code2, data = get(f"{GATEWAY}/api/chargers/id/{cid}")
        assert code2 == 200, f"GET /api/chargers/id/{cid} HTTP {code2}"
        assert isinstance(data, dict), f"Response not a dict: {data}"
        for field in ("status", "locationName", "kwhPrice", "connectionType"):
            assert field in data, f"Field '{field}' missing from charger detail"

    def test_charger_by_id_nonexistent_returns_404(self):
        code, data = get(f"{GATEWAY}/api/chargers/id/999999")
        assert code == 404, f"Non-existent charger should be 404, got HTTP {code}: {data}"

    def test_charger_by_id_no_token_required(self):
        code, chargers = get(f"{GATEWAY}/api/chargers/")
        if code != 200 or not isinstance(chargers, list) or not chargers:
            pytest.skip("charger list unavailable")
        cid = chargers[0].get("id") or chargers[0].get("chargerId")
        code2, _ = get(f"{GATEWAY}/api/chargers/id/{cid}")
        assert code2 == 200, f"Charger by ID should be public (no token), got {code2}"

    # ── POST / (create) ───────────────────────────────────────────────────────

    def test_charger_create_admin_success(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        _delete_charger(_NEW_CHARGER["id"])  # pre-clean
        code, body = post(f"{GATEWAY}/api/chargers", _NEW_CHARGER, token=admin_token)
        assert code in (200, 201), f"POST /api/chargers (admin) HTTP {code}: {body}"
        assert isinstance(body, dict), f"Response not a dict: {body}"
        returned_id = body.get("id") or body.get("chargerId")
        assert returned_id is not None, f"No id in created charger response: {list(body.keys())}"

    def test_charger_create_returned_fields(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, body = post(f"{GATEWAY}/api/chargers", _NEW_CHARGER, token=admin_token)
        if code not in (200, 201):
            pytest.skip(f"Charger creation returned {code}")
        for field in ("status", "locationName", "kwhPrice"):
            assert field in body, f"Field '{field}' missing from created charger: {list(body.keys())}"
        assert body.get("locationName") == _NEW_CHARGER["locationName"], \
            f"locationName mismatch: {body.get('locationName')}"

    def test_charger_create_no_token_returns_401(self):
        code, _ = post(f"{GATEWAY}/api/chargers", _NEW_CHARGER)
        assert code == 401, f"POST /api/chargers without token should be 401, got {code}"

    def test_charger_create_user_token_returns_403(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, _ = post(f"{GATEWAY}/api/chargers", _NEW_CHARGER, token=user_token)
        assert code == 403, f"POST /api/chargers with user token should be 403, got {code}"

    def test_charger_create_provider_token_returns_403(self, provider_token):
        if not provider_token:
            pytest.skip("provider login failed")
        code, _ = post(f"{GATEWAY}/api/chargers", _NEW_CHARGER, token=provider_token)
        assert code == 403, f"POST /api/chargers with provider token should be 403, got {code}"

    def test_charger_create_missing_provider_name(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        bad = {k: v for k, v in _NEW_CHARGER.items() if k != "ProviderName"}
        code, data = post(f"{GATEWAY}/api/chargers", bad, token=admin_token)
        assert code >= 400, f"Create charger without ProviderName should fail, got {code}: {data}"

    def test_charger_create_without_coords_succeeds(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        _delete_charger(_NO_COORDS_CHARGER["id"])
        code, body = post(f"{GATEWAY}/api/chargers", _NO_COORDS_CHARGER, token=admin_token)
        assert code in (200, 201), f"Create charger without coords HTTP {code}: {body}"

    # ── Cleanup ───────────────────────────────────────────────────────────────

    def test_zzz_cleanup(self):
        _delete_charger(_NEW_CHARGER["id"])
        _delete_charger(_NO_COORDS_CHARGER["id"])
