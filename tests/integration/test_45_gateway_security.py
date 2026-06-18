import pytest
from helpers import get, post, _request, GATEWAY

_BLOCKED_PATHS = [
    "/api/auth/health",
    "/api/chargers/health",
    "/api/providers/health",
    "/api/reservations/health",
    "/api/admin/health",
    "/api/analytics/health",
    "/api/billing/health",
    "/api/auth/internal/provider",
    "/api/adapters/blue/bluePlugAdapter/postReservations",
    "/api/adapters/red/anything",
    "/api/adapters/green/greenPlugAdapter/something",
]


class TestGatewaySecurity:
    SUITE_ID   = 45
    SUITE_NAME = "Gateway: All blocked routes / method enforcement / coverage"

    @pytest.mark.parametrize("path", _BLOCKED_PATHS)
    def test_blocked_path_returns_404(self, path):
        code, _ = get(f"{GATEWAY}{path}")
        assert code == 404, f"Blocked path {path} should return 404, got {code}"

    @pytest.mark.parametrize("path", _BLOCKED_PATHS[:7])  # health endpoints only
    def test_blocked_health_post_also_404(self, path):
        code, _ = post(f"{GATEWAY}{path}", {})
        assert code == 404, f"POST to blocked health {path} should be 404, got {code}"

    def test_nonexistent_api_path_returns_404(self):
        code, _ = get(f"{GATEWAY}/api/this_does_not_exist_at_all")
        assert code == 404, f"Non-existent /api/* path should be 404, got {code}"

    def test_users_direct_list_blocked(self):
        # Only /api/users/me is proxied; /api/users/ has no location block → 404
        code, _ = get(f"{GATEWAY}/api/users/")
        assert code == 404, f"/api/users/ should be 404 (not proxied), got {code}"

    def test_users_me_no_token_returns_401_not_404(self):
        # Route exists but requires auth — should be 401, not 404 or 502
        code, _ = get(f"{GATEWAY}/api/users/me")
        assert code == 401, f"GET /api/users/me without token should be 401, got {code}"

    def test_auth_internal_provider_post_blocked(self, admin_token):
        # Even with admin JWT, this internal route must be blocked by gateway
        code, _ = post(f"{GATEWAY}/api/auth/internal/provider",
                       {"email": "x@y.com", "password": "p"},
                       token=admin_token)
        assert code == 404, \
            f"POST /api/auth/internal/provider should be 404 even with admin token, got {code}"

    def test_options_to_api_root(self):
        # OPTIONS preflight should not hang or crash; any status code is OK
        code, _ = _request("OPTIONS", f"{GATEWAY}/api/auth/login")
        assert code is not None, "OPTIONS /api/auth/login returned no response"

    def test_charger_routes_are_public(self):
        # Charger GET routes should be reachable without token (not blocked)
        code, _ = get(f"{GATEWAY}/api/chargers/")
        assert code == 200, f"GET /api/chargers/ should be public (200), got {code}"

    def test_auth_login_is_public(self):
        # Auth login must be reachable without token
        code, data = post(f"{GATEWAY}/api/auth/login",
                          {"email": "nobody@x.com", "password": "p"})
        # Will fail auth but not 404; expect 4xx from service, not gateway 404
        assert code != 404, f"POST /api/auth/login should not 404, got {code}"

    def test_gateway_does_not_expose_service_ports_directly(self):
        # Services run on 3000-3008; gateway on 80. Direct port access not via gateway.
        # This test just verifies the gateway port (80) is the entry point.
        code, _ = get(f"{GATEWAY}/api/auth/login")
        # POST is needed for login, but GET should still not 502
        assert code in (404, 405, 400), \
            f"GET /api/auth/login should be 404/405/400, got {code}"
