"""Shared HTTP helpers, shell utility, and constants for the integration suite."""

import base64
import json
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

GATEWAY = "http://localhost"
MQ_API  = "http://localhost:15672"
WEBAPP  = "http://localhost:5173"
OUT_DIR = Path(".claude/test-results")

CREDS = {
    "user":     {"email": "giorgos.papadopoulos@gmail.com", "password": "123456"},
    "user2":    {"email": "maria.georgiou@hotmail.com",     "password": "123456"},
    "admin":    {"email": "admin@saasplug.app",             "password": "123456"},
    "provider": {"email": "blue@plug.com",                  "password": "123456"},
}

REQUIRED_QUEUES = [
    "charger.management.queue",
    "charger.reservation.queue",
    "plug.reservation.queue",
    "analytics.reservation.queue",
    "billing.reservation.queue",
    "auth.user.update.queue",
    "auth.user.delete.queue",
    "auth.provider.delete.queue",
    "user.profile.queue",
    "provider.registration.queue",
    "admin.charger.events.queue",
    "admin.provider.events.queue",
    "admin.registration.queue",
]


def _request(method, url, body=None, token=None, basic=None, timeout=10):
    data = json.dumps(body).encode() if body is not None else None
    req  = urllib.request.Request(url, data=data, method=method)
    if body is not None:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    if basic:
        cred = base64.b64encode(f"{basic[0]}:{basic[1]}".encode()).decode()
        req.add_header("Authorization", f"Basic {cred}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            try:
                return r.status, json.loads(raw)
            except Exception:
                return r.status, raw.decode(errors="replace")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {}
    except Exception as ex:
        return None, {"_error": str(ex)}


def get(url, token=None, basic=None, timeout=10):
    return _request("GET", url, token=token, basic=basic, timeout=timeout)


def post(url, body, token=None, timeout=10):
    return _request("POST", url, body=body, token=token, timeout=timeout)


def put(url, body, token=None, timeout=10):
    return _request("PUT", url, body=body, token=token, timeout=timeout)


def patch(url, body, token=None, timeout=10):
    return _request("PATCH", url, body=body, token=token, timeout=timeout)


def delete(url, token=None, timeout=10):
    return _request("DELETE", url, token=token, timeout=timeout)


def shell(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return r.returncode, r.stdout.strip(), r.stderr.strip()
