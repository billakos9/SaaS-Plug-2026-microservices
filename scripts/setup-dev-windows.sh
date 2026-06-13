#!/usr/bin/env bash
# =============================================================================
# setup-dev-windows.sh — saasPlug dev environment bootstrap (Windows Git Bash)
#
# Windows-compatible version. Run via Git Bash on Windows.
# Handles path and permission issues common on Windows systems.
#
# Usage:
#   bash scripts/setup-dev-windows.sh          # fresh setup (wipes volumes)
#   bash scripts/setup-dev-windows.sh --no-wipe   # keep DB data, re-seed
#
# =============================================================================

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[setup]${RESET} $*"; }
success() { echo -e "${GREEN}[setup]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[setup]${RESET} $*"; }
die()     { echo -e "${RED}[setup] ERROR:${RESET} $*" >&2; exit 1; }

# ── Windows detection ────────────────────────────────────────────────────────
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
  IS_WINDOWS=true
  warn "Windows detected. Using Git Bash compatibility mode."
else
  IS_WINDOWS=false
fi

# ── Parse args ───────────────────────────────────────────────────────────────
WIPE=true
for arg in "$@"; do
  [[ "$arg" == "--no-wipe" ]] && WIPE=false
done

# ── Prerequisites ─────────────────────────────────────────────────────────────
info "Checking prerequisites..."

# Docker (must be running on Windows)
if ! command -v docker &>/dev/null; then
  die "docker not found. Install Docker Desktop and ensure it's in PATH."
fi

# Check if Docker daemon is accessible (critical on Windows)
if ! docker ps &>/dev/null; then
  die "Docker daemon not responding. Ensure Docker Desktop is running and try again."
fi

# Node & npm
command -v node >/dev/null 2>&1 || die "node not found. Install Node.js >= 20."
command -v npm >/dev/null 2>&1 || die "npm not found."

# docker compose plugin
docker compose version >/dev/null 2>&1 || die "docker compose plugin not found. Update Docker Desktop."

# Git Bash specific check
if [[ "$IS_WINDOWS" == true ]]; then
  [[ -n "${BASH_VERSION:-}" ]] || die "Must run via Git Bash (not cmd.exe or PowerShell)"
fi

success "All prerequisites satisfied."

# ── Resolve project root ──────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

info "Project root: $ROOT"

# ── 1. Write environment files ────────────────────────────────────────────────
info "Writing environment files..."

# Root .env
cat > .env <<'EOF'
JWT_SECRET=change_me_to_a_strong_secret
EOF

# auth-service
cat > services/auth-service/.env.development.local <<'EOF'
PORT=3000
MONGOOSE_URL=mongodb://auth-db:27017/auth
RABBITMQ_URL=amqp://rabbitmq:5672
JWT_SECRET=change_me_to_a_strong_secret
JWT_EXPIRY=24h
ADMIN_REGISTRATION_KEY=super_secret_admin_key
PROVIDER_SERVICE_URL=http://provider-service:3000
USER_SERVICE_URL=http://user-service:3000
CHARGER_SERVICE_URL=http://charger-service:3000
EOF

# admin-service
cat > services/admin-service/.env.development.local <<'EOF'
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
EOF

# analytics-service
cat > services/analytics-service/.env.development.local <<'EOF'
PORT=3000
MONGOOSE_URL=mongodb://analytics-db:27017/analytics
RABBITMQ_URL=amqp://rabbitmq:5672
CHARGER_SERVICE_URL=http://charger-service:3000
JWT_SECRET=change_me_to_a_strong_secret
EOF

# reservation-service
cat > services/reservation-service/.env.development.local <<'EOF'
PORT=3000
MONGOOSE_URL=mongodb://reservation-db:27017/reservation
RABBITMQ_URL=amqp://rabbitmq:5672
CHARGER_SERVICE_URL=http://charger-service:3000
JWT_SECRET=change_me_to_a_strong_secret
JWT_EXPIRY=24h
EOF

# provider-service
cat > services/provider-service/.env.development.local <<'EOF'
PORT=3000
MONGOOSE_URL=mongodb://provider-db:27017/provider
RABBITMQ_URL=amqp://rabbitmq:5672
EOF

# plug adapters
cat > services/plug-adapters/blue-plug-adapter/.env.development.local <<'EOF'
PORT=3000
MONGOOSE_URL=mongodb://blueplug-db:27017/blueplug
RABBITMQ_URL=amqp://rabbitmq:5672
BLUE_PLUG_BASE_URL=https://davinci.softlab.ntua.gr/saas26/bluePlug/api
BLUE_PLUG_AUTH_TOKEN=sk_saas_bb5c92ea23c41ad654a2c970
JWT_SECRET=change_me_to_a_strong_secret
EOF

cat > services/plug-adapters/red-plug-adapter/.env.development.local <<'EOF'
PORT=3000
MONGOOSE_URL=mongodb://redplug-db:27017/redplug
RABBITMQ_URL=amqp://rabbitmq:5672
RED_PLUG_BASE_URL=https://davinci.softlab.ntua.gr/saas26/redPlug/api
RED_PLUG_AUTH_TOKEN=sk_saas_bb5c92ea23c41ad654a2c970
JWT_SECRET=change_me_to_a_strong_secret
EOF

cat > services/plug-adapters/green-plug-adapter/.env.development.local <<'EOF'
PORT=3000
MONGOOSE_URL=mongodb://greenplug-db:27017/greenplug
RABBITMQ_URL=amqp://rabbitmq:5672
GREEN_PLUG_BASE_URL=https://davinci.softlab.ntua.gr/saas26/greenPlug/api
GREEN_PLUG_AUTH_TOKEN=sk_saas_bb5c92ea23c41ad654a2c970
JWT_SECRET=change_me_to_a_strong_secret
EOF

