import subprocess
import pytest
from helpers import shell


class TestOutboxCollectionIntegrity:
    SUITE_ID   = 24
    SUITE_NAME = "Outbox Collection Integrity (Issue #5)"

    @pytest.mark.parametrize("db_container,db_name", [
        ("user_db",     "user"),
        ("provider_db", "provider"),
    ])
    def test_outboxevents_collection_exists(self, db_container, db_name):
        rc, out, err = shell(
            f"docker exec {db_container} mongosh --quiet --eval \""
            f"db = db.getSiblingDB('{db_name}');"
            f"var names = db.getCollectionNames();"
            f"print(names.indexOf('outboxevents') >= 0 ? 'FOUND' : 'MISSING');\""
        )
        assert rc == 0 and out.strip() == "FOUND", \
            f"{db_name}-db: outboxevents collection MISSING (rc={rc} out='{out.strip()}')"

    @pytest.mark.parametrize("db_container,db_name", [
        ("user_db",     "user"),
        ("provider_db", "provider"),
    ])
    def test_outboxevents_collection_non_empty(self, db_container, db_name):
        rc, out, _ = shell(
            f"docker exec {db_container} mongosh --quiet --eval \""
            f"db = db.getSiblingDB('{db_name}');"
            f"print(db.outboxevents.countDocuments());\""
        )
        try:
            count = int(out.strip())
        except ValueError:
            count = -1
        assert rc == 0 and count >= 1, \
            f"{db_name}-db outboxevents: expected >= 1 entry, got count={count}"

    @pytest.mark.parametrize("db_container,db_name", [
        ("user_db",     "user"),
        ("provider_db", "provider"),
    ])
    def test_outbox_doc_has_required_fields(self, db_container, db_name):
        rc, out, _ = shell(
            f"docker exec {db_container} mongosh --quiet --eval \""
            f"db = db.getSiblingDB('{db_name}');"
            f"var d = db.outboxevents.findOne({{}}, {{}}, {{sort: {{_id: -1}}}});"
            f"if (!d) {{ print('EMPTY'); }} else {{"
            f"  var ok = d.exchange && d.routingKey && d.payload "
            f"           && 'publishedAt' in d && d.createdAt;"
            f"  print(ok ? 'OK' : 'MISSING:' + JSON.stringify({{"
            f"    exchange:!!d.exchange, routingKey:!!d.routingKey,"
            f"    payload:!!d.payload, hasPubAt:'publishedAt' in d, createdAt:!!d.createdAt"
            f"  }}));"
            f"}}\""
        )
        result = out.strip()
        assert rc == 0 and result == "OK", \
            f"{db_name}-db outbox document missing required fields: {result}"

    @pytest.mark.parametrize("db_container,db_name", [
        ("user_db",     "user"),
        ("provider_db", "provider"),
    ])
    def test_outbox_has_relay_index(self, db_container, db_name):
        rc, out, _ = shell(
            f"docker exec {db_container} mongosh --quiet --eval \""
            f"db = db.getSiblingDB('{db_name}');"
            f"var idxs = db.outboxevents.getIndexes();"
            f"var found = idxs.some(function(ix) {{"
            f"  var k = Object.keys(ix.key);"
            f"  return k.indexOf('publishedAt') >= 0 && k.indexOf('createdAt') >= 0;"
            f"}});"
            f"print(found ? 'FOUND' : 'MISSING');\""
        )
        assert rc == 0 and out.strip() == "FOUND", \
            f"{db_name}-db outboxevents: {{publishedAt,createdAt}} relay index MISSING"

    @pytest.mark.parametrize("container,svc_name", [
        ("user_service",      "user-service"),
        ("provider_service",  "provider-service"),
    ])
    def test_outbox_js_exists_in_service(self, container, svc_name):
        r = subprocess.run(
            ["docker", "exec", container, "test", "-f", "src/infrastructure/outbox.js"],
            capture_output=True,
        )
        assert r.returncode == 0, f"{svc_name}: src/infrastructure/outbox.js not found"
