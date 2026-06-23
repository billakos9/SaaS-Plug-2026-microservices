import pytest
from helpers import get, shell, MQ_API


class TestStackHealth:
    SUITE_ID   = 0
    SUITE_NAME = "Stack Health"

    def test_all_containers_up(self):
        rc, out, _ = shell(
            "docker compose ps --format 'table {{.Name}}\\t{{.Status}}'"
        )
        assert rc == 0, f"docker compose ps failed: {out[:200]}"
        lines = [l for l in out.splitlines() if l and "NAME" not in l]
        down  = [l for l in lines if "Up" not in l]
        assert len(down) == 0, f"Containers not Up ({len(lines)} total): {down}"

    def test_rabbitmq_api_reachable(self):
        code, data = get(f"{MQ_API}/api/overview", basic=("guest", "guest"), timeout=5)
        assert code == 200, f"RabbitMQ API HTTP {code}"
        version = data.get("rabbitmq_version", "?") if isinstance(data, dict) else "?"
        listeners = len(data.get("listeners", [])) if isinstance(data, dict) else 0
        assert listeners > 0, f"RabbitMQ v{version} has no listeners"
