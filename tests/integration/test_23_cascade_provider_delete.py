import time
import pytest
from helpers import get, post, shell, _request, GATEWAY


class TestCascadeProviderDelete:
    SUITE_ID   = 23
    SUITE_NAME = "Cascade: provider.delete marks chargers offline (Issue #5)"

    TEST_CHARGER_ID = 9996

    def test_provider_delete_marks_chargers_offline(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")

        ts     = int(time.time())
        pname  = f"testProv_cascade23_{ts}"
        pemail = f"test_casc23_{ts}@example.com"

        code_reg, resp_reg = post(
            f"{GATEWAY}/api/admin/providers",
            {"providerName": pname, "email": pemail,
             "password": "Casc@pass1", "apiBaseUrl": "http://test23.local",
             "apiKey": "testkey23"},
            token=admin_token,
        )
        assert code_reg == 201, f"Register test provider HTTP {code_reg}: {resp_reg}"

        time.sleep(3)

        code_list, prov_list = get(f"{GATEWAY}/api/admin/providers", token=admin_token)
        assert code_list == 200 and isinstance(prov_list, list), \
            f"GET providers HTTP {code_list}"
        provider_obj = next((p for p in prov_list if p.get("providerName") == pname), None)
        assert provider_obj is not None, \
            f"Test provider '{pname}' not in list: {[p.get('providerName') for p in prov_list]}"
        provider_id = provider_obj.get("providerId")
        assert isinstance(provider_id, int), f"providerId={provider_id} is not int"

        rc_ins, out_ins, err_ins = shell(
            f"docker exec charger_db mongosh --quiet --eval \""
            f"db = db.getSiblingDB('charger');"
            f"db.chargerpoints.deleteOne({{id: {self.TEST_CHARGER_ID}}});"
            f"var r = db.chargerpoints.insertOne({{"
            f"  id: {self.TEST_CHARGER_ID},"
            f"  ProviderName: '{pname}',"
            f"  status: 'available',"
            f"  cap: 22, kwhPrice: 0.3,"
            f"  locationName: 'Test Cascade Location',"
            f"  connectionType: 'Type2'"
            f"}});"
            f"print(r.acknowledged);\""
        )
        assert rc_ins == 0 and out_ins.strip() == "true", \
            f"Insert test charger failed: rc={rc_ins} out='{out_ins.strip()}' err={err_ins!r}"

        code_del, resp_del = _request(
            "DELETE", f"{GATEWAY}/api/admin/providers/delete/{provider_id}",
            token=admin_token
        )
        assert code_del == 200, f"DELETE provider HTTP {code_del}: {resp_del}"

        time.sleep(5)

        rc_post, out_post, err_post = shell(
            f"docker exec charger_db mongosh --quiet --eval \""
            f"db = db.getSiblingDB('charger');"
            f"var c = db.chargerpoints.findOne({{id: {self.TEST_CHARGER_ID}}});"
            f"print(c ? c.status : 'NOT_FOUND');\""
        )
        # Cleanup before asserting so we don't leave stale data
        shell(
            f"docker exec charger_db mongosh --quiet --eval \""
            f"db = db.getSiblingDB('charger');"
            f"db.chargerpoints.deleteOne({{id: {self.TEST_CHARGER_ID}}});\""
        )
        assert out_post.strip() == "offline", \
            f"Test charger {self.TEST_CHARGER_ID} status='{out_post.strip()}' " \
            f"after provider delete (rc={rc_post}, err={err_post!r})"

    def test_outbox_has_provider_delete_entry(self):
        rc, out, _ = shell(
            "docker exec provider_db mongosh --quiet --eval \""
            "db = db.getSiblingDB('provider');"
            "var c = db.outboxevents.countDocuments({routingKey: 'provider.delete'});"
            "print(c);\""
        )
        try:
            count = int(out.strip())
        except ValueError:
            count = 0
        assert rc == 0 and count >= 1, \
            f"provider-db outboxevents: expected >= 1 provider.delete entry, got count={count}"
