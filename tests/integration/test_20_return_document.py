import subprocess
import time
import pytest
from helpers import get, post, _request, GATEWAY


class TestAuthServiceReturnDocument:
    SUITE_ID   = 20
    SUITE_NAME = "auth-service returnDocument:after (B4)"

    def test_new_true_absent_from_repository(self):
        r = subprocess.run(
            ["docker", "exec", "auth_service", "grep", "-rn", "new: true",
             "src/repositories/auth-user.repository.js"],
            capture_output=True, text=True, timeout=10,
        )
        assert r.returncode != 0, \
            f"auth-user.repository.js still uses {{new: true}}: {r.stdout.strip()[:120]}"

    def test_return_document_present_in_repository(self):
        r = subprocess.run(
            ["docker", "exec", "auth_service", "grep", "-c", "returnDocument",
             "src/repositories/auth-user.repository.js"],
            capture_output=True, text=True, timeout=10,
        )
        count = int(r.stdout.strip() or "0") if r.returncode == 0 else 0
        assert count >= 1, "auth-user.repository.js: returnDocument not found"

    def test_register_login_and_profile_return_correct_document(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")

        test_email = f"b4retdoc{int(time.time())}@saasplug.test"

        reg_code, reg_body = post(f"{GATEWAY}/api/auth/register",
                                  {"email": test_email, "password": "Xt@98765",
                                   "name": "B4 RetDoc", "role": "user"})
        assert reg_code in (200, 201), \
            f"Register HTTP {reg_code}: {str(reg_body)[:80]}"
        new_uid = reg_body.get("userId") if isinstance(reg_body, dict) else None

        tok_code, tok_body = post(f"{GATEWAY}/api/auth/login",
                                  {"email": test_email, "password": "Xt@98765"})
        new_token = tok_body.get("accessToken") if isinstance(tok_body, dict) else None
        assert new_token, f"Login HTTP {tok_code}: no accessToken"

        me_code, me_body = get(f"{GATEWAY}/api/users/me", token=new_token)
        assert me_code == 200, f"GET /api/users/me HTTP {me_code}"
        assert isinstance(me_body, dict) and me_body.get("email") == test_email, \
            f"Expected email={test_email}, got {me_body.get('email') if isinstance(me_body, dict) else me_body}"

        # Cleanup
        if new_uid:
            time.sleep(0.5)
            _request("DELETE", f"{GATEWAY}/api/admin/users/{new_uid}", token=admin_token)
