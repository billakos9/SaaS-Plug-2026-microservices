import pytest
from helpers import get, post, shell, GATEWAY, MQ_API

_NEW_CHARGER = {
    "id": 989765,
    "ProviderName": "bluePlug",
    "status": "available",
    "cap": 22,
    "kwhPrice": 0.3,
    "locationName": "Suite25 Auth-Posture Test Charger",
    "connectionType": "Type2",
    "latitude": 37.9,
    "longitude": 23.7,
}


class TestChargerAuthPosture:
    SUITE_ID   = 25
    SUITE_NAME = "Charger-Service Auth Posture (Batch 1: GET open / POST admin-only)"

    def test_get_charger_list_is_public(self):
        code, data = get(f"{GATEWAY}/api/chargers/")
        assert code == 200, f"GET /api/chargers/ (no token) HTTP {code}"
        assert isinstance(data, list) and len(data) > 0, \
            f"Expected non-empty list, got {type(data)}"

    def test_get_charger_by_id_is_public(self):
        code, data = get(f"{GATEWAY}/api/chargers/")
        if code != 200 or not isinstance(data, list) or not data:
            pytest.skip("charger list unavailable")
        first      = data[0]
        valid_id   = first.get("chargerId") or first.get("id") or first.get("_id")
        assert valid_id is not None, "Could not extract charger id"
        code2, _   = get(f"{GATEWAY}/api/chargers/id/{valid_id}")
        assert code2 == 200, f"GET /api/chargers/id/{valid_id} (no token) HTTP {code2}"

    def test_get_charger_by_status_is_public(self):
        code, _ = get(f"{GATEWAY}/api/chargers/status/available")
        assert code == 200, f"GET /api/chargers/status/available (no token) HTTP {code}"

    def test_post_without_token_returns_401(self):
        code, _ = post(f"{GATEWAY}/api/chargers", _NEW_CHARGER)
        assert code == 401, f"POST /api/chargers (no token) should be 401, got HTTP {code}"

    def test_post_with_user_token_returns_403(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, body = post(f"{GATEWAY}/api/chargers", _NEW_CHARGER, token=user_token)
        assert code == 403, \
            f"POST /api/chargers (user token) should be 403, got HTTP {code}: {body}"

    def test_post_with_admin_token_succeeds(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, body = post(f"{GATEWAY}/api/chargers", _NEW_CHARGER, token=admin_token)
        assert code in (200, 201), \
            f"POST /api/chargers (admin token) HTTP {code}: {body}"
        # Cleanup
        created_id = (body.get("id") or body.get("chargerId")) \
                     if isinstance(body, dict) else _NEW_CHARGER["id"]
        shell(
            f"docker exec charger_db mongosh --quiet --eval \""
            f"db = db.getSiblingDB('charger');"
            f"db.chargerpoints.deleteOne({{id: {created_id}}});\""
        )

    def test_token_revoked_queue_bound_with_dlx(self):
        code, queues = get(f"{MQ_API}/api/queues", basic=("guest", "guest"))
        if code != 200 or not isinstance(queues, list):
            pytest.skip("RabbitMQ management API unavailable")
        q = next((x for x in queues if x.get("name") == "charger.token.revoked.queue"), None)
        assert q is not None, "charger.token.revoked.queue MISSING"
        assert q.get("consumers", 0) >= 1, \
            f"charger.token.revoked.queue: consumers={q.get('consumers', 0)}"
        dlx = q.get("arguments", {}).get("x-dead-letter-exchange", "")
        assert dlx == "saasplug.dlx", \
            f"charger.token.revoked.queue DLX='{dlx}' (expected 'saasplug.dlx')"