success "Environment files written."

# ── 2. (Optional) wipe existing volumes ──────────────────────────────────────
if [[ "$WIPE" == true ]]; then
  info "Wiping existing containers and volumes for a clean build..."
  # On Windows, suppress errors more aggressively
  docker compose down -v --remove-orphans 2>/dev/null || true
  success "Clean slate ready."
else
  warn "--no-wipe: skipping volume removal. Existing DB data will be kept."
  docker compose down --remove-orphans 2>/dev/null || true
fi

# ── 3. Build all Docker images ────────────────────────────────────────────────
info "Building all Docker images (this may take a few minutes on first run)..."
docker compose --profile seed build || die "Docker build failed. Check Docker Desktop is running."
success "All images built."

# ── 4. Start the full stack ───────────────────────────────────────────────────
info "Starting all services..."
docker compose up -d || die "docker compose up failed."
success "Containers started."

# ── 5. Wait for the API gateway to become healthy ─────────────────────────────
info "Waiting for the API gateway at http://localhost ..."
MAX_WAIT=180
INTERVAL=5
elapsed=0

until curl -s --max-time 3 -o /dev/null http://localhost/api/auth/ 2>/dev/null; do
  if [[ $elapsed -ge $MAX_WAIT ]]; then
    die "Gateway did not become reachable within ${MAX_WAIT}s. Check: docker compose logs api-gateway"
  fi
  echo -n "."
  sleep $INTERVAL
  elapsed=$((elapsed + INTERVAL))
done
echo ""

info "Gateway reachable. Waiting 10 s for all services to stabilise..."
sleep 10
success "Stack is up."

# ── 6. Seed users (dev-seeder via docker compose) ─────────────────────────────
info "Seeding regular users (auth-db + user-db)..."
docker compose --profile seed run --rm dev-seeder || die "dev-seeder failed"
success "100 regular users seeded."

# ── 7. Seed provider auth accounts + provider-db records ─────────────────────
info "Seeding provider accounts..."
docker cp "$SCRIPT_DIR/seeds/seed-providers.js" auth_service:/tmp/seed-providers.js 2>/dev/null || die "Failed to copy seed-providers.js"
docker exec auth_service node /tmp/seed-providers.js || die "Provider seeding failed"
success "Provider accounts seeded."

# ── 8. Seed admin accounts ────────────────────────────────────────────────────
info "Seeding admin accounts..."
docker cp "$SCRIPT_DIR/seeds/seed-admins.js" admin_service:/tmp/seed-admins.js 2>/dev/null || die "Failed to copy seed-admins.js"
docker exec admin_service node /tmp/seed-admins.js || die "Admin seeding failed"
success "Admin accounts seeded."

# ── 9. Seed reservation history + analytics stats ─────────────────────────────
info "Seeding 100 completed reservations and analytics stats..."
docker cp "$SCRIPT_DIR/seeds/seed-stats.js" reservation_service:/tmp/seed-stats.js 2>/dev/null || die "Failed to copy seed-stats.js"
docker exec reservation_service node /tmp/seed-stats.js || die "Stats seeding failed"
success "Reservation and analytics data seeded."

# ── 10. Install frontend deps & start Vite ───────────────────────────────────
WEBAPP="$ROOT/apps/web-app"

info "Installing frontend dependencies..."
npm --prefix "$WEBAPP" install --legacy-peer-deps || die "npm install failed. Check Node.js installation."
success "Frontend dependencies installed."

# Print the reference card before Vite takes over
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${GREEN}║           saasPlug dev environment is ready!             ║${RESET}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "${BOLD}  Backend API:${RESET}  http://localhost          (Nginx API Gateway)"
echo -e "${BOLD}  Frontend:${RESET}     http://localhost:5173      (Vite — starting now)"
echo ""
echo -e "${BOLD}${CYAN}  ── Test Accounts  (all passwords: 123456) ────────────────${RESET}"
echo ""
echo -e "${BOLD}  Regular user${RESET}  →  Log in at /login  →  Map, Reserve, Charging, Stats"
echo -e "    ${GREEN}seed001@saasplug.app${RESET}  through  ${GREEN}seed100@saasplug.app${RESET}"
echo ""
echo -e "${BOLD}  Provider accounts${RESET}  →  Log in at /login  →  My Network, Analytics, Account"
echo -e "    ${GREEN}blue@plug.com${RESET}      bluePlug network"
echo -e "    ${GREEN}red@plug.com${RESET}       redPlug network"
echo -e "    ${GREEN}green@plug.com${RESET}     greenPlug network"
echo ""
echo -e "${BOLD}  Admin accounts${RESET}  →  Log in at /login  →  System Map, Global Analytics, Management"
echo -e "    ${GREEN}admin@saas.com${RESET}         Super Admin"
echo -e "    ${GREEN}admin@saasplug.app${RESET}     Global Admin"
echo -e "    ${GREEN}agrinios@saasplug.app${RESET}  Giorgos Admin"
echo ""
echo -e "${BOLD}${CYAN}  ── Seeded Data ────────────────────────────────────────────${RESET}"
echo -e "    100 completed reservations  (bluePlug 40 · redPlug 35 · greenPlug 25)"
echo -e "    Analytics stats pre-built for the current month"
echo ""
echo -e "${BOLD}${YELLOW}  Press Ctrl+C to stop the frontend dev server.${RESET}"
echo -e "${BOLD}${YELLOW}  Backend containers keep running — stop with: docker compose down${RESET}"
echo ""
echo -e "${BOLD}${GREEN}════════════════════════════════════════════════════════════${RESET}"
echo ""

info "Starting Vite dev server at http://localhost:5173 ..."
npm --prefix "$WEBAPP" run dev
