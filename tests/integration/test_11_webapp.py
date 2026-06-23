import pytest
from helpers import get, shell, WEBAPP


class TestWebAppSmokeTest:
    SUITE_ID   = 11
    SUITE_NAME = "Web App Smoke Test"

    def test_webapp_returns_200(self):
        code, _ = get(WEBAPP, timeout=5)
        assert code == 200, f"GET {WEBAPP} HTTP {code}"

    def test_react_root_div_present(self):
        rc, out, _ = shell(f"curl -s {WEBAPP} | grep -c '<div id=\"root\"'")
        count = int(out) if out.isdigit() else 0
        assert count >= 1, f"React root <div id=\"root\"> not found in HTML (count={count})"
