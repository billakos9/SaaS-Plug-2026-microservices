#!/usr/bin/env python3
"""
setup-vm.py — saasPlug VM hosting bootstrap

Sets up saasPlug for demo hosting on a VirtualBox (or any Linux) VM on a home network.
Builds the React frontend as static files, injects a `location /` block into the
existing nginx config so the gateway serves both the SPA and the API on the
team-specific public port required by softlab,
and starts all containers with restart policies so they survive reboots.

Usage:
  python scripts/setup-vm.py --team 09             # fresh setup (wipes volumes + reseeds)
  python scripts/setup-vm.py --team 09 --no-wipe   # keep DB data, rebuild frontend + restart nginx
  python scripts/setup-vm.py --team 09 --rebuild   # frontend rebuild + nginx restart only (no DB touch)

Requirements: Python 3.8+, Docker Engine (not Desktop), Node.js >= 20
VirtualBox network: use Bridged Adapter so the VM gets a real LAN IP.
"""

import argparse
import platform
import re
import secrets
import shutil
import socket
import subprocess
import sys
import textwrap
import time
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional

SOFTLAB_HOST = "147.102.112.123"

# ── Colours ───────────────────────────────────────────────────────────────────
RED    = "\033[0;31m"
GREEN  = "\033[0;32m"
YELLOW = "\033[1;33m"
CYAN   = "\033[0;36m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

def info(msg):    print(f"{CYAN}[setup-vm]{RESET} {msg}", flush=True)
def success(msg): print(f"{GREEN}[setup-vm]{RESET} {msg}", flush=True)
def warn(msg):    print(f"{YELLOW}[setup-vm]{RESET} {msg}", flush=True)
def die(msg):
    print(f"{RED}[setup-vm] ERROR:{RESET} {msg}", file=sys.stderr, flush=True)
    sys.exit(1)


def run(cmd, *, check=True, capture=False, input_bytes=None, cwd=None):
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


