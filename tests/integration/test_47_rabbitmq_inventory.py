import pytest
from helpers import get, MQ_API

# Complete queue inventory — every queue in the system
ALL_QUEUES = [
    # Auth service consumers
    "auth.user.update.queue",
    "auth.user.delete.queue",
    "auth.provider.delete.queue",
    # User service consumers
    "user.profile.queue",
    "user.token.revoked.queue",
    # Provider service consumers
    "provider.registration.queue",
    "provider.token.revoked.queue",
    # Charger service consumers
    "charger.management.queue",
    "charger.reservation.queue",
    "charger.provider.delete.queue",
    "charger.token.revoked.queue",
    # Plug service consumer
    "plug.reservation.queue",
    # Admin service consumers
    "admin.provider.events.queue",
    "admin.charger.events.queue",
    "admin.registration.queue",
    "admin.token.revoked.queue",
    # Reservation service consumers
    "reservation.user.delete.queue",
    "reservation.token.revoked.queue",
    # Billing service consumers
    "billing.reservation.queue",
    "billing.token.revoked.queue",
    # Analytics service consumers
    "analytics.reservation.queue",
    "analytics.token.revoked.queue",
]

_queues_cache = {}


def _load_queues():
    global _queues_cache
    if not _queues_cache:
        code, data = get(f"{MQ_API}/api/queues", basic=("guest", "guest"))
        if code == 200 and isinstance(data, list):
            _queues_cache = {q["name"]: q for q in data}
    return _queues_cache


