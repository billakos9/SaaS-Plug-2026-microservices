#!/usr/bin/env python3
"""
setup-dev.py — saasPlug dev environment bootstrap (cross-platform)

Works on Windows (cmd / PowerShell / Git Bash), macOS, and Linux.
Requires Python 3.8+ and Docker Desktop running.

Usage:
  python scripts/setup-dev.py            # fresh setup (wipes volumes)
  python scripts/setup-dev.py --no-wipe  # keep DB data, re-seed
"""

import argparse
import platform
import shutil
import subprocess
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

# ── Colours (disabled on Windows unless ANSI is supported) ───────────────────
IS_WINDOWS = platform.system() == "Windows"

# Windows 10 1511+ supports ANSI in cmd/PowerShell but it must be enabled.
# Simplest approach: just enable it via the kernel if on Windows.
if IS_WINDOWS:
    import ctypes
    try:
        kernel32 = ctypes.windll.kernel32
        kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
        ANSI = True
    except Exception:
        ANSI = False
else:
    ANSI = True

RED    = "\033[0;31m"   if ANSI else ""
GREEN  = "\033[0;32m"   if ANSI else ""
YELLOW = "\033[1;33m"   if ANSI else ""
CYAN   = "\033[0;36m"   if ANSI else ""
BOLD   = "\033[1m"      if ANSI else ""
RESET  = "\033[0m"      if ANSI else ""


def info(msg):    print(f"{CYAN}[setup]{RESET} {msg}", flush=True)
def success(msg): print(f"{GREEN}[setup]{RESET} {msg}", flush=True)
def warn(msg):    print(f"{YELLOW}[setup]{RESET} {msg}", flush=True)
def die(msg):
    print(f"{RED}[setup] ERROR:{RESET} {msg}", file=sys.stderr, flush=True)
    sys.exit(1)


def run(cmd, *, check=True, capture=False, input_bytes=None, cwd=None):
    """Run a command as a list of strings — no shell, no path conversion."""
    kwargs = dict(cwd=cwd)
    if capture:
        kwargs["stdout"] = subprocess.PIPE
        kwargs["stderr"] = subprocess.PIPE
    if input_bytes is not None:
        kwargs["input"] = input_bytes
        kwargs["stdin"] = subprocess.PIPE
    result = subprocess.run(cmd, **kwargs)
    if check and result.returncode != 0:
        die(f"Command failed (exit {result.returncode}): {' '.join(str(c) for c in cmd)}")
    return result


