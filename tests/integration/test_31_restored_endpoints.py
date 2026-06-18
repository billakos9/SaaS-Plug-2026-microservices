"""Suite 31 — Restored endpoints: auth selfRegisterProvider + registerAdmin,
analytics getProviderHistory + getGlobalHistory, requireSelfProvider admin bypass,
revokedEmails check in analytics/admin/reservation middleware."""

import time
import pytest
from helpers import get, post, _request, GATEWAY


PROVIDER_REGISTRATION_CODE = "saasplug-provider-2024"
# Prefixes used for all ephemeral providers created in this suite and in test_27.
# test_27::test_b5_5_admin_register_provider_returns_201 creates a provider with
# the "b5s27_" prefix and never cleans it up; we take ownership of that cleanup here.
_EPHEMERAL_PREFIXES = ("s31_", "b5s27_", "selfprov31")


def _cleanup_provider(pname: str, admin_token: str, max_wait: int = 8) -> None:
    """Wait up to max_wait seconds for a provider to appear, then delete it."""
    if not admin_token:
        return
    deadline = time.time() + max_wait
    while time.time() < deadline:
        list_code, list_data = get(f"{GATEWAY}/api/providers", token=admin_token)
        if list_code == 200 and isinstance(list_data, list):
            for p in list_data:
                if isinstance(p, dict) and p.get("providerName") == pname:
                    pid = p.get("providerId")
                    if pid:
                        _request("DELETE",
                                 f"{GATEWAY}/api/admin/providers/delete/{pid}",
                                 token=admin_token)
                    return
        time.sleep(1)


def _purge_ephemeral_providers(admin_token: str) -> None:
    """Delete all providers whose names start with one of the known ephemeral prefixes."""
    if not admin_token:
        return
    list_code, list_data = get(f"{GATEWAY}/api/providers", token=admin_token)
    if list_code != 200 or not isinstance(list_data, list):
        return
    for p in list_data:
        pname = str(p.get("providerName", ""))
        if any(pname.startswith(pfx) for pfx in _EPHEMERAL_PREFIXES):
            pid = p.get("providerId")
            if pid:
                _request("DELETE", f"{GATEWAY}/api/admin/providers/delete/{pid}",
                         token=admin_token)


@pytest.fixture(scope="module", autouse=True)
def cleanup_suite31_providers(admin_token):
    """Remove ephemeral test providers at start and end of this module.

    Covers s31_ (created here) and b5s27_ (created by test_27 with no cleanup).
    """
    _purge_ephemeral_providers(admin_token)   # pre-clean: remove leftovers from prior runs
    yield
    _purge_ephemeral_providers(admin_token)   # post-clean: remove anything created this run


