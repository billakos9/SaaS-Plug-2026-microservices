"""Pytest configuration: session-scoped token fixtures + JSON/text result reporter."""

import json
from datetime import datetime, timezone

import pytest

from helpers import CREDS, GATEWAY, OUT_DIR, post

# ── Fixtures ───────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def tokens():
    result = {}
    for role in ("user", "admin", "provider", "user2"):
        c = CREDS[role]
        code, data = post(f"{GATEWAY}/api/auth/login",
                          {"email": c["email"], "password": c["password"]})
        tok = data.get("accessToken") if isinstance(data, dict) else None
        result[role] = tok
    return result


@pytest.fixture(scope="session")
def user_token(tokens):
    return tokens.get("user")


@pytest.fixture(scope="session")
def admin_token(tokens):
    return tokens.get("admin")


@pytest.fixture(scope="session")
def provider_token(tokens):
    return tokens.get("provider")


@pytest.fixture(scope="session")
def user2_token(tokens):
    return tokens.get("user2")


# ── JSON / text result reporter ────────────────────────────────────────────────
# Maps test class name → (suite_id, suite_name); populated at collection time.

_class_to_suite: dict = {}
_suite_results:  dict = {}
_started: str = ""


def pytest_collection_finish(session):
    for item in session.items:
        cls = item.cls
        if cls and hasattr(cls, "SUITE_ID"):
            cname = cls.__name__
            if cname not in _class_to_suite:
                _class_to_suite[cname] = (cls.SUITE_ID, cls.SUITE_NAME)
                _suite_results[cls.SUITE_ID] = {
                    "id":     cls.SUITE_ID,
                    "name":   cls.SUITE_NAME,
                    "result": "PASS",
                    "checks": [],
                }


def pytest_sessionstart(session):
    global _started
    _started = datetime.now(timezone.utc).isoformat()


def pytest_runtest_logreport(report):
    if report.when != "call":
        return

    parts = report.nodeid.split("::")
    if len(parts) < 3:
        return

    cls_name = parts[-2]
    meta = _class_to_suite.get(cls_name)
    if meta is None:
        return

    suite_id, _ = meta
    suite = _suite_results.get(suite_id)
    if suite is None:
        return

    fn_name = parts[-1]
    label = fn_name[5:].replace("_", " ") if fn_name.startswith("test_") else fn_name

    if report.passed:
        suite["checks"].append({"label": label, "result": "PASS", "detail": ""})
    elif report.failed:
        longrepr = str(report.longrepr)
        lines = longrepr.splitlines()
        detail = next(
            (
                ln.replace("AssertionError: ", "").replace("Failed: ", "")
                for ln in reversed(lines)
                if "AssertionError" in ln or "Failed: " in ln
            ),
            lines[-1] if lines else "",
        )[:200]
        suite["checks"].append({"label": label, "result": "FAIL", "detail": detail})
        suite["result"] = "FAIL"
    elif report.skipped:
        reason = (
            str(report.longrepr[2])
            if isinstance(report.longrepr, tuple)
            else str(report.longrepr)
        )
        suite["checks"].append({"label": label, "result": "SKIP", "detail": reason[:200]})


def pytest_sessionfinish(session, exitstatus):
    finished = datetime.now(timezone.utc).isoformat()
    overall  = "PASS" if exitstatus == 0 else "FAIL"
    suites   = [v for _, v in sorted(_suite_results.items())]

    result = {
        "started":  _started,
        "finished": finished,
        "overall":  overall,
        "suites":   suites,
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "latest.json").write_text(json.dumps(result, indent=2))

    lines = [
        "saasPlug Integration Test Results",
        f"Run: {_started}",
        f"Overall: {overall}",
        "",
        "Suite Summary:",
    ]
    for s in suites:
        icon = "PASS" if s["result"] == "PASS" else "FAIL"
        lines.append(f"  [{icon}] {s['id']:2d}. {s['name']}")
        for c in s["checks"]:
            sym = {"PASS": "       ✓", "FAIL": "       ✗", "SKIP": "       ⚠"}.get(
                c["result"], "       ?"
            )
            detail = f" — {c['detail']}" if c["detail"] else ""
            lines.append(f"{sym} {c['label']}{detail}")

    failed = [s for s in suites if s["result"] == "FAIL"]
    if failed:
        lines += ["", "FAILURES:"]
        for s in failed:
            lines.append(f"  Suite {s['id']} — {s['name']}")
            for c in s["checks"]:
                if c["result"] == "FAIL":
                    lines.append(f"    ✗ {c['label']}: {c['detail']}")

    (OUT_DIR / "latest.txt").write_text("\n".join(lines))
