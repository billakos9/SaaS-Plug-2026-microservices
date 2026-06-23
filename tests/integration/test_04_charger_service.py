import pytest
from helpers import get, GATEWAY


class TestChargerService:
    SUITE_ID   = 4
    SUITE_NAME = "Charger Service"

    def test_list_chargers(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = get(f"{GATEWAY}/api/chargers", token=user_token)
        assert code == 200, f"GET /api/chargers HTTP {code}"
        assert isinstance(data, list) and len(data) > 0, \
            f"Expected non-empty list, got {type(data)}"

    def test_get_charger_by_id(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = get(f"{GATEWAY}/api/chargers", token=user_token)
        if code != 200 or not isinstance(data, list) or not data:
            pytest.skip("charger list unavailable")
        first      = data[0]
        charger_id = first.get("chargerId") or first.get("id") or first.get("_id")
        assert charger_id is not None, f"Could not extract id from charger: {first}"

        code2, data2 = get(f"{GATEWAY}/api/chargers/id/{charger_id}", token=user_token)
        assert code2 == 200, f"GET /api/chargers/id/{charger_id} HTTP {code2}"
        is_single = isinstance(data2, dict) and ("chargerId" in data2 or "id" in data2)
        assert is_single, f"Expected single charger dict, got {type(data2)}"