class TestRabbitMQInventory:
    SUITE_ID   = 47
    SUITE_NAME = "RabbitMQ: Expanded queue inventory (all 23+ queues, bindings, consumers)"

    @pytest.mark.parametrize("queue_name", ALL_QUEUES)
    def test_queue_exists(self, queue_name):
        queues = _load_queues()
        if not queues:
            pytest.skip("RabbitMQ management API unavailable")
        assert queue_name in queues, \
            f"Queue '{queue_name}' does not exist in RabbitMQ"

    @pytest.mark.parametrize("queue_name", ALL_QUEUES)
    def test_queue_has_consumer(self, queue_name):
        queues = _load_queues()
        if not queues or queue_name not in queues:
            pytest.skip(f"Queue '{queue_name}' not found")
        consumers = queues[queue_name].get("consumers", 0)
        assert consumers >= 1, \
            f"Queue '{queue_name}' has {consumers} consumers (expected ≥1)"

    @pytest.mark.parametrize("queue_name", ALL_QUEUES)
    def test_queue_has_dlx(self, queue_name):
        queues = _load_queues()
        if not queues or queue_name not in queues:
            pytest.skip(f"Queue '{queue_name}' not found")
        dlx = queues[queue_name].get("arguments", {}).get("x-dead-letter-exchange", "")
        assert dlx == "saasplug.dlx", \
            f"Queue '{queue_name}' DLX='{dlx}' (expected 'saasplug.dlx')"

    @pytest.mark.parametrize("queue_name", ALL_QUEUES)
    def test_queue_is_durable(self, queue_name):
        queues = _load_queues()
        if not queues or queue_name not in queues:
            pytest.skip(f"Queue '{queue_name}' not found")
        durable = queues[queue_name].get("durable", False)
        assert durable, f"Queue '{queue_name}' is not durable"

    # ── DLX exchange verification ─────────────────────────────────────────────

    def test_dlx_exchange_exists(self):
        code, data = get(f"{MQ_API}/api/exchanges", basic=("guest", "guest"))
        if code != 200 or not isinstance(data, list):
            pytest.skip("RabbitMQ management API unavailable")
        dlx = next((e for e in data if e.get("name") == "saasplug.dlx"), None)
        assert dlx is not None, "saasplug.dlx exchange does not exist"

    def test_dlx_exchange_is_fanout(self):
        code, data = get(f"{MQ_API}/api/exchanges", basic=("guest", "guest"))
        if code != 200 or not isinstance(data, list):
            pytest.skip("RabbitMQ management API unavailable")
        dlx = next((e for e in data if e.get("name") == "saasplug.dlx"), None)
        if dlx is None:
            pytest.skip("saasplug.dlx not found")
        assert dlx.get("type") == "fanout", \
            f"saasplug.dlx type='{dlx.get('type')}' (expected 'fanout')"

    def test_dlx_exchange_is_durable(self):
        code, data = get(f"{MQ_API}/api/exchanges", basic=("guest", "guest"))
        if code != 200 or not isinstance(data, list):
            pytest.skip("RabbitMQ management API unavailable")
        dlx = next((e for e in data if e.get("name") == "saasplug.dlx"), None)
        if dlx is None:
            pytest.skip("saasplug.dlx not found")
        assert dlx.get("durable"), "saasplug.dlx should be durable"

    # ── Admin provider queue binding verification ─────────────────────────────

    def test_admin_provider_queue_bindings(self):
        code, data = get(f"{MQ_API}/api/bindings", basic=("guest", "guest"))
        if code != 200 or not isinstance(data, list):
            pytest.skip("RabbitMQ management API unavailable")
        bindings = [b for b in data
                    if b.get("destination") == "admin.provider.events.queue"]
        routing_keys = {b.get("routing_key") for b in bindings}
        # Must have provider.add, provider.update, provider.delete
        for key in ("provider.add", "provider.update", "provider.delete"):
            assert key in routing_keys, \
                f"admin.provider.events.queue missing binding for '{key}'"

    def test_admin_provider_queue_no_wildcard_binding(self):
        code, data = get(f"{MQ_API}/api/bindings", basic=("guest", "guest"))
        if code != 200 or not isinstance(data, list):
            pytest.skip("RabbitMQ management API unavailable")
        bindings = [b for b in data
                    if b.get("destination") == "admin.provider.events.queue"]
        routing_keys = {b.get("routing_key") for b in bindings}
        assert "provider.*" not in routing_keys, \
            "admin.provider.events.queue has wildcard binding 'provider.*' (should be exact)"
        assert "provider.registered" not in routing_keys, \
            "admin.provider.events.queue bound to 'provider.registered' (should not be)"

    def test_charger_reservation_queue_bound_to_reservation_exchange(self):
        code, data = get(f"{MQ_API}/api/bindings", basic=("guest", "guest"))
        if code != 200 or not isinstance(data, list):
            pytest.skip("RabbitMQ management API unavailable")
        bindings = [b for b in data
                    if b.get("destination") == "charger.reservation.queue"]
        sources = {b.get("source") for b in bindings}
        assert "reservation" in sources, \
            f"charger.reservation.queue bound to: {sources} (expected 'reservation')"

    def test_billing_reservation_queue_bound_to_reservation_exchange(self):
        code, data = get(f"{MQ_API}/api/bindings", basic=("guest", "guest"))
        if code != 200 or not isinstance(data, list):
            pytest.skip("RabbitMQ management API unavailable")
        bindings = [b for b in data
                    if b.get("destination") == "billing.reservation.queue"]
        sources = {b.get("source") for b in bindings}
        assert "reservation" in sources, \
            f"billing.reservation.queue bound to: {sources} (expected 'reservation')"

    def test_plug_reservation_queue_bound_to_reservation_exchange(self):
        code, data = get(f"{MQ_API}/api/bindings", basic=("guest", "guest"))
        if code != 200 or not isinstance(data, list):
            pytest.skip("RabbitMQ management API unavailable")
        bindings = [b for b in data
                    if b.get("destination") == "plug.reservation.queue"]
        sources = {b.get("source") for b in bindings}
        assert "reservation" in sources, \
            f"plug.reservation.queue bound to: {sources} (expected 'reservation')"

    def test_reservation_user_delete_queue_bound_to_user_exchange(self):
        code, data = get(f"{MQ_API}/api/bindings", basic=("guest", "guest"))
        if code != 200 or not isinstance(data, list):
            pytest.skip("RabbitMQ management API unavailable")
        bindings = [b for b in data
                    if b.get("destination") == "reservation.user.delete.queue"]
        sources = {b.get("source") for b in bindings}
        assert "user" in sources, \
            f"reservation.user.delete.queue bound to: {sources} (expected 'user')"

    @pytest.mark.parametrize("queue_name", [q for q in ALL_QUEUES if "token.revoked" in q])
    def test_token_revoked_queues_bound_to_auth_exchange(self, queue_name):
        code, data = get(f"{MQ_API}/api/bindings", basic=("guest", "guest"))
        if code != 200 or not isinstance(data, list):
            pytest.skip("RabbitMQ management API unavailable")
        bindings = [b for b in data if b.get("destination") == queue_name]
        sources = {b.get("source") for b in bindings}
        assert "auth" in sources, \
            f"{queue_name} bound to: {sources} (expected 'auth' exchange)"