def get_lan_ip() -> str:
    """Best-effort: return the machine's LAN IP (not loopback)."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "<VM-IP>"


def detect_team_from_repo(repo_name: str) -> Optional[str]:
    """Detect team number from repo names such as saas26-09."""
    match = re.search(r"saas26[-_]?(\d{1,2})$", repo_name, re.IGNORECASE)
    return match.group(1).zfill(2) if match else None


def normalize_team(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None

    team = str(value).strip()
    if not re.fullmatch(r"\d{1,2}", team):
        die("--team must be one or two digits, e.g. --team 09")

    return team.zfill(2)


# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT       = SCRIPT_DIR.parent
SEEDS_DIR  = SCRIPT_DIR / "seeds"
WEBAPP     = ROOT / "apps" / "web-app"
GATEWAY    = ROOT / "apps" / "api-gateway"
DIST       = WEBAPP / "dist"

# ── Args ──────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="saasPlug VM hosting setup")
parser.add_argument("--no-wipe", action="store_true",
                    help="Keep existing DB volumes; rebuild frontend and restart nginx only")
parser.add_argument("--rebuild", action="store_true",
                    help="Only rebuild frontend + restart nginx; do not touch containers or DB at all")
parser.add_argument("--team",
                    help="Softlab team number. Defaults to repo suffix, e.g. saas26-09 -> 09")
args = parser.parse_args()

REBUILD_ONLY = args.rebuild
NO_WIPE      = args.no_wipe or REBUILD_ONLY
WIPE         = not NO_WIPE
TEAM         = normalize_team(args.team) or detect_team_from_repo(ROOT.name)

if TEAM is None:
    die("Could not detect team number from repo name. Pass it explicitly, e.g. --team 09")

PUBLIC_HTTP_PORT = int(f"33{TEAM}")
PUBLIC_BASE_URL  = f"http://{SOFTLAB_HOST}:{PUBLIC_HTTP_PORT}"
LOCAL_BASE_URL   = f"http://localhost:{PUBLIC_HTTP_PORT}"

# ── 0. Prerequisites ──────────────────────────────────────────────────────────
if not REBUILD_ONLY:
    info("Checking prerequisites...")
    if platform.system() == "Windows":
        die("setup-vm.py targets Linux VMs only. Run this inside the VM via SSH.")
    if not shutil.which("docker"):
        die("docker not found. Install Docker Engine: https://docs.docker.com/engine/install/")
    result = run(["docker", "ps"], check=False, capture=True)
    if result.returncode != 0:
        die("Docker daemon not running. Start it: sudo systemctl start docker")
    result = run(["docker", "compose", "version"], check=False, capture=True)
    if result.returncode != 0:
        die("docker compose plugin not found. Update Docker Engine.")
    success("Docker OK.")

NODE = shutil.which("node")
NPM  = shutil.which("npm")
if not NODE:
    die("node not found. Install Node.js >= 20.")
if not NPM:
    die("npm not found.")
success("Node.js OK.")


# ── 1. Write nginx VM config (adds SPA static-file serving to the existing config)
info("Writing nginx VM config (apps/api-gateway/nginx.vm.conf)...")

BASE_NGINX = (GATEWAY / "nginx.conf").read_text(encoding="utf-8")

# Inject the SPA location block right before the closing } of the server block.
SPA_LOCATION = textwrap.dedent("""\

    # Serve the built React SPA. Must come last — /api/* locations take priority.
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
""")

if "location /" in BASE_NGINX:
    warn("nginx.conf already has a 'location /' block — nginx.vm.conf unchanged.")
    vm_nginx = BASE_NGINX
else:
    # Insert before the final closing brace
    last_brace = BASE_NGINX.rfind("}")
    vm_nginx = BASE_NGINX[:last_brace] + SPA_LOCATION + BASE_NGINX[last_brace:]

write_file(GATEWAY / "nginx.vm.conf", vm_nginx)
success("nginx.vm.conf written.")


# ── 2. Write docker-compose.override.yml ──────────────────────────────────────
info("Writing docker-compose.override.yml (volumes + restart policies)...")

# All runtime services that should restart after a VM reboot.
RUNTIME_SERVICES = [
    "api-gateway",
    "user-service", "auth-service", "reservation-service",
    "charger-service", "analytics-service", "billing-service",
    "provider-service", "admin-service", "plug-service",
    "blueplug-adapter", "redplug-adapter", "greenplug-adapter",
    "rabbitmq",
    "user-db", "auth-db", "reservation-db", "charger-db",
    "analytics-db", "provider-db", "admin-db", "billing-db",
]

restart_entries = "\n".join(
    f"  {svc}:\n    restart: unless-stopped"
    for svc in RUNTIME_SERVICES
    if svc != "api-gateway"  # api-gateway gets extra volume mounts below
)

# Relative paths in the override file are resolved relative to the compose project root (ROOT).
override_content = f"""\
# Auto-generated by scripts/setup-vm.py — do not edit manually.
# Adds: React SPA volume into api-gateway, restart policies on all services.
services:

  api-gateway:
    restart: unless-stopped
    volumes:
      # Serve the built React app as static files
      - ./apps/web-app/dist:/usr/share/nginx/html:ro
      # Use the VM nginx config (adds 'location /' for the SPA)
      - ./apps/api-gateway/nginx.vm.conf:/etc/nginx/conf.d/default.conf:ro

{restart_entries}
"""

write_file(ROOT / "docker-compose.override.yml", override_content)
success("docker-compose.override.yml written.")


# ── 3. Write environment files ────────────────────────────────────────────────
if not REBUILD_ONLY:
    info("Writing environment files...")

    # Generate a strong random JWT secret (or reuse existing if --no-wipe)
    env_file = ROOT / ".env"
    jwt_secret = None

    if NO_WIPE and env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("JWT_SECRET="):
                jwt_secret = line.split("=", 1)[1].strip()
                break

    if not jwt_secret:
        jwt_secret = secrets.token_hex(32)
        info(f"Generated new JWT_SECRET: {jwt_secret[:8]}...  (saved to .env)")

    write_file(env_file, (
        f"PUBLIC_HTTP_PORT={PUBLIC_HTTP_PORT}\n"
        f"JWT_SECRET={jwt_secret}\n"
        "PROVIDER_REGISTRATION_CODE=saasplug-provider-2024\n"
        "SEED_ADMIN_CREDENTIALS=admin@saas.com:123456,admin@saasplug.app:123456,agrinios@saasplug.app:123456\n"
    ))

    write_file(ROOT / "services/auth-service/.env.development.local", f"""\