def write_file(path: Path, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


# ── Resolve paths ─────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT       = SCRIPT_DIR.parent
SEEDS_DIR  = SCRIPT_DIR / "seeds"
WEBAPP     = ROOT / "apps" / "web-app"


# ── Args ──────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="saasPlug dev bootstrap")
parser.add_argument("--no-wipe", action="store_true", help="Keep existing DB volumes")
args = parser.parse_args()
WIPE = not args.no_wipe


# ── 0. Prerequisites ──────────────────────────────────────────────────────────
info("Checking prerequisites...")

if not shutil.which("docker"):
    die("docker not found. Install Docker Desktop and ensure it's in PATH.")

result = run(["docker", "ps"], check=False, capture=True)
if result.returncode != 0:
    die("Docker daemon not responding. Ensure Docker Desktop is running and try again.")

NODE = shutil.which("node")
if not NODE:
    die("node not found. Install Node.js >= 20.")

NPM = shutil.which("npm")
if not NPM:
    die("npm not found.")

result = run(["docker", "compose", "version"], check=False, capture=True)
if result.returncode != 0:
    die("docker compose plugin not found. Update Docker Desktop.")

if IS_WINDOWS:
    warn("Windows detected.")

success("All prerequisites satisfied.")
info(f"Project root: {ROOT}")


# ── 1. Write environment files ────────────────────────────────────────────────
info("Writing environment files...")

write_file(ROOT / ".env", "JWT_SECRET=change_me_to_a_strong_secret\n")

write_file(ROOT / "services/auth-service/.env.development.local", """\
PORT=3000
MONGOOSE_URL=mongodb://auth-db:27017/auth
RABBITMQ_URL=amqp://rabbitmq:5672
JWT_SECRET=change_me_to_a_strong_secret
JWT_EXPIRY=24h
ADMIN_REGISTRATION_KEY=super_secret_admin_key
PROVIDER_SERVICE_URL=http://provider-service:3000
USER_SERVICE_URL=http://user-service:3000
CHARGER_SERVICE_URL=http://charger-service:3000
""")

write_file(ROOT / "services/admin-service/.env.development.local", """\
PORT=3000
MONGOOSE_URL=mongodb://admin-db:27017/admin
RABBITMQ_URL=amqp://rabbitmq:5672
JWT_SECRET=change_me_to_a_strong_secret
JWT_EXPIRY=24h
ADMIN_REGISTRATION_KEY=super_secret_admin_key
PROVIDER_SERVICE_URL=http://provider-service:3000
USER_SERVICE_URL=http://user-service:3000
CHARGER_SERVICE_URL=http://charger-service:3000
ANALYTICS_SERVICE_URL=http://analytics-service:3000
AUTH_SERVICE_URL=http://auth-service:3000
RESERVATION_SERVICE_URL=http://reservation-service:3000
PLUG_SERVICE_URL=http://plug-service:3000
BLUE_PLUG_ADAPTER_URL=http://blueplug-adapter:3000
RED_PLUG_ADAPTER_URL=http://redplug-adapter:3000
GREEN_PLUG_ADAPTER_URL=http://greenplug-adapter:3000
""")

write_file(ROOT / "services/analytics-service/.env.development.local", """\
PORT=3000
MONGOOSE_URL=mongodb://analytics-db:27017/analytics
RABBITMQ_URL=amqp://rabbitmq:5672
CHARGER_SERVICE_URL=http://charger-service:3000
JWT_SECRET=change_me_to_a_strong_secret
""")

write_file(ROOT / "services/reservation-service/.env.development.local", """\
PORT=3000
MONGOOSE_URL=mongodb://reservation-db:27017/reservation
RABBITMQ_URL=amqp://rabbitmq:5672
CHARGER_SERVICE_URL=http://charger-service:3000
JWT_SECRET=change_me_to_a_strong_secret
JWT_EXPIRY=24h
""")

write_file(ROOT / "services/provider-service/.env.development.local", """\
PORT=3000
MONGOOSE_URL=mongodb://provider-db:27017/provider
RABBITMQ_URL=amqp://rabbitmq:5672
""")

write_file(ROOT / "services/plug-adapters/blue-plug-adapter/.env.development.local", """\
PORT=3000
MONGOOSE_URL=mongodb://blueplug-db:27017/blueplug
RABBITMQ_URL=amqp://rabbitmq:5672
BLUE_PLUG_BASE_URL=https://davinci.softlab.ntua.gr/saas26/bluePlug/api
BLUE_PLUG_AUTH_TOKEN=sk_saas_bb5c92ea23c41ad654a2c970
JWT_SECRET=change_me_to_a_strong_secret
""")

write_file(ROOT / "services/plug-adapters/red-plug-adapter/.env.development.local", """\
PORT=3000
MONGOOSE_URL=mongodb://redplug-db:27017/redplug
RABBITMQ_URL=amqp://rabbitmq:5672
RED_PLUG_BASE_URL=https://davinci.softlab.ntua.gr/saas26/redPlug/api
RED_PLUG_AUTH_TOKEN=sk_saas_bb5c92ea23c41ad654a2c970
JWT_SECRET=change_me_to_a_strong_secret
""")

write_file(ROOT / "services/plug-adapters/green-plug-adapter/.env.development.local", """\
PORT=3000
MONGOOSE_URL=mongodb://greenplug-db:27017/greenplug
RABBITMQ_URL=amqp://rabbitmq:5672
GREEN_PLUG_BASE_URL=https://davinci.softlab.ntua.gr/saas26/greenPlug/api
GREEN_PLUG_AUTH_TOKEN=sk_saas_bb5c92ea23c41ad654a2c970
JWT_SECRET=change_me_to_a_strong_secret
""")

success("Environment files written.")


# ── 2. Wipe / stop existing containers ───────────────────────────────────────
if WIPE:
    info("Wiping existing containers and volumes for a clean build...")
    run(["docker", "compose", "down", "-v", "--remove-orphans"], check=False, cwd=ROOT)
    success("Clean slate ready.")
else:
    warn("--no-wipe: skipping volume removal. Existing DB data will be kept.")
    run(["docker", "compose", "down", "--remove-orphans"], check=False, cwd=ROOT)


# ── 3. Build all Docker images ────────────────────────────────────────────────
info("Building all Docker images (this may take a few minutes on first run)...")
run(["docker", "compose", "--profile", "seed", "build"], cwd=ROOT)
success("All images built.")


# ── 4. Start the full stack ───────────────────────────────────────────────────
info("Starting all services...")
run(["docker", "compose", "up", "-d"], cwd=ROOT)
success("Containers started.")


# ── 5. Wait for the API gateway ───────────────────────────────────────────────
info("Waiting for the API gateway at http://localhost ...")
MAX_WAIT = 180
INTERVAL = 5
elapsed  = 0

while True:
    try:
        urllib.request.urlopen("http://localhost/api/auth/", timeout=3)
        break
    except urllib.error.HTTPError:
        # Any HTTP response (404, 502, …) means the gateway is up
        break
    except Exception:
        pass
    if elapsed >= MAX_WAIT:
        die("Gateway did not become reachable within 180 s.\nCheck: docker compose logs api-gateway")
    print(".", end="", flush=True)
    time.sleep(INTERVAL)
    elapsed += INTERVAL

print()
info("Gateway reachable. Waiting 10 s for all services to stabilise...")
time.sleep(10)
success("Stack is up.")


# ── 6. Seed regular users ─────────────────────────────────────────────────────
info("Seeding regular users (auth-db + user-db)...")
run(["docker", "compose", "--profile", "seed", "run", "--rm", "dev-seeder"], cwd=ROOT)
success("100 regular users seeded.")


# ── 7–9. Seed providers / admins / stats via stdin ───────────────────────────
# Pass scripts through stdin so no container path is ever needed.
# subprocess passes bytes directly — zero shell involvement, zero path conversion.

def seed(label: str, container: str, script: Path):
    info(f"Seeding {label}...")
    script_bytes = script.read_bytes()
    result = subprocess.run(
        ["docker", "exec", "-i", container, "node", "-"],
        input=script_bytes,
        cwd=ROOT,
    )
    if result.returncode != 0:
        die(f"{label} seeding failed (exit {result.returncode})")
    success(f"{label} seeded.")


seed("provider accounts", "auth_service",        SEEDS_DIR / "seed-providers.js")
seed("admin accounts",    "admin_service",        SEEDS_DIR / "seed-admins.js")
seed("reservation stats", "reservation_service",  SEEDS_DIR / "seed-stats.js")


# ── 10. Install frontend deps ─────────────────────────────────────────────────
info("Installing frontend dependencies...")
run([NPM, "install", "--legacy-peer-deps"], cwd=WEBAPP)
success("Frontend dependencies installed.")


# ── Reference card ────────────────────────────────────────────────────────────
print(f"""
{BOLD}{GREEN}╔══════════════════════════════════════════════════════════╗{RESET}
{BOLD}{GREEN}║           saasPlug dev environment is ready!             ║{RESET}
{BOLD}{GREEN}╚══════════════════════════════════════════════════════════╝{RESET}

{BOLD}  Backend API:{RESET}  http://localhost          (Nginx API Gateway)
{BOLD}  Frontend:{RESET}     http://localhost:5173      (Vite — starting now)

{BOLD}{CYAN}  ── Test Accounts  (all passwords: 123456) ────────────────{RESET}

{BOLD}  Regular user{RESET}  →  Log in at /login  →  Map, Reserve, Charging, Stats
    {GREEN}seed001@saasplug.app{RESET}  through  {GREEN}seed100@saasplug.app{RESET}

{BOLD}  Provider accounts{RESET}  →  Log in at /login  →  My Network, Analytics, Account
    {GREEN}blue@plug.com{RESET}      bluePlug network
    {GREEN}red@plug.com{RESET}       redPlug network
    {GREEN}green@plug.com{RESET}     greenPlug network

{BOLD}  Admin accounts{RESET}  →  Log in at /login  →  System Map, Global Analytics, Management
    {GREEN}admin@saas.com{RESET}         Super Admin
    {GREEN}admin@saasplug.app{RESET}     Global Admin
    {GREEN}agrinios@saasplug.app{RESET}  Giorgos Admin

{BOLD}{CYAN}  ── Seeded Data ────────────────────────────────────────────{RESET}
    100 completed reservations  (bluePlug 40 · redPlug 35 · greenPlug 25)
    Analytics stats pre-built for the current month

{BOLD}{YELLOW}  Press Ctrl+C to stop the frontend dev server.{RESET}
{BOLD}{YELLOW}  Backend containers keep running — stop with: docker compose down{RESET}

{BOLD}{GREEN}════════════════════════════════════════════════════════════{RESET}
""")

# ── 11. Start Vite ────────────────────────────────────────────────────────────
info("Starting Vite dev server at http://localhost:5173 ...")
try:
    subprocess.run([NPM, "run", "dev"], cwd=WEBAPP, check=True)
except KeyboardInterrupt:
    print()
    info("Vite stopped. Backend containers are still running.")
    info("Stop them with: docker compose down")
