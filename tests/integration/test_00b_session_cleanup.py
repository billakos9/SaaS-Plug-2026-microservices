"""Suite 00b — Session-startup cleanup.

Removes ephemeral provider records left by prior test runs before any
count-sensitive tests (test_05, test_17) execute.

Covers:
  - "b5s27_" providers created by test_27::test_b5_5_admin_register_provider_returns_201
    (that test has no teardown)
  - "s31_"   providers created by test_31 (belt-and-suspenders, test_31 also self-cleans)
  - "selfprov31" providers created by test_31

This file must sort before test_05 so that count assertions see exactly 3 canonical
providers (bluePlug / redPlug / greenPlug).
"""

import pytest
from helpers import get, _request, GATEWAY

_EPHEMERAL_PREFIXES = ("b5s27_", "s31_", "selfprov31")


class TestSessionCleanup:
    # No SUITE_ID/SUITE_NAME: this is a utility cleanup class, not tracked in the JSON summary.

    def test_remove_ephemeral_providers(self, admin_token):
        """Delete any ephemeral providers left by prior test runs."""
        if not admin_token:
            pytest.skip("admin login failed — cannot clean up")

        list_code, list_data = get(f"{GATEWAY}/api/providers", token=admin_token)
        if list_code != 200 or not isinstance(list_data, list):
            pytest.skip(f"Cannot list providers (HTTP {list_code})")

        deleted = []
        for p in list_data:
            pname = str(p.get("providerName", ""))
            if any(pname.startswith(pfx) for pfx in _EPHEMERAL_PREFIXES):
                pid = p.get("providerId")
                if pid:
                    _request("DELETE",
                             f"{GATEWAY}/api/admin/providers/delete/{pid}",
                             token=admin_token)
                    deleted.append(pname)

        # Always pass — we only report what was cleaned up
        assert True, f"Cleaned up {len(deleted)} ephemeral provider(s): {deleted}"

    def test_canonical_provider_count_is_3(self, admin_token):
        """After cleanup, exactly 3 canonical providers must exist."""
        if not admin_token:
            pytest.skip("admin login failed")
        code, data = get(f"{GATEWAY}/api/providers", token=admin_token)
        assert code == 200, f"GET /api/providers HTTP {code}"
        count = len(data) if isinstance(data, list) else -1
        assert count == 3, \
            f"Expected 3 canonical providers after cleanup, got {count}: " \
            f"{[p.get('providerName') for p in data] if isinstance(data, list) else data}"