PORT=3000
MONGOOSE_URL=mongodb://auth-db:27017/auth
RABBITMQ_URL=amqp://rabbitmq:5672
JWT_SECRET={jwt_secret}
JWT_EXPIRY=24h
PROVIDER_SERVICE_URL=http://provider-service:3000
USER_SERVICE_URL=http://user-service:3000
CHARGER_SERVICE_URL=http://charger-service:3000
""")

    write_file(ROOT / "services/admin-service/.env.development.local", f"""\
PORT=3000
MONGOOSE_URL=mongodb://admin-db:27017/admin
RABBITMQ_URL=amqp://rabbitmq:5672
JWT_SECRET={jwt_secret}
JWT_EXPIRY=24h
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
BILLING_SERVICE_URL=http://billing-service:3000
""")

    write_file(ROOT / "services/analytics-service/.env.development.local", f"""\
PORT=3000
MONGOOSE_URL=mongodb://analytics-db:27017/analytics
RABBITMQ_URL=amqp://rabbitmq:5672
CHARGER_SERVICE_URL=http://charger-service:3000
JWT_SECRET={jwt_secret}
""")

    write_file(ROOT / "services/reservation-service/.env.development.local", f"""\
PORT=3000
MONGOOSE_URL=mongodb://reservation-db:27017/reservation
RABBITMQ_URL=amqp://rabbitmq:5672
CHARGER_SERVICE_URL=http://charger-service:3000
JWT_SECRET={jwt_secret}
JWT_EXPIRY=24h
""")

    write_file(ROOT / "services/provider-service/.env.development.local", """\
PORT=3000
MONGOOSE_URL=mongodb://provider-db:27017/provider
RABBITMQ_URL=amqp://rabbitmq:5672
""")

    write_file(ROOT / "services/plug-adapters/blue-plug-adapter/.env.development.local",
               "BLUE_PLUG_AUTH_TOKEN=sk_saas_bb5c92ea23c41ad654a2c970\n")
    write_file(ROOT / "services/plug-adapters/red-plug-adapter/.env.development.local",
               "RED_PLUG_AUTH_TOKEN=sk_saas_bb5c92ea23c41ad654a2c970\n")
    write_file(ROOT / "services/plug-adapters/green-plug-adapter/.env.development.local",
               "GREEN_PLUG_AUTH_TOKEN=sk_saas_bb5c92ea23c41ad654a2c970\n")

    success("Environment files written.")


# ── 4. Build the React frontend ───────────────────────────────────────────────
info("Installing frontend dependencies...")
run([NPM, "install", "--legacy-peer-deps"], cwd=WEBAPP)
success("Dependencies installed.")

info("Building React frontend (npm run build)...")
run([NPM, "run", "build"], cwd=WEBAPP)

if not DIST.exists() or not any(DIST.iterdir()):
    die(f"Build produced no output at {DIST}. Check the Vite build log above.")

success(f"Frontend built → {DIST}")


# ── 5. Rebuild only: restart nginx and exit ───────────────────────────────────
if REBUILD_ONLY:
    info("--rebuild: restarting api-gateway to pick up new frontend...")
    run(["docker", "compose", "restart", "api-gateway"], cwd=ROOT)
    success("api-gateway restarted. New build is live.")
    print(f"\n  {BOLD}{PUBLIC_BASE_URL}{RESET}\n")
    sys.exit(0)


# ── 6. Wipe / stop existing containers ───────────────────────────────────────
if WIPE:
    info("Wiping existing containers and volumes for a clean build...")
    run(["docker", "compose", "down", "-v", "--remove-orphans"], check=False, cwd=ROOT)
    success("Clean slate ready.")
else:
    info("--no-wipe: keeping volumes; stopping containers for rebuild...")
    run(["docker", "compose", "down", "--remove-orphans"], check=False, cwd=ROOT)


# ── 7. Build all Docker images ────────────────────────────────────────────────
info("Building all Docker images (first run may take several minutes)...")
run(["docker", "compose", "--profile", "seed", "build"], cwd=ROOT)
success("All images built.")


# ── 8. Start the full stack ───────────────────────────────────────────────────
info("Starting all services...")
run(["docker", "compose", "up", "-d"], cwd=ROOT)
success("Containers started.")


# ── 9. Wait for the API gateway ───────────────────────────────────────────────
info(f"Waiting for the API gateway at {LOCAL_BASE_URL} ...")
MAX_WAIT = 180
INTERVAL = 5
elapsed  = 0

while True:
    try:
        urllib.request.urlopen(f"{LOCAL_BASE_URL}/api/auth/", timeout=3)
        break
    except urllib.error.HTTPError:
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


# ── 10. Seed data (fresh setup only) ─────────────────────────────────────────
if WIPE:
    info("Seeding regular users (auth-db + user-db)...")
    run(["docker", "compose", "--profile", "seed", "run", "--rm", "dev-seeder"], cwd=ROOT)
    success("100 regular users seeded.")

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

    seed("provider accounts", "auth_service",       SEEDS_DIR / "seed-providers.js")
    seed("admin accounts",    "admin_service",       SEEDS_DIR / "seed-admins.js")
    seed("reservation stats", "reservation_service", SEEDS_DIR / "seed-stats.js")
else:
    info("--no-wipe: skipping seed (existing data kept).")


# ── 11. Final status check ────────────────────────────────────────────────────
info("Verifying nginx serves the frontend...")
try:
    with urllib.request.urlopen(f"{LOCAL_BASE_URL}/", timeout=5) as resp:
        body = resp.read(200).decode("utf-8", errors="replace")
        if "<!doctype html>" in body.lower() or "<html" in body.lower():
            success("nginx is serving the React SPA at /.")
        else:
            warn("nginx responded but HTML not detected — check the volume mount.")
except Exception as e:
    warn(f"Could not verify SPA serving: {e}")


# ── Reference card ────────────────────────────────────────────────────────────
LAN_IP = get_lan_ip()

print(f"""
{BOLD}{GREEN}╔══════════════════════════════════════════════════════════╗{RESET}
{BOLD}{GREEN}║          saasPlug VM demo environment is ready!          ║{RESET}
{BOLD}{GREEN}╚══════════════════════════════════════════════════════════╝{RESET}