class TestRestoredEndpoints:
    SUITE_ID   = 31
    SUITE_NAME = "Restored: auth register endpoints + analytics history + revokedEmails middleware"

    # ── auth-service: selfRegisterProvider ────────────────────────────────────

    def test_auth_self_register_provider_wrong_code_rejected(self):
        """Bad registration code must be rejected (401/403/400) — code gate is active."""
        ts = int(time.time())
        code, data = post(
            f"{GATEWAY}/api/auth/provider/register",
            {
                "email":            f"selfprov_{ts}@example.com",
                "password":         "TestPass123!",
                "providerName":     f"selfprov_{ts}",
                "apiBaseUrl":       "http://selfprov.example.com",
                "apiKey":           "key123",
                "registrationCode": "WRONG_CODE",
            },
        )
        assert 400 <= code < 500, \
            f"Expected 4xx when registrationCode is wrong, got HTTP {code}"

    def test_auth_self_register_provider_correct_code_succeeds(self, admin_token):
        """Correct registration code creates provider account; cleanup via admin delete."""
        ts    = int(time.time())
        pname = f"s31_a_{ts}"
        code, data = post(
            f"{GATEWAY}/api/auth/provider/register",
            {
                "email":            f"{pname}@example.com",
                "password":         "TestPass123!",
                "providerName":     pname,
                "apiBaseUrl":       "http://selfprov.example.com",
                "apiKey":           "key123",
                "registrationCode": PROVIDER_REGISTRATION_CODE,
            },
        )
        assert code == 201, \
            f"POST /api/auth/provider/register with correct code: HTTP {code} — {str(data)[:120]}"

        # Cleanup: retry loop waits up to 8s for RabbitMQ event to propagate to provider-service
        _cleanup_provider(pname, admin_token)

    def test_auth_self_register_provider_response_shape(self, admin_token):
        """Response from successful self-registration contains expected auth fields."""
        ts    = int(time.time()) + 1
        pname = f"s31_b_{ts}"
        code, data = post(
            f"{GATEWAY}/api/auth/provider/register",
            {
                "email":            f"{pname}@example.com",
                "password":         "TestPass123!",
                "providerName":     pname,
                "apiBaseUrl":       "http://selfprov2.example.com",
                "apiKey":           "key456",
                "registrationCode": PROVIDER_REGISTRATION_CODE,
            },
        )
        assert code == 201, f"Expected 201, got {code}"
        assert isinstance(data, dict), f"Expected dict response, got {type(data).__name__}"
        # Response should include at least one auth/identity field
        has_identity = any(k in data for k in ("accessToken", "token", "message", "email", "userId", "role"))
        assert has_identity, f"Response missing expected identity fields — keys: {list(data.keys())}"

        # Cleanup: retry loop waits up to 8s for RabbitMQ event to propagate to provider-service
        _cleanup_provider(pname, admin_token)

    # ── auth-service: registerAdmin ───────────────────────────────────────────

    def test_auth_register_admin_requires_admin_token(self, user_token):
        """Non-admin cannot create admin accounts."""
        code, _ = post(
            f"{GATEWAY}/api/auth/admin/register",
            {"email": "rogue@example.com", "password": "Test123!", "firstName": "Rogue", "lastName": "User"},
            token=user_token,
        )
        assert code in (401, 403), \
            f"POST /api/auth/admin/register with user token should be 401/403, got HTTP {code}"

    def test_auth_register_admin_no_token_rejected(self):
        """Unauthenticated request to admin register must be rejected."""
        code, _ = post(
            f"{GATEWAY}/api/auth/admin/register",
            {"email": "noauth@example.com", "password": "Test123!", "firstName": "No", "lastName": "Auth"},
        )
        assert code in (401, 403), \
            f"POST /api/auth/admin/register without token should be 401/403, got HTTP {code}"

    def test_auth_register_admin_with_admin_token_succeeds(self, admin_token):
        """Admin JWT can create a new admin account."""
        if not admin_token:
            pytest.skip("admin login failed")
        ts = int(time.time())
        code, data = post(
            f"{GATEWAY}/api/auth/admin/register",
            {
                "email":     f"newadmin31_{ts}@saasplug.test",
                "password":  "TestPass123!",
                "firstName": "Test",
                "lastName":  "Admin31",
            },
            token=admin_token,
        )
        assert code == 201, \
            f"POST /api/auth/admin/register with admin token: HTTP {code} — {str(data)[:120]}"

    # ── analytics-service: getGlobalHistory ──────────────────────────────────

    def test_analytics_global_history_admin_gets_200(self, admin_token):
        """Admin can access the global analytics history endpoint."""
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/analytics/history/global", token=admin_token)
        assert code == 200, f"GET /api/analytics/history/global (admin): HTTP {code}"

    def test_analytics_global_history_returns_list(self, admin_token):
        """Global history returns an array of period objects."""
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/analytics/history/global", token=admin_token)
        assert code == 200
        assert isinstance(data, list) and len(data) > 0, \
            f"Expected non-empty list, got {type(data).__name__} len={len(data) if isinstance(data, list) else 'N/A'}"

    def test_analytics_global_history_item_has_required_fields(self, admin_token):
        """Each item in global history has period, totalReservations, totalEnergyKwh, totalRevenue."""
        if not admin_token:
            pytest.skip("admin login failed")
        _, data = get(f"{GATEWAY}/api/analytics/history/global", token=admin_token)
        if not isinstance(data, list) or not data:
            pytest.skip("no history data returned")
        item = data[0]
        for field in ("period", "totalReservations", "totalEnergyKwh", "totalRevenue"):
            assert field in item, \
                f"Field '{field}' missing from global history item — keys: {list(item.keys())}"

    def test_analytics_global_history_provider_can_access(self, provider_token):
        """Provider token also passes requireProviderAuth and can access global history."""
        if not provider_token:
            pytest.skip("provider login failed")
        code, data = get(f"{GATEWAY}/api/analytics/history/global", token=provider_token)
        assert code == 200, \
            f"GET /api/analytics/history/global (provider): HTTP {code} — {str(data)[:120]}"

    def test_analytics_global_history_user_blocked(self, user_token):
        """Regular user token is rejected from global history (requireProviderAuth)."""
        if not user_token:
            pytest.skip("user login failed")
        code, _ = get(f"{GATEWAY}/api/analytics/history/global", token=user_token)
        assert code in (401, 403), \
            f"GET /api/analytics/history/global (user): expected 401/403, got HTTP {code}"

    def test_analytics_global_history_no_token_blocked(self):
        """Unauthenticated request to global history is rejected."""
        code, _ = get(f"{GATEWAY}/api/analytics/history/global")
        assert code in (401, 403), \
            f"GET /api/analytics/history/global (no token): expected 401/403, got HTTP {code}"

    # ── analytics-service: getProviderHistory ─────────────────────────────────

    def test_analytics_provider_history_returns_200_for_own(self, provider_token):
        """Provider can access their own provider history (requireSelfProvider passes)."""
        if not provider_token:
            pytest.skip("provider login failed")
        code, data = get(
            f"{GATEWAY}/api/analytics/history/provider/bluePlug",
            token=provider_token,
        )
        assert code == 200, \
            f"GET /api/analytics/history/provider/bluePlug (blue provider): HTTP {code}"

    def test_analytics_provider_history_own_is_list(self, provider_token):
        """Provider history returns a list of period stats."""
        if not provider_token:
            pytest.skip("provider login failed")
        _, data = get(
            f"{GATEWAY}/api/analytics/history/provider/bluePlug",
            token=provider_token,
        )
        assert isinstance(data, list) and len(data) > 0, \
            f"Expected non-empty list for provider history, got {type(data).__name__}"

    def test_analytics_provider_history_item_has_required_fields(self, provider_token):
        """Each item in provider history has period, totalReservations, totalEnergyKwh, totalRevenue."""
        if not provider_token:
            pytest.skip("provider login failed")
        _, data = get(
            f"{GATEWAY}/api/analytics/history/provider/bluePlug",
            token=provider_token,
        )
        if not isinstance(data, list) or not data:
            pytest.skip("no history data returned")
        item = data[0]
        for field in ("period", "totalReservations", "totalEnergyKwh", "totalRevenue"):
            assert field in item, \
                f"Field '{field}' missing from provider history item — keys: {list(item.keys())}"

    # ── requireSelfProvider: admin bypass + cross-provider block ──────────────

    def test_require_self_provider_blocks_cross_provider_access(self, provider_token):
        """Blue provider cannot access red provider's history — requireSelfProvider returns 403."""
        if not provider_token:
            pytest.skip("provider login failed")
        code, _ = get(
            f"{GATEWAY}/api/analytics/history/provider/redPlug",
            token=provider_token,
        )
        assert code == 403, \
            f"bluePlug accessing redPlug history: expected 403, got HTTP {code}"

    def test_require_self_provider_admin_bypass(self, admin_token):
        """Admin can access any provider's history — requireSelfProvider lets admin through."""
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(
            f"{GATEWAY}/api/analytics/history/provider/redPlug",
            token=admin_token,
        )
        assert code == 200, \
            f"Admin accessing redPlug history: expected 200, got HTTP {code} — {str(data)[:120]}"

    # ── revokedEmails in analytics middleware (source check) ──────────────────

    def test_analytics_middleware_imports_revoked_emails(self):
        """analytics-service auth middleware imports revokedEmails (token revocation check)."""
        from pathlib import Path
        p = Path("services/analytics-service/src/middleware/auth.middleware.js")
        assert p.exists(), f"source file not found: {p}"
        src = p.read_text()
        assert "revokedEmails" in src, \
            "revokedEmails not found in analytics-service/src/middleware/auth.middleware.js"

    def test_analytics_middleware_checks_revoked_emails(self):
        """analytics-service middleware calls revokedEmails.has() after jwt.verify."""
        from pathlib import Path
        src = Path("services/analytics-service/src/middleware/auth.middleware.js").read_text()
        assert "revokedEmails.has(" in src, \
            "revokedEmails.has() check missing from analytics middleware"

    # ── revokedEmails in admin middleware (source check) ─────────────────────

    def test_admin_middleware_imports_revoked_emails(self):
        """admin-service auth middleware imports revokedEmails."""
        from pathlib import Path
        p = Path("services/admin-service/src/middleware/auth.middleware.js")
        assert p.exists(), f"source file not found: {p}"
        src = p.read_text()
        assert "revokedEmails" in src, \
            "revokedEmails not found in admin-service/src/middleware/auth.middleware.js"

    def test_admin_middleware_checks_revoked_emails(self):
        """admin-service middleware calls revokedEmails.has() after jwt.verify."""
        from pathlib import Path
        src = Path("services/admin-service/src/middleware/auth.middleware.js").read_text()
        assert "revokedEmails.has(" in src, \
            "revokedEmails.has() check missing from admin middleware"

    # ── revokedEmails in reservation middleware (source check) ────────────────

    def test_reservation_middleware_imports_revoked_emails(self):
        """reservation-service auth middleware imports revokedEmails."""
        from pathlib import Path
        p = Path("services/reservation-service/src/middleware/auth.middleware.js")
        assert p.exists(), f"source file not found: {p}"
        src = p.read_text()
        assert "revokedEmails" in src, \
            "revokedEmails not found in reservation-service/src/middleware/auth.middleware.js"

    def test_reservation_middleware_checks_revoked_emails(self):
        """reservation-service middleware calls revokedEmails.has() after jwt.verify."""
        from pathlib import Path
        src = Path("services/reservation-service/src/middleware/auth.middleware.js").read_text()
        assert "revokedEmails.has(" in src, \
            "revokedEmails.has() check missing from reservation middleware"

    # ── source-level: selfRegisterProvider and registerAdmin exist ────────────

    def test_auth_service_has_self_register_provider_function(self):
        """auth-service/src/services/auth.service.js contains selfRegisterProvider."""
        from pathlib import Path
        src = Path("services/auth-service/src/services/auth.service.js").read_text()
        assert "selfRegisterProvider" in src, \
            "selfRegisterProvider not found in auth.service.js"

    def test_auth_service_has_register_admin_function(self):
        """auth-service/src/services/auth.service.js contains registerAdmin."""
        from pathlib import Path
        src = Path("services/auth-service/src/services/auth.service.js").read_text()
        assert "registerAdmin" in src, \
            "registerAdmin not found in auth.service.js"

    def test_analytics_service_has_get_provider_history(self):
        """analytics-service/src/services/analytics.service.js contains getProviderHistory."""
        from pathlib import Path
        src = Path("services/analytics-service/src/services/analytics.service.js").read_text()
        assert "getProviderHistory" in src, \
            "getProviderHistory not found in analytics.service.js"

    def test_analytics_service_has_get_global_history(self):
        """analytics-service/src/services/analytics.service.js contains getGlobalHistory."""
        from pathlib import Path
        src = Path("services/analytics-service/src/services/analytics.service.js").read_text()
        assert "getGlobalHistory" in src, \
            "getGlobalHistory not found in analytics.service.js"

    def test_analytics_middleware_has_require_self_provider(self):
        """analytics-service auth middleware exports requireSelfProvider."""
        from pathlib import Path
        src = Path("services/analytics-service/src/middleware/auth.middleware.js").read_text()
        assert "requireSelfProvider" in src, \
            "requireSelfProvider not found in analytics-service auth middleware"
