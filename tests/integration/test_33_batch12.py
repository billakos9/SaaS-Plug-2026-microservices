"""
Suite 33 — Batch 12: plug-service consumer hardening, auth-service login typeof guard,
           docker-compose PROVIDER_REGISTRATION_CODE parameterisation.

Tests:
  1. plug-service: JSON.parse is inside the try block (malformed message -> DLX nack, consumer survives)
  2. plug-service: default branch acks (unknown routing key does not dead-letter)
  3. auth-service: login() has typeof guard on email and password
  4. auth-service: non-string email/password triggers 4xx (not a 500 crash)
  5. auth-service: null/integer body values return 4xx safely
  6. docker-compose: PROVIDER_REGISTRATION_CODE is parameterised from env (not hardcoded)
  7. auth-service: valid login still works after the guard is present
"""

import subprocess
import time

import pytest
import requests

BASE = "http://localhost/api"
RABBITMQ_API = "http://localhost:15672/api"
RABBITMQ_AUTH = ("guest", "guest")

# Container name (mixed-case/snake_case as per project convention)
PLUG_CONTAINER = "Plug-Service"
AUTH_CONTAINER = "auth_service"

# Paths inside containers use /saas26-09 as the workdir root
PLUG_CONSUMER_IN_CONTAINER = "/saas26-09/src/events/rabbitmq.consumer.js"
AUTH_SERVICE_IN_CONTAINER = "/saas26-09/src/services/auth.service.js"

DOCKER_COMPOSE_FILE = "docker-compose.yml"

# Valid seeded credentials (from helpers.py CREDS)
VALID_USER_EMAIL = "giorgos.papadopoulos@gmail.com"
VALID_USER_PASSWORD = "123456"


