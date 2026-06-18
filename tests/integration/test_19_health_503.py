import subprocess
import pytest


_SERVICES = [
    ("auth_service",        "auth-service"),
    ("user_service",        "user-service"),
    ("charger_service",     "charger-service"),
    ("provider_service",    "provider-service"),
    ("reservation_service", "reservation-service"),
    ("analytics_service",   "analytics-service"),
    ("billing_service",     "billing-service"),
]


class TestHealthEndpoint503OnDbDown:
    SUITE_ID   = 19
    SUITE_NAME = "Health Endpoint 503 on DB-Down (B3)"

    @pytest.mark.parametrize("container,svc_name", _SERVICES)
    def test_health_returns_operational_when_db_up(self, container, svc_name):
        r = subprocess.run(
            ["docker", "exec", container, "wget", "-qO-", "http://localhost:3000/health"],
            capture_output=True, text=True, timeout=10,
        )
        body = r.stdout.strip()
        assert r.returncode == 0 and "operational" in body, \
            f"{svc_name} /health is not operational (DB up): {body[:100]}"

    @pytest.mark.parametrize("container,svc_name", _SERVICES)
    def test_health_has_ready_state_guard(self, container, svc_name):
        r = subprocess.run(
            ["docker", "exec", container, "grep", "-c", "readyState", "src/app.js"],
            capture_output=True, text=True, timeout=10,
        )
        has_guard = r.returncode == 0 and int(r.stdout.strip() or "0") >= 1
        assert has_guard, f"{svc_name} app.js missing readyState health guard"

    @pytest.mark.parametrize("container,svc_name", _SERVICES)
    def test_health_emits_503_on_degraded(self, container, svc_name):
        r = subprocess.run(
            ["docker", "exec", container, "grep", "-c", "503", "src/app.js"],
            capture_output=True, text=True, timeout=10,
        )
        has_503 = r.returncode == 0 and int(r.stdout.strip() or "0") >= 1
        assert has_503, f"{svc_name} app.js does not emit 503 on degraded state"
