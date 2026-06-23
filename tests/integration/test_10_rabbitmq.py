import pytest
from helpers import get, MQ_API, REQUIRED_QUEUES


class TestRabbitMQQueueIntegrity:
    SUITE_ID   = 10
    SUITE_NAME = "RabbitMQ Queue Integrity"

    def test_management_api_reachable(self):
        code, _ = get(f"{MQ_API}/api/queues", basic=("guest", "guest"))
        assert code == 200, f"RabbitMQ management API HTTP {code}"

    @pytest.mark.parametrize("qname", REQUIRED_QUEUES)
    def test_queue_exists_with_consumer(self, qname):
        code, queues = get(f"{MQ_API}/api/queues", basic=("guest", "guest"))
        if code != 200:
            pytest.skip("RabbitMQ management API unavailable")
        queue_map = {q["name"]: q for q in queues} if isinstance(queues, list) else {}
        q = queue_map.get(qname)
        assert q is not None, f"Queue MISSING: {qname}"
        assert q.get("consumers", 0) >= 1, f"{qname}: consumers={q.get('consumers', 0)}"

    @pytest.mark.parametrize("qname", REQUIRED_QUEUES)
    def test_queue_has_dlx(self, qname):
        code, queues = get(f"{MQ_API}/api/queues", basic=("guest", "guest"))
        if code != 200:
            pytest.skip("RabbitMQ management API unavailable")
        queue_map = {q["name"]: q for q in queues} if isinstance(queues, list) else {}
        q = queue_map.get(qname)
        if q is None:
            pytest.skip(f"Queue {qname} missing (covered by exists test)")
        dlx = q.get("arguments", {}).get("x-dead-letter-exchange", "")
        assert dlx == "saasplug.dlx", f"{qname}: DLX='{dlx}' (expected 'saasplug.dlx')"

    def test_dlx_exchange_exists_and_is_fanout(self):
        code, exchanges = get(f"{MQ_API}/api/exchanges", basic=("guest", "guest"))
        assert code == 200, f"RabbitMQ exchanges API HTTP {code}"
        dlx = next((e for e in exchanges if e.get("name") == "saasplug.dlx"), None) \
              if isinstance(exchanges, list) else None
        assert dlx is not None, "saasplug.dlx exchange MISSING"
        assert dlx.get("type") == "fanout" and dlx.get("durable") is True, \
            f"saasplug.dlx: type={dlx.get('type')}, durable={dlx.get('durable')}"