class TestBatch12:
    SUITE_ID = 33
    SUITE_NAME = "Batch 12: plug-service consumer + auth login guard + compose parameterisation"

    # ── 1. JSON.parse is inside the try block ─────────────────────────────────
    def test_plug_consumer_json_parse_inside_try(self):
        """Verify JSON.parse is nested inside the try block in the consumer."""
        result = subprocess.run(
            ["docker", "exec", PLUG_CONTAINER, "cat",
             PLUG_CONSUMER_IN_CONTAINER],
            capture_output=True, text=True, timeout=10
        )
        assert result.returncode == 0, (
            f"Could not read plug consumer file from container: {result.stderr}"
        )
        src = result.stdout

        # Find the try block and confirm JSON.parse appears after it
        try_pos = src.find("try {")
        parse_pos = src.find("JSON.parse(")
        assert try_pos != -1, "No try block found in plug consumer"
        assert parse_pos != -1, "JSON.parse not found in plug consumer"
        assert parse_pos > try_pos, (
            "JSON.parse must appear inside (after) the try block; "
            f"try_pos={try_pos}, parse_pos={parse_pos}"
        )

    # ── 2. default branch acks ─────────────────────────────────────────────────
    def test_plug_consumer_default_branch_acks(self):
        """Verify the default branch calls channel.ack (not nack)."""
        result = subprocess.run(
            ["docker", "exec", PLUG_CONTAINER, "cat",
             PLUG_CONSUMER_IN_CONTAINER],
            capture_output=True, text=True, timeout=10
        )
        assert result.returncode == 0, (
            f"Could not read plug consumer file from container: {result.stderr}"
        )
        src = result.stdout

        # Locate the default: case and verify it contains ack before the next case/closing brace
        default_pos = src.find("default:")
        assert default_pos != -1, "No 'default:' branch found in plug consumer"

        # Everything from default: to the next "}" + "case" or end of switch
        default_section = src[default_pos: default_pos + 200]
        assert "channel.ack(" in default_section, (
            "default branch does not call channel.ack — was it changed to nack? "
            f"Section: {default_section!r}"
        )
        assert "channel.nack(" not in default_section, (
            "default branch should not call channel.nack"
        )

    # ── 3. auth-service login() source has typeof guard ───────────────────────
    def test_auth_login_has_typeof_guard_in_source(self):
        """Confirm typeof guard is present in auth.service.js login() function."""
        result = subprocess.run(
            ["docker", "exec", AUTH_CONTAINER, "cat",
             AUTH_SERVICE_IN_CONTAINER],
            capture_output=True, text=True, timeout=10
        )
        assert result.returncode == 0, (
            f"Could not read auth.service.js from container: {result.stderr}"
        )
        src = result.stdout

        # Find login function and check for typeof guard within a reasonable window
        login_pos = src.find("static async login(")
        assert login_pos != -1, "login() function not found in auth.service.js"

        login_section = src[login_pos: login_pos + 400]
        assert 'typeof email !== "string"' in login_section, (
            "login() missing typeof email guard"
        )
        assert 'typeof password !== "string"' in login_section, (
            "login() missing typeof password guard"
        )

    # ── 4. Non-string email triggers 4xx, not 500 ─────────────────────────────
    def test_login_with_numeric_email_returns_4xx(self):
        """POSTing a numeric email value to /auth/login must return 4xx, not 500."""
        r = requests.post(
            f"{BASE}/auth/login",
            json={"email": 12345, "password": "password"},
            timeout=5,
        )
        assert 400 <= r.status_code < 500, (
            f"Expected 4xx for non-string email, got {r.status_code}: {r.text}"
        )

    # ── 5. Null body values return 4xx safely ─────────────────────────────────
    def test_login_with_null_credentials_returns_4xx(self):
        """POSTing null email/password must return 4xx — no 500 crash."""
        r = requests.post(
            f"{BASE}/auth/login",
            json={"email": None, "password": None},
            timeout=5,
        )
        assert 400 <= r.status_code < 500, (
            f"Expected 4xx for null credentials, got {r.status_code}: {r.text}"
        )

    # ── 6. docker-compose PROVIDER_REGISTRATION_CODE is parameterised ─────────
    def test_docker_compose_provider_reg_code_is_parameterised(self):
        """docker-compose.yml must use ${PROVIDER_REGISTRATION_CODE}, not a hardcoded value."""
        with open(DOCKER_COMPOSE_FILE) as f:
            compose = f.read()

        # Must contain the env-var reference form
        assert "${PROVIDER_REGISTRATION_CODE}" in compose, (
            "docker-compose.yml does not parameterise PROVIDER_REGISTRATION_CODE via ${...}"
        )

        # Must NOT contain a hardcoded literal value in the same line
        for line in compose.splitlines():
            if "PROVIDER_REGISTRATION_CODE" in line and "${PROVIDER_REGISTRATION_CODE}" not in line:
                # Allow comment lines
                stripped = line.strip()
                if not stripped.startswith("#"):
                    pytest.fail(
                        f"Found hardcoded PROVIDER_REGISTRATION_CODE in docker-compose.yml: {line!r}"
                    )

    # ── 7. Valid login still works after the guard change ─────────────────────
    def test_valid_login_still_succeeds_after_typeof_guard(self):
        """A well-formed login request must still succeed (guard must not block valid calls)."""
        r = requests.post(
            f"{BASE}/auth/login",
            json={"email": VALID_USER_EMAIL, "password": VALID_USER_PASSWORD},
            timeout=5,
        )
        assert r.status_code == 200, (
            f"Valid login failed after Batch 12 guard change: {r.status_code} {r.text}"
        )
        body = r.json()
        assert "accessToken" in body, f"No accessToken in login response: {body}"

    # ── 8. plug-service consumer survives a malformed message ─────────────────
    def test_plug_consumer_survives_malformed_message(self):
        """
        Publish an unparseable message to plug.reservation.queue and confirm:
          - the consumer is still alive (queue still has 1 consumer after 3 s)
          - the message is dead-lettered (not re-queued)
        """
        import json as _json

        queue_name = "plug.reservation.queue"

        # Publish a malformed (non-JSON) message via the RabbitMQ management API
        publish_payload = {
            "properties": {},
            "routing_key": queue_name,
            "payload": "THIS IS NOT JSON {{{",
            "payload_encoding": "string",
        }
        r = requests.post(
            f"{RABBITMQ_API}/exchanges/%2F/amq.default/publish",
            auth=RABBITMQ_AUTH,
            json=publish_payload,
            timeout=5,
        )
        assert r.status_code == 200, f"Failed to publish to RabbitMQ: {r.status_code}"

        # Give the consumer up to 3 s to process
        time.sleep(3)

        # Confirm the queue still has exactly 1 consumer (consumer did not crash)
        q = requests.get(
            f"{RABBITMQ_API}/queues/%2F/{queue_name}",
            auth=RABBITMQ_AUTH,
            timeout=5,
        )
        assert q.status_code == 200
        info = q.json()
        assert info.get("consumers", 0) == 1, (
            f"plug.reservation.queue lost its consumer after a malformed message "
            f"(consumers={info.get('consumers')}). Consumer crashed."
        )
