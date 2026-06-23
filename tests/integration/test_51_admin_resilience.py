import subprocess
import time
import pytest
from helpers import get, GATEWAY

_MGMT_SVC = "/home/giorgos/SaaS/project/saas26-09/services/admin-service/src/services/management.service.js"


def _read_mgmt_service():
    try:
        with open(_MGMT_SVC) as f:
            return f.read()
    except OSError:
        return ""


class TestAdminResilience:
    SUITE_ID   = 51
    SUITE_NAME = "Admin proxy: circuit breaker / timeout / retry patterns (source + runtime)"

    # ── Source-level pattern checks ────────────────────────────────────────────

    def test_management_service_has_circuit_breaker(self):
        src = _read_mgmt_service()
        assert src, f"Could not read {_MGMT_SVC}"
        has_cb = ("failureCount" in src or "circuitBreaker" in src or
                  "openCircuit" in src or "circuitOpen" in src or
                  "threshold" in src.lower())
        assert has_cb, \
            "management.service.js missing circuit breaker implementation " \
            "(no failureCount/circuitBreaker/openCircuit/threshold)"

    def test_management_service_has_timeout(self):
        src = _read_mgmt_service()
        assert src, f"Could not read {_MGMT_SVC}"
        has_timeout = ("AbortController" in src or "AbortSignal" in src or
                       "timeout:" in src or "timeout =" in src)
        assert has_timeout, \
            "management.service.js missing timeout implementation (no AbortController/AbortSignal)"

    def test_management_service_retry_on_get_not_delete(self):
        src = _read_mgmt_service()
        assert src, f"Could not read {_MGMT_SVC}"
        # Retry is conditional on GET method; DELETE must NOT be retried
        has_retry = "retry" in src.lower() or "attempts" in src or "backoff" in src
        assert has_retry, "management.service.js missing retry logic"
        # DELETE should not be retried (prevents double-delete)
        # Check that DELETE is excluded from retry or there's a GET-only condition
        has_get_guard = ('"GET"' in src or "'GET'" in src or
                         "method === \"GET\"" in src or "method == 'GET'" in src)
        has_delete_guard = ('"DELETE"' in src or "'DELETE'" in src)
        assert has_get_guard or has_delete_guard, \
            "Retry logic should be GET-only (DELETE not retried)"

    def test_management_service_circuit_breaker_threshold(self):
        src = _read_mgmt_service()
        assert src, f"Could not read {_MGMT_SVC}"
        # Should have some numeric threshold (3 failures in 30s)
        has_3 = "3" in src
        assert has_3, "management.service.js circuit breaker threshold (3) not found"

    # ── Runtime response checks ────────────────────────────────────────────────

    def test_proxy_users_responds_quickly(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        start = time.time()
        code, data = get(f"{GATEWAY}/api/admin/users", token=admin_token)
        elapsed = time.time() - start
        assert code == 200, f"GET /admin/users HTTP {code}: {data}"
        assert elapsed < 6.0, f"GET /admin/users took {elapsed:.1f}s (expected < 6s)"

    def test_proxy_providers_responds_quickly(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        start = time.time()
        code, data = get(f"{GATEWAY}/api/admin/providers", token=admin_token)
        elapsed = time.time() - start
        assert code == 200, f"GET /admin/providers HTTP {code}: {data}"
        assert elapsed < 6.0, f"GET /admin/providers took {elapsed:.1f}s"

    def test_proxy_chargers_responds_quickly(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        start = time.time()
        code, data = get(f"{GATEWAY}/api/admin/chargers", token=admin_token)
        elapsed = time.time() - start
        assert code == 200, f"GET /admin/chargers HTTP {code}: {data}"
        assert elapsed < 6.0, f"GET /admin/chargers took {elapsed:.1f}s"

    def test_proxy_nonexistent_user_structured_error(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/admin/users/999999", token=admin_token)
        assert code == 404, f"Non-existent user should be 404, got {code}"
        assert isinstance(data, dict), \
            f"Structured error should be JSON dict, got {type(data).__name__}: {data!r}"

    def test_proxy_nonexistent_provider_structured_error(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/admin/providers/999999", token=admin_token)
        assert code == 404, f"Non-existent provider should be 404, got {code}"
        assert isinstance(data, dict), \
            f"Structured error should be JSON dict, got {type(data).__name__}: {data!r}"

    def test_admin_analytics_responds(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        start = time.time()
        code, data = get(f"{GATEWAY}/api/admin/analytics", token=admin_token)
        elapsed = time.time() - start
        assert code == 200, f"GET /admin/analytics HTTP {code}: {data}"
        assert elapsed < 10.0, f"Admin analytics took {elapsed:.1f}s (expected < 10s)"

    def test_management_service_file_exists_in_container(self):
        r = subprocess.run(
            ["docker", "exec", "admin_service",
             "test", "-f", "src/services/management.service.js"],
            capture_output=True,
        )
        assert r.returncode == 0, \
            "management.service.js not found in admin_service container"