{BOLD}  Open in any browser on your home network:{RESET}

      {BOLD}{GREEN}{PUBLIC_BASE_URL}{RESET}
      {BOLD}{GREEN}http://{LAN_IP}:{PUBLIC_HTTP_PORT}{RESET}

  (Backend API also at {PUBLIC_BASE_URL}/api — same nginx, no extra port)

{BOLD}{CYAN}  ── Test Accounts  (all passwords: 123456) ────────────────{RESET}

{BOLD}  Users{RESET}  →  /login  →  Map, Reserve, Charging, Stats
    {GREEN}giorgos.papadopoulos@gmail.com{RESET}
    {GREEN}james.smith@gmail.com{RESET}
    {GREEN}marco.rossi@gmail.com{RESET}
    (100 users total — see mock_data/users.json)

{BOLD}  Providers{RESET}  →  /login  →  My Network, Analytics, Invoices, Account
    {GREEN}blue@plug.com{RESET}      bluePlug
    {GREEN}red@plug.com{RESET}       redPlug
    {GREEN}green@plug.com{RESET}     greenPlug

{BOLD}  Admins{RESET}  →  /login  →  System Map, Global Analytics, Management
    {GREEN}admin@saas.com{RESET}
    {GREEN}admin@saasplug.app{RESET}
    {GREEN}agrinios@saasplug.app{RESET}

{BOLD}{CYAN}  ── Seeded Data ────────────────────────────────────────────{RESET}
    3,612 completed reservations  (2024-06-15 → 2026-06-14)
    bluePlug 40 %  ·  redPlug 35 %  ·  greenPlug 25 %
    75 invoices pre-generated  (25 months × 3 providers)

{BOLD}{CYAN}  ── VirtualBox tips ─────────────────────────────────────────{RESET}
    Network adapter must be {BOLD}Bridged Adapter{RESET} (not NAT) so the
    VM gets a real LAN IP and is reachable from other machines.
    If the IP shows "<VM-IP>" above, run: hostname -I

{BOLD}{CYAN}  ── After a VM reboot ───────────────────────────────────────{RESET}
    Containers restart automatically (restart: unless-stopped).
    If Docker itself doesn't start on boot, run:
      sudo systemctl enable docker && sudo systemctl start docker

{BOLD}{CYAN}  ── To update the frontend without reseeding ────────────────{RESET}
    python scripts/setup-vm.py --team {TEAM} --rebuild

{BOLD}{GREEN}════════════════════════════════════════════════════════════{RESET}
""")
