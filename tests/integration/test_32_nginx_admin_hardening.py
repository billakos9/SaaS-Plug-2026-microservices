"""
Suite 32 — Nginx + Admin-Service Hardening
=========================================

Covers two changes landed together:

1. nginx: POST /api/auth/internal/provider now returns 404 (internal-only route blocked
   at the gateway; only admin-service can call it on the Docker network).

2. admin-service:
   - All async controllers have try/catch+next (errors reach errorMiddleware).
   - startEventConsumers outer try/catch removed (bootstrap failures propagate).
   - bootstrap().catch() added with process.exit(1).
"""

import subprocess

import pytest
import requests

BASE = "http://localhost/api"

ADMIN_CONTROLLER_FILE = (
    "services/admin-service/src/controllers/management.controller.js"
)
ADMIN_APP_FILE = "services/admin-service/src/app.js"
ADMIN_CONSUMERS_FILE = "services/admin-service/src/events/rabbitmq.consumers.js"


class TestNginxAdminHardening:
    SUITE_ID = 32
    SUITE_NAME = "Nginx + Admin-Service Hardening"

    # ------------------------------------------------------------------
    # 1. nginx: internal/provider route is blocked at the gateway
    # ------------------------------------------------------------------

    def test_internal_provider_post_returns_404(self):
        """POST /api/auth/internal/provider must be blocked by nginx (404)."""
        r = requests.post(
            f"{BASE}/auth/internal/provider",
            json={"email": "probe@test.com", "password": "pw", "role": "provider"},
            timeout=5,
        )
        assert r.status_code == 404, (
            f"Expected 404 from nginx, got {r.status_code}; body={r.text[:200]}"
        )

    def test_internal_provider_get_returns_404(self):
        """GET /api/auth/internal/provider must also be blocked (exact-match location)."""
        r = requests.get(f"{BASE}/auth/internal/provider", timeout=5)
        assert r.status_code == 404, (
            f"Expected 404 from nginx, got {r.status_code}"
        )

    def test_internal_provider_with_admin_token_still_404(self, admin_token):
        """Even with a valid admin JWT the public path must stay blocked."""
        r = requests.post(
            f"{BASE}/auth/internal/provider",
            json={"email": "probe@test.com", "password": "pw", "role": "provider"},
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=5,
        )
        assert r.status_code == 404, (
            f"Expected 404 from nginx even with admin token, got {r.status_code}"
        )

    def test_nginx_conf_has_internal_provider_block(self):
        """nginx.conf must contain a location block that returns 404 for the internal route."""
        with open("apps/api-gateway/nginx.conf") as f:
            conf = f.read()
        assert "location = /api/auth/internal/provider" in conf, (
            "nginx.conf is missing the exact-match block for /api/auth/internal/provider"
        )
        # Confirm it returns 404, not a proxy pass
        block_start = conf.index("location = /api/auth/internal/provider")
        block_snippet = conf[block_start : block_start + 120]
        assert "return 404" in block_snippet, (
            f"Block does not contain 'return 404': {block_snippet!r}"
        )

    # ------------------------------------------------------------------
    # 2. admin-service: all async controllers have try/catch+next
    # ------------------------------------------------------------------

    def test_controller_all_functions_have_next(self):
        """Every exported async controller function must accept and call next(err)."""
        with open(ADMIN_CONTROLLER_FILE) as f:
            src = f.read()

        # Count 'next(err)' calls — expect at least 11 (one per controller function)
        next_err_count = src.count("next(err)")
        assert next_err_count >= 11, (
            f"Expected >= 11 'next(err)' calls in management.controller.js, "
            f"found {next_err_count}"
        )

    def test_controller_every_async_has_try(self):
        """Every async controller must pair with a try block (rough parity check)."""
        with open(ADMIN_CONTROLLER_FILE) as f:
            src = f.read()

        async_count = src.count("async (req, res, next)")
        try_count = src.count("try {")
        assert try_count >= async_count, (
            f"async functions ({async_count}) outnumber try blocks ({try_count})"
        )

    # ------------------------------------------------------------------
    # 3. admin-service: startEventConsumers outer try/catch removed
    # ------------------------------------------------------------------

    def test_start_event_consumers_no_outer_try_catch(self):
        """
        startEventConsumers must NOT wrap its channel.consume calls in a top-level
        try/catch that swallows bootstrap errors. Check that the function body's first
        statement is NOT try (the outer catch was the problem).

        We verify by counting 'try' blocks inside startEventConsumers. The allowed
        inner try/catch blocks are only the per-message handlers — none should wrap
        the entire assertQueue/bindQueue/consume setup.
        """
        with open(ADMIN_CONSUMERS_FILE) as f:
            src = f.read()

        # Locate the function
        fn_start = src.find("export async function startEventConsumers()")
        assert fn_start != -1, "startEventConsumers not found in rabbitmq.consumers.js"

        # Extract the function body (up to end of file is fine for counting)
        fn_body = src[fn_start:]

        # The outer wrapper try/catch would appear immediately after the opening brace.
        # Allowed: per-message try/catch inside consume callbacks.
        # If there was an outer try around the entire body, the first try would occur
        # before any channel.consume call.
        first_try_pos = fn_body.find("try {")
        first_consume_pos = fn_body.find("channel.consume(")

        assert first_consume_pos != -1, (
            "channel.consume not found inside startEventConsumers"
        )
        assert first_try_pos > first_consume_pos, (
            "Outer try/catch still wraps startEventConsumers body — "
            f"first 'try {{' at offset {first_try_pos}, "
            f"first 'channel.consume(' at offset {first_consume_pos}"
        )

    # ------------------------------------------------------------------
    # 4. admin-service: bootstrap().catch() + process.exit(1) present
    # ------------------------------------------------------------------

    def test_bootstrap_catch_calls_process_exit(self):
        """bootstrap().catch() must call process.exit(1) on startup failure."""
        with open(ADMIN_APP_FILE) as f:
            src = f.read()

        assert "bootstrap().catch" in src, (
            "bootstrap().catch() not found in admin-service app.js"
        )
        # The catch block must terminate the process
        catch_pos = src.index("bootstrap().catch")
        catch_snippet = src[catch_pos : catch_pos + 200]
        assert "process.exit(1)" in catch_snippet, (
            f"process.exit(1) not found in bootstrap().catch block: {catch_snippet!r}"
        )

    # ------------------------------------------------------------------
    # 5. Smoke test: admin routes still work end-to-end after the changes
    # ------------------------------------------------------------------

    def test_admin_users_route_still_200(self, admin_token):
        """Admin management routes must remain functional after controller changes."""
        r = requests.get(
            f"{BASE}/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10,
        )
        assert r.status_code == 200, (
            f"GET /api/admin/users returned {r.status_code}: {r.text[:200]}"
        )

    def test_admin_providers_route_still_200(self, admin_token):
        """GET /api/admin/providers must return 200 with the provider list."""
        r = requests.get(
            f"{BASE}/admin/providers",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10,
        )
        assert r.status_code == 200, (
            f"GET /api/admin/providers returned {r.status_code}: {r.text[:200]}"
        )

    def test_admin_nonexistent_provider_returns_structured_error(self, admin_token):
        """
        GET /api/admin/providers/:id with a bad ID must return a structured JSON error
        (not a crash), proving try/catch+next works and errorMiddleware runs.
        """
        r = requests.get(
            f"{BASE}/admin/providers/nonexistent-id-xyz",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10,
        )
        assert r.status_code in (400, 404, 500), (
            f"Unexpected status {r.status_code}"
        )
        # Response must be JSON, not an empty body or HTML stack trace
        try:
            body = r.json()
        except Exception:
            pytest.fail(
                f"Response is not JSON — errorMiddleware did not run. "
                f"status={r.status_code}, body={r.text[:300]}"
            )
        # errorMiddleware emits a 'message' field
        assert "message" in body or "error" in body or "status" in body, (
            f"Structured error body missing 'message'/'error'/'status': {body}"
        )
