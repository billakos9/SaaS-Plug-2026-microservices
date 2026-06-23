"""Suite 30 — Batch 8 (N31): { algorithms: ['HS256'] } added to all jwt.verify() calls."""

import pytest
from helpers import get, GATEWAY

_MIDDLEWARES = [
    ("auth-service",        "services/auth-service/src/middleware/auth.middleware.js"),
    ("user-service",        "services/user-service/src/middleware/auth.middleware.js"),
    ("reservation-service", "services/reservation-service/src/middleware/auth.middleware.js"),
    ("charger-service",     "services/charger-service/src/middleware/auth.middleware.js"),
    ("provider-service",    "services/provider-service/src/middleware/auth.middleware.js"),
    ("analytics-service",   "services/analytics-service/src/middleware/auth.middleware.js"),
    ("billing-service",     "services/billing-service/src/middleware/auth.middleware.js"),
    ("admin-service",       "services/admin-service/src/middleware/auth.middleware.js"),
]


class TestBatch8JwtAlgorithmRestriction:
    SUITE_ID   = 30
    SUITE_NAME = "Batch 8: jwt.verify HS256 algorithm restriction across all services"

    # ── Source checks: every middleware must pin HS256 ────────────────────────

    @pytest.mark.parametrize("svc_name,path_str", _MIDDLEWARES)
    def test_middleware_pins_hs256(self, svc_name, path_str):
        from pathlib import Path
        p = Path(path_str)
        assert p.exists(), f"source file not found: {p}"
        src = p.read_text()
        has_alg = 'algorithms: ["HS256"]' in src or "algorithms: ['HS256']" in src
        assert has_alg, \
            f"{svc_name}: jwt.verify missing {{ algorithms: [\"HS256\"] }} in {p}"

    # ── auth.service.js still issues tokens ───────────────────────────────────

    def test_auth_service_issues_jwt(self):
        from pathlib import Path
        p = Path("services/auth-service/src/services/auth.service.js")
        assert p.exists(), f"source file not found: {p}"
        src = p.read_text()
        assert "jwt.sign" in src, "jwt.sign not found in auth.service.js"

    # ── Runtime: valid HS256 token accepted by services ──────────────────────

    def test_hs256_token_accepted_by_charger_service(self, user_token):
        code, _ = get(f"{GATEWAY}/api/chargers", token=user_token, timeout=5)
        assert code == 200, \
            f"valid HS256 token rejected by charger-service: HTTP {code}"

    def test_hs256_token_accepted_by_analytics_service(self, admin_token):
        code, _ = get(f"{GATEWAY}/api/analytics/global", token=admin_token, timeout=8)
        assert code == 200, \
            f"valid HS256 token rejected by analytics-service: HTTP {code}"

    def test_no_token_returns_401_from_provider_service(self):
        """provider-service must return 401 (not 500) — algorithm guard is not crashing the service."""
        code, _ = get(f"{GATEWAY}/api/providers", timeout=5)
        assert code == 401, \
            f"provider-service without token: expected 401, got HTTP {code}"
