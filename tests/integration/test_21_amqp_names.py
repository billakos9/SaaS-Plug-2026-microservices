import subprocess
import pytest
from helpers import get, MQ_API


_SERVICES = [
    ("admin_service",       "admin-service"),
    ("analytics_service",   "analytics-service"),
    ("auth_service",        "auth-service"),
    ("billing_service",     "billing-service"),
    ("charger_service",     "charger-service"),
    ("Plug-Service",        "plug-service"),
    ("provider_service",    "provider-service"),
    ("reservation_service", "reservation-service"),
    ("user_service",        "user-service"),
]

_EXPECTED_NAMES = [
    "admin-service", "analytics-service", "auth-service",
    "billing-service", "charger-service", "plug-service",
    "provider-service", "reservation-service", "user-service",
]


class TestAMQPConnectionNames:
    SUITE_ID   = 21
    SUITE_NAME = "AMQP Connection Names (B5)"

    @pytest.mark.parametrize("container,svc_name", _SERVICES)
    def test_service_rabbitmq_has_connection_name(self, container, svc_name):
        r = subprocess.run(
            ["docker", "exec", container, "grep", "-c", "connection_name",
             "src/infrastructure/rabbitMQ.js"],
            capture_output=True, text=True, timeout=10,
        )
        count = int(r.stdout.strip() or "0") if r.returncode == 0 else 0
        assert count >= 1, f"{svc_name} rabbitMQ.js: connection_name not found"

    def test_management_api_shows_named_connections(self):
        code, data = get(f"{MQ_API}/api/connections", basic=("guest", "guest"))
        assert code == 200, f"RabbitMQ /api/connections HTTP {code}"

        named = {
            c.get("client_properties", {}).get("connection_name", "")
            for c in (data if isinstance(data, list) else [])
        }
        missing = [n for n in _EXPECTED_NAMES if n not in named]
        assert not missing, \
            f"Connections not visible in RabbitMQ management: {missing}. Found: {sorted(named)}"
