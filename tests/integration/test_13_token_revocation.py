import time
import pytest
from helpers import get, post, _request, GATEWAY


class TestTokenRevocation:
    SUITE_ID   = 13
    SUITE_NAME = "Token Revocation on User Delete (Issue #17)"

    def test_revoked_token_rejected_after_user_delete(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")

        ts         = int(time.time())
        test_email = f"revtest.suite13.{ts}@saasplug.test"

        code_reg, resp_reg = post(f"{GATEWAY}/api/auth/register",
                                  {"email": test_email, "password": "Rv@12345",
                                   "name": "RevTest Suite13"})
        assert code_reg in (200, 201), \
            f"Register throwaway user HTTP {code_reg}: {resp_reg}"

        code_l, resp_l = post(f"{GATEWAY}/api/auth/login",
                              {"email": test_email, "password": "Rv@12345"})
        assert code_l == 200, f"Login HTTP {code_l}"
        token = resp_l.get("accessToken") if isinstance(resp_l, dict) else None
        assert token, "Login did not return accessToken"
        user_id = resp_l.get("userId") if isinstance(resp_l, dict) else None

        code_me, _ = get(f"{GATEWAY}/api/users/me", token=token)
        assert code_me == 200, f"Fresh token rejected by /api/users/me: HTTP {code_me}"

        if not user_id:
            _, me_data = get(f"{GATEWAY}/api/users/me", token=token)
            user_id = me_data.get("userId") if isinstance(me_data, dict) else None
        assert user_id, "Could not determine userId"

        code_del, resp_del = _request("DELETE",
                                      f"{GATEWAY}/api/admin/users/{user_id}",
                                      token=admin_token)
        assert code_del == 200, f"DELETE /api/admin/users/{user_id} HTTP {code_del}: {resp_del}"

        time.sleep(3)

        code_rev, resp_rev = get(f"{GATEWAY}/api/users/me", token=token)
        assert code_rev == 401, \
            f"Old token should be rejected after delete (expect 401), got HTTP {code_rev}: {resp_rev}"

        if isinstance(resp_rev, dict):
            assert "revoked" in str(resp_rev).lower(), \
                f"401 body does not mention 'revoked': {resp_rev}"
