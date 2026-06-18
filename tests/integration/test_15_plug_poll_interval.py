import re
import subprocess
from datetime import datetime, timezone

import pytest


class TestPlugServicePollInterval:
    SUITE_ID   = 15
    SUITE_NAME = "Plug-Service Poll Interval (Issue #19)"

    def test_poll_interval_env_is_15(self):
        result = subprocess.run(
            ["docker", "exec", "Plug-Service", "env"],
            capture_output=True, text=True,
        )
        env_lines = result.stdout.splitlines()
        poll_line = next(
            (ln for ln in env_lines if ln.startswith("POLL_INTERVAL_MINUTES=")), None
        )
        assert poll_line is not None, "POLL_INTERVAL_MINUTES not set in Plug-Service container"
        value = poll_line.split("=", 1)[1].strip()
        assert value == "15", f"POLL_INTERVAL_MINUTES={value} (expected 15)"

    def test_consecutive_poll_cycles_spaced_14_min_apart(self):
        logs_result = subprocess.run(
            ["docker", "logs", "--timestamps", "Plug-Service"],
            capture_output=True, text=True,
        )
        all_lines = (logs_result.stdout + logs_result.stderr).splitlines()

        ts_re = re.compile(r"^(\S+)\s+Fetching points from http://blueplug")
        cycle_times = []
        for line in all_lines:
            m = ts_re.match(line)
            if m:
                try:
                    ts_str = m.group(1)[:26] + "Z"
                    ts = datetime.strptime(ts_str, "%Y-%m-%dT%H:%M:%S.%fZ").replace(
                        tzinfo=timezone.utc
                    )
                    cycle_times.append(ts)
                except ValueError:
                    pass

        if len(cycle_times) < 2:
            # Not enough cycles to measure — env var check already passed
            pytest.skip(
                f"Only {len(cycle_times)} poll cycle(s) observed — interval not yet measurable"
            )

        gaps = [
            (cycle_times[i + 1] - cycle_times[i]).total_seconds() / 60
            for i in range(len(cycle_times) - 1)
        ]
        min_gap = min(gaps)
        assert min_gap >= 14.0, \
            f"Min gap between poll cycles = {min_gap:.1f} min (expected >= 14 min)"
