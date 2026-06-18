import subprocess
import pytest


_SERVICES = [
    ("reservation_service", "reservation-service"),
    ("auth_service",        "auth-service"),
    ("charger_service",     "charger-service"),
    ("billing_service",     "billing-service"),
    ("analytics_service",   "analytics-service"),
    ("provider_service",    "provider-service"),
    ("user_service",        "user-service"),
    ("admin_service",       "admin-service"),
    ("Plug-Service",        "plug-service"),
]


class TestDualChannelArchitecture:
    SUITE_ID   = 14
    SUITE_NAME = "Dual-Channel RabbitMQ Architecture (Issue #20)"

    def test_no_channel_errors_in_service_logs(self):
        offending = []
        for container, svc in _SERVICES:
            try:
                out = subprocess.check_output(
                    ["docker", "logs", container], stderr=subprocess.STDOUT, text=True
                )
                bad = [ln for ln in out.splitlines()
                       if any(kw in ln.lower()
                              for kw in ("channel closed", "channel error", "channel-error"))]
                if bad:
                    offending.append(f"{svc}: {bad[0][:120]}")
            except Exception as exc:
                offending.append(f"{svc}: log fetch failed — {exc}")
        assert not offending, \
            "Channel errors found in service logs: " + "; ".join(offending)

    def test_reservation_service_has_publish_channel(self):
        result = subprocess.run(
            ["docker", "exec", "reservation_service", "grep", "-l", "publishChannel",
             "src/infrastructure/rabbitMQ.js"],
            capture_output=True, text=True,
        )
        assert result.returncode == 0, \
            "reservation-service rabbitMQ.js does not contain publishChannel"

    def test_billing_service_has_no_publish_channel(self):
        result = subprocess.run(
            ["docker", "exec", "billing_service", "grep", "publishChannel",
             "src/infrastructure/rabbitMQ.js"],
            capture_output=True, text=True,
        )
        assert result.returncode != 0, \
            "billing-service (consumer-only) unexpectedly contains publishChannel"
