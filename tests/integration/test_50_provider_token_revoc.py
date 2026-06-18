import time
import pytest
from helpers import get, post, _request, GATEWAY, MQ_API


_TS          = int(time.time())
_EPROV_NAME  = f"provRevoc50_{_TS}"
_EPROV_EMAIL = f"provrevoc50_{_TS}@saasplug.test"
_EPROV_PASS  = "ProvRevoc@50"
_EPROV_CODE  = "saasplug-provider-2024"   # env var value from .env


class TestProviderTokenRevocation:
    SUITE_ID   = 50
    SUITE_NAME = "Event flow: provider.delete revokes provider JWT"

    _eprov_token     = None
    _eprov_id        = None

    # ── Verify canonical provider token still works ───────────────────────────

    def test_canonical_provider_token_works(self, provider_token):
        if not provider_token:
            pytest.skip("provider login failed")
        code, _ = get(f"{GATEWAY}/api/analytics/global", token=provider_token)
        assert code == 200, f"Provider token on /analytics/global should be 200, got {code}"

    # ── Register ephemeral provider ───────────────────────────────────────────

    def test_register_ephemeral_provider(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        # Try self-registration path first; fall back to admin path
        code, data = post(f"{GATEWAY}/api/auth/provider/register",
                          {"email": _EPROV_EMAIL, "password": _EPROV_PASS,
                           "providerName": _EPROV_NAME,
                           "apiBaseUrl": "http://revoc50.local",
                           "apiKey": "revoc50key",
                           "registrationCode": _EPROV_CODE})
        if code not in (200, 201):
            # Fall back to admin registration
            code, data = post(f"{GATEWAY}/api/admin/providers",
                              {"providerName": _EPROV_NAME, "email": _EPROV_EMAIL,
                               "password": _EPROV_PASS,
                               "apiBaseUrl": "http://revoc50.local",
                               "apiKey": "revoc50key"},
                              token=admin_token)
        assert code in (200, 201), f"Register ephemeral provider HTTP {code}: {data}"

    def test_ephemeral_provider_login_works(self):
        time.sleep(2)  # wait for provider.registered event
        code, data = post(f"{GATEWAY}/api/auth/login",
                          {"email": _EPROV_EMAIL, "password": _EPROV_PASS})
        assert code == 200, f"Ephemeral provider login HTTP {code}: {data}"
        tok = data.get("accessToken") if isinstance(data, dict) else None
        assert tok, f"No accessToken in login response: {data}"
        TestProviderTokenRevocation._eprov_token = tok

    def test_ephemeral_provider_token_is_valid(self):
        tok = TestProviderTokenRevocation._eprov_token
        if not tok:
            pytest.skip("ephemeral provider token not obtained")
        code, _ = get(f"{GATEWAY}/api/analytics/global", token=tok)
        assert code == 200, \
            f"Ephemeral provider token should work before delete, got {code}"

    def test_find_ephemeral_provider_id(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, providers = get(f"{GATEWAY}/api/providers", token=admin_token)
        if code != 200 or not isinstance(providers, list):
            pytest.skip("provider list unavailable")
        eprov = next((p for p in providers
                      if p.get("providerName") == _EPROV_NAME), None)
        assert eprov is not None, \
            f"Ephemeral provider '{_EPROV_NAME}' not found in provider list"
        TestProviderTokenRevocation._eprov_id = eprov.get("providerId")

    def test_delete_provider_revokes_token(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        pid = TestProviderTokenRevocation._eprov_id
        tok = TestProviderTokenRevocation._eprov_token
        if not pid or not tok:
            pytest.skip("ephemeral provider not set up")

        code, data = _request("DELETE",
                               f"{GATEWAY}/api/admin/providers/delete/{pid}",
                               token=admin_token)
        assert code == 200, f"DELETE provider HTTP {code}: {data}"

        # Wait for token revocation event chain:
        # provider.delete → auth-service deletes AuthUser & publishes token.revoked
        # → analytics-service picks it up → revokedEmails.add(email)
        time.sleep(5)

        code2, data2 = get(f"{GATEWAY}/api/analytics/global", token=tok)
        assert code2 == 401, \
            f"Revoked provider token should return 401, got {code2}: {data2}"

    def test_revoked_token_response_has_message(self):
        tok = TestProviderTokenRevocation._eprov_token
        if not tok:
            pytest.skip("ephemeral provider token not obtained")
        code, data = get(f"{GATEWAY}/api/analytics/global", token=tok)
        if code != 401:
            pytest.skip(f"Expected 401, got {code}")
        assert isinstance(data, dict), f"Revoked token 401 should be JSON dict: {data!r}"
        has_msg = bool(data.get("error") or data.get("message") or data.get("returnCode"))
        assert has_msg, f"401 body missing error/message field: {list(data.keys())}"

    # ── charger.provider.delete.queue verification ────────────────────────────

    def test_charger_provider_delete_queue_has_consumer(self):
        code, queues = get(f"{MQ_API}/api/queues", basic=("guest", "guest"))
        if code != 200 or not isinstance(queues, list):
            pytest.skip("RabbitMQ management API unavailable")
        q = next((x for x in queues
                  if x.get("name") == "charger.provider.delete.queue"), None)
        assert q is not None, "charger.provider.delete.queue does not exist"
        assert q.get("consumers", 0) >= 1, \
            f"charger.provider.delete.queue has {q.get('consumers', 0)} consumers"

    # ── auth.provider.delete.queue verification ───────────────────────────────

    def test_auth_provider_delete_queue_has_consumer(self):
        code, queues = get(f"{MQ_API}/api/queues", basic=("guest", "guest"))
        if code != 200 or not isinstance(queues, list):
            pytest.skip("RabbitMQ management API unavailable")
        q = next((x for x in queues
                  if x.get("name") == "auth.provider.delete.queue"), None)
        assert q is not None, "auth.provider.delete.queue does not exist"
        assert q.get("consumers", 0) >= 1, \
            f"auth.provider.delete.queue has {q.get('consumers', 0)} consumers"
