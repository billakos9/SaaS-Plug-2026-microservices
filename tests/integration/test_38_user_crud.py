import time
import pytest
from helpers import get, post, put, delete, _request, GATEWAY, CREDS


_REG_EMAIL = f"user_crud_{int(time.time())}@saasplug.test"
_REG_PASS  = "UserCrud@99"


class TestUserCRUD:
    SUITE_ID   = 38
    SUITE_NAME = "User Service: Full CRUD + field validation"

    # ── GET /api/users/me ─────────────────────────────────────────────────────

    def test_get_me_structure(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = get(f"{GATEWAY}/api/users/me", token=user_token)
        assert code == 200, f"GET /api/users/me HTTP {code}"
        assert isinstance(data, dict), f"Response not a dict: {data}"
        for field in ("userId", "email", "role"):
            assert field in data, f"Field '{field}' missing from /me response: {list(data.keys())}"
        assert data.get("role") == "user", f"Expected role=user, got {data.get('role')}"
        assert data.get("email") == CREDS["user"]["email"], \
            f"Email mismatch: {data.get('email')}"

    def test_get_me_no_token_returns_401(self):
        code, _ = get(f"{GATEWAY}/api/users/me")
        assert code == 401, f"GET /api/users/me without token should be 401, got {code}"

    def test_get_me_invalid_token_returns_401(self):
        code, _ = get(f"{GATEWAY}/api/users/me", token="invalid.jwt.token")
        assert code == 401, f"GET /api/users/me with bad token should be 401, got {code}"

    # ── PUT /api/users/me — whitelisted fields ────────────────────────────────

    def test_put_me_firstName(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = put(f"{GATEWAY}/api/users/me", {"firstName": "TestFirst"},
                         token=user_token)
        assert code == 200, f"PUT /me firstName HTTP {code}: {data}"
        assert data.get("firstName") == "TestFirst", \
            f"firstName not updated: {data.get('firstName')}"

    def test_put_me_lastName(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = put(f"{GATEWAY}/api/users/me", {"lastName": "TestLast"},
                         token=user_token)
        assert code == 200, f"PUT /me lastName HTTP {code}: {data}"
        assert data.get("lastName") == "TestLast", \
            f"lastName not updated: {data.get('lastName')}"

    def test_put_me_phoneNumber(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = put(f"{GATEWAY}/api/users/me", {"phoneNumber": "6901234567"},
                         token=user_token)
        assert code == 200, f"PUT /me phoneNumber HTTP {code}: {data}"
        assert data.get("phoneNumber") == "6901234567", \
            f"phoneNumber not updated: {data.get('phoneNumber')}"

    def test_put_me_birthdate(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = put(f"{GATEWAY}/api/users/me", {"birthdate": "1990-01-15"},
                         token=user_token)
        assert code == 200, f"PUT /me birthdate HTTP {code}: {data}"

    def test_put_me_empty_payload_returns_200(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = put(f"{GATEWAY}/api/users/me", {}, token=user_token)
        assert code == 200, f"PUT /me empty body HTTP {code}: {data}"

    def test_put_me_email_injection_blocked(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        original = CREDS["user"]["email"]
        code, data = put(f"{GATEWAY}/api/users/me",
                         {"email": "hacked@evil.com"}, token=user_token)
        assert code == 200, f"PUT /me HTTP {code}"
        assert data.get("email") == original, \
            f"Email was changed to '{data.get('email')}' (injection succeeded)"

    def test_put_me_role_injection_blocked(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, data = put(f"{GATEWAY}/api/users/me",
                         {"role": "admin"}, token=user_token)
        assert code == 200, f"PUT /me HTTP {code}"
        assert data.get("role") == "user", \
            f"Role was changed to '{data.get('role')}' (injection succeeded)"

    def test_put_me_restore_name(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        put(f"{GATEWAY}/api/users/me",
            {"name": "Giorgos Papadopoulos", "firstName": "Giorgos",
             "lastName": "Papadopoulos", "phoneNumber": ""},
            token=user_token)

    # ── Admin GET /api/admin/users ────────────────────────────────────────────

    def test_admin_get_users_structure(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/admin/users", token=admin_token)
        assert code == 200, f"GET /api/admin/users HTTP {code}"
        assert isinstance(data, list) and len(data) > 0, "Expected non-empty list"
        first = data[0]
        assert "userId" in first or "id" in first, \
            f"userId/id missing from user object: {list(first.keys())}"
        assert "email" in first, f"email missing from user object: {list(first.keys())}"

    def test_admin_get_users_no_passwords(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/admin/users", token=admin_token)
        if code != 200 or not isinstance(data, list):
            pytest.skip("user list unavailable")
        for u in data:
            assert "password" not in u, \
                f"password field exposed in user list for userId={u.get('userId')}"

    def test_admin_get_user_by_id_structure(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, users = get(f"{GATEWAY}/api/admin/users", token=admin_token)
        if code != 200 or not isinstance(users, list) or not users:
            pytest.skip("user list unavailable")
        uid = users[0].get("userId") or users[0].get("id")
        code2, data = get(f"{GATEWAY}/api/admin/users/{uid}", token=admin_token)
        assert code2 == 200, f"GET /api/admin/users/{uid} HTTP {code2}: {data}"
        assert isinstance(data, dict), f"Response not a dict: {data}"
        got_uid = data.get("userId") or data.get("id")
        assert str(got_uid) == str(uid), \
            f"Returned userId={got_uid} doesn't match requested {uid}"

    def test_admin_get_user_by_id_nonexistent(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/admin/users/999999", token=admin_token)
        assert code == 404, f"Non-existent user should be 404, got HTTP {code}"
        assert isinstance(data, dict), f"404 body not a dict: {type(data)}"
        has_error = "error" in data or "message" in data or "returnCode" in data
        assert has_error, f"404 JSON missing error/message/returnCode: {list(data.keys())}"

    def test_admin_delete_nonexistent_user_returns_404(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = delete(f"{GATEWAY}/api/admin/users/999999", token=admin_token)
        assert code == 404, f"Delete non-existent user should be 404, got HTTP {code}"

    def test_user_blocked_from_admin_user_list(self, user_token):
        if not user_token:
            pytest.skip("user login failed")
        code, _ = get(f"{GATEWAY}/api/admin/users", token=user_token)
        assert code == 403, f"User token on admin users should be 403, got {code}"

    # ── User sync (user.created event) ───────────────────────────────────────

    def test_user_sync_from_registration(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = post(f"{GATEWAY}/api/auth/register",
                          {"email": _REG_EMAIL, "password": _REG_PASS,
                           "name": "SyncTest User"})
        assert code in (200, 201), f"Register HTTP {code}: {data}"
        time.sleep(3)  # wait for user.created event to propagate
        code2, users = get(f"{GATEWAY}/api/admin/users", token=admin_token)
        assert code2 == 200
        found = any(u.get("email") == _REG_EMAIL for u in (users if isinstance(users, list) else []))
        assert found, f"Registered user '{_REG_EMAIL}' not found in admin user list after 3s"

    def test_zzz_cleanup(self, admin_token):
        if not admin_token:
            pytest.skip("admin login failed")
        code, users = get(f"{GATEWAY}/api/admin/users", token=admin_token)
        if code != 200 or not isinstance(users, list):
            return
        test_user = next((u for u in users if u.get("email") == _REG_EMAIL), None)
        if test_user:
            uid = test_user.get("userId") or test_user.get("id")
            delete(f"{GATEWAY}/api/admin/users/{uid}", token=admin_token)
