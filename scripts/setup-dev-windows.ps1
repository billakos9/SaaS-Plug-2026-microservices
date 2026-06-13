# setup-dev-windows.ps1 — saasPlug dev environment bootstrap (Windows PowerShell)
#
# Windows-native PowerShell version. No Git Bash required.
#
# Usage (in PowerShell):
#   Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
#   .\scripts\setup-dev-windows.ps1
#   .\scripts\setup-dev-windows.ps1 -NoWipe
#

param(
    [switch]$NoWipe = $false
)

$ErrorActionPreference = "Stop"

# ── Colors ─────────────────────────────────────────────────────────────────
function Write-Info { Write-Host "[setup] $args" -ForegroundColor Cyan }
function Write-Success { Write-Host "[setup] $args" -ForegroundColor Green }
function Write-Warn { Write-Host "[setup] $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "[setup] ERROR: $args" -ForegroundColor Red }

# ── Prerequisites ──────────────────────────────────────────────────────────
Write-Info "Checking prerequisites..."

try {
  $dockerVersion = docker --version
  Write-Success "Docker found: $dockerVersion"
} catch {
  Write-Error "docker not found. Install Docker Desktop and ensure it's in PATH."
  exit 1
}

# Check if Docker daemon is running
try {
  docker ps > $null 2>&1
} catch {
  Write-Error "Docker daemon not responding. Ensure Docker Desktop is running."
  exit 1
}

# Node & npm
try {
  $nodeVersion = node --version
  $npmVersion = npm --version
  Write-Success "Node $nodeVersion and npm $npmVersion found"
} catch {
  Write-Error "Node.js or npm not found. Install Node.js >= 20."
  exit 1
}

# docker compose
try {
  docker compose version > $null 2>&1
} catch {
  Write-Error "docker compose plugin not found. Update Docker Desktop."
  exit 1
}

Write-Success "All prerequisites satisfied."

# ── Resolve project root ───────────────────────────────────────────────────
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
Set-Location $projectRoot
Write-Info "Project root: $projectRoot"

# ── 1. Write environment files ─────────────────────────────────────────────
Write-Info "Writing environment files..."

@"
JWT_SECRET=change_me_to_a_strong_secret
"@ | Out-File -FilePath ".env" -Encoding UTF8

@"
PORT=3000
MONGOOSE_URL=mongodb://auth-db:27017/auth
RABBITMQ_URL=amqp://rabbitmq:5672
JWT_SECRET=change_me_to_a_strong_secret
JWT_EXPIRY=24h
ADMIN_REGISTRATION_KEY=super_secret_admin_key
PROVIDER_SERVICE_URL=http://provider-service:3000
USER_SERVICE_URL=http://user-service:3000
CHARGER_SERVICE_URL=http://charger-service:3000
"@ | Out-File -FilePath "services/auth-service/.env.development.local" -Encoding UTF8

@"
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
"@ | Out-File -FilePath "services/admin-service/.env.development.local" -Encoding UTF8

@"
PORT=3000
MONGOOSE_URL=mongodb://analytics-db:27017/analytics
RABBITMQ_URL=amqp://rabbitmq:5672
CHARGER_SERVICE_URL=http://charger-service:3000
JWT_SECRET=change_me_to_a_strong_secret
"@ | Out-File -FilePath "services/analytics-service/.env.development.local" -Encoding UTF8

@"
PORT=3000
MONGOOSE_URL=mongodb://reservation-db:27017/reservation
RABBITMQ_URL=amqp://rabbitmq:5672
CHARGER_SERVICE_URL=http://charger-service:3000
JWT_SECRET=change_me_to_a_strong_secret
JWT_EXPIRY=24h
"@ | Out-File -FilePath "services/reservation-service/.env.development.local" -Encoding UTF8

@"
PORT=3000
MONGOOSE_URL=mongodb://provider-db:27017/provider
RABBITMQ_URL=amqp://rabbitmq:5672
"@ | Out-File -FilePath "services/provider-service/.env.development.local" -Encoding UTF8

@"
PORT=3000
MONGOOSE_URL=mongodb://blueplug-db:27017/blueplug
RABBITMQ_URL=amqp://rabbitmq:5672
BLUE_PLUG_BASE_URL=https://davinci.softlab.ntua.gr/saas26/bluePlug/api
BLUE_PLUG_AUTH_TOKEN=sk_saas_bb5c92ea23c41ad654a2c970
JWT_SECRET=change_me_to_a_strong_secret
"@ | Out-File -FilePath "services/plug-adapters/blue-plug-adapter/.env.development.local" -Encoding UTF8

@"
PORT=3000
MONGOOSE_URL=mongodb://redplug-db:27017/redplug
RABBITMQ_URL=amqp://rabbitmq:5672
RED_PLUG_BASE_URL=https://davinci.softlab.ntua.gr/saas26/redPlug/api
RED_PLUG_AUTH_TOKEN=sk_saas_bb5c92ea23c41ad654a2c970
JWT_SECRET=change_me_to_a_strong_secret
"@ | Out-File -FilePath "services/plug-adapters/red-plug-adapter/.env.development.local" -Encoding UTF8

@"
PORT=3000
MONGOOSE_URL=mongodb://greenplug-db:27017/greenplug
RABBITMQ_URL=amqp://rabbitmq:5672
GREEN_PLUG_BASE_URL=https://davinci.softlab.ntua.gr/saas26/greenPlug/api
GREEN_PLUG_AUTH_TOKEN=sk_saas_bb5c92ea23c41ad654a2c970
JWT_SECRET=change_me_to_a_strong_secret
"@ | Out-File -FilePath "services/plug-adapters/green-plug-adapter/.env.development.local" -Encoding UTF8

Write-Success "Environment files written."

# ── 2. Wipe or keep volumes ────────────────────────────────────────────────
if ($NoWipe) {
  Write-Warn "--NoWipe: skipping volume removal. Existing DB data will be kept."
  docker compose down --remove-orphans 2> $null
} else {
  Write-Info "Wiping existing containers and volumes for a clean build..."
  docker compose down -v --remove-orphans 2> $null
  Write-Success "Clean slate ready."
}

# ── 3. Build images ────────────────────────────────────────────────────────
Write-Info "Building all Docker images (this may take a few minutes)..."
docker compose --profile seed build
if ($LASTEXITCODE -ne 0) {
  Write-Error "Docker build failed. Check Docker Desktop is running."
  exit 1
}
Write-Success "All images built."

# ── 4. Start services ──────────────────────────────────────────────────────
Write-Info "Starting all services..."
docker compose up -d
if ($LASTEXITCODE -ne 0) {
  Write-Error "docker compose up failed."
  exit 1
}
Write-Success "Containers started."

# ── 5. Wait for gateway ────────────────────────────────────────────────────
Write-Info "Waiting for the API gateway at http://localhost ..."
$maxWait = 180
$interval = 5
$elapsed = 0

$gatewayReady = $false
while ($elapsed -lt $maxWait) {
  try {
    # Any HTTP response (including 4xx) means nginx is up
    Invoke-WebRequest -Uri "http://localhost/api/auth/" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop | Out-Null
    $gatewayReady = $true
    break
  } catch [System.Net.WebException] {
    # A WebException with a response means nginx replied (e.g. 404) — gateway is up
    if ($_.Exception.Response -ne $null) {
      $gatewayReady = $true
      break
    }
    # No response at all — still starting
  } catch {
    # Any other error — still starting
  }
  Write-Host -NoNewline "."
  Start-Sleep -Seconds $interval
  $elapsed += $interval
}

if (-not $gatewayReady) {
  Write-Error "Gateway did not become reachable within ${maxWait}s. Check: docker compose logs api-gateway"
  exit 1
}

Write-Host ""
Write-Info "Gateway reachable. Waiting 10 s for all services to stabilise..."
Start-Sleep -Seconds 10
Write-Success "Stack is up."

# ── 6. Seed users ─────────────────────────────────────────────────────────
Write-Info "Seeding regular users (auth-db + user-db)..."
docker compose --profile seed run --rm dev-seeder
if ($LASTEXITCODE -ne 0) {
  Write-Error "dev-seeder failed"
  exit 1
}
Write-Success "100 regular users seeded."

# ── 7. Seed providers ──────────────────────────────────────────────────────
Write-Info "Seeding provider accounts..."
docker cp "$scriptDir/seeds/seed-providers.js" auth_service:/tmp/seed-providers.js 2> $null
docker exec auth_service node /tmp/seed-providers.js
if ($LASTEXITCODE -ne 0) {
  Write-Error "Provider seeding failed"
  exit 1
}
Write-Success "Provider accounts seeded."

# ── 8. Seed admins ────────────────────────────────────────────────────────
Write-Info "Seeding admin accounts..."
docker cp "$scriptDir/seeds/seed-admins.js" admin_service:/tmp/seed-admins.js 2> $null
docker exec admin_service node /tmp/seed-admins.js
if ($LASTEXITCODE -ne 0) {
  Write-Error "Admin seeding failed"
  exit 1
}
Write-Success "Admin accounts seeded."

# ── 9. Seed stats ──────────────────────────────────────────────────────────
Write-Info "Seeding 100 completed reservations and analytics stats..."
docker cp "$scriptDir/seeds/seed-stats.js" reservation_service:/tmp/seed-stats.js 2> $null
docker exec reservation_service node /tmp/seed-stats.js
if ($LASTEXITCODE -ne 0) {
  Write-Error "Stats seeding failed"
  exit 1
}
Write-Success "Reservation and analytics data seeded."

# ── 10. Frontend setup ─────────────────────────────────────────────────────
$webappPath = Join-Path $projectRoot "apps/web-app"

Write-Info "Installing frontend dependencies..."
npm --prefix $webappPath install --legacy-peer-deps
Write-Success "Frontend dependencies installed."

# ── Print info card ────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║           saasPlug dev environment is ready!             ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Backend API:   http://localhost          (Nginx API Gateway)" -ForegroundColor Cyan
Write-Host "Frontend:      http://localhost:5173      (Vite — starting now)" -ForegroundColor Cyan
Write-Host ""
Write-Host "── Test Accounts  (all passwords: 123456) ────────────────" -ForegroundColor Cyan
Write-Host ""
Write-Host "Regular user  →  Log in at /login  →  Map, Reserve, Charging, Stats" -ForegroundColor Cyan
Write-Host "  seed001@saasplug.app  through  seed100@saasplug.app" -ForegroundColor Green
Write-Host ""
Write-Host "Provider accounts  →  Log in at /login  →  My Network, Analytics, Account" -ForegroundColor Cyan
Write-Host "  blue@plug.com      bluePlug network" -ForegroundColor Green
Write-Host "  red@plug.com       redPlug network" -ForegroundColor Green
Write-Host "  green@plug.com     greenPlug network" -ForegroundColor Green
Write-Host ""
Write-Host "Admin accounts  →  Log in at /login  →  System Map, Global Analytics, Management" -ForegroundColor Cyan
Write-Host "  admin@saas.com         Super Admin" -ForegroundColor Green
Write-Host "  admin@saasplug.app     Global Admin" -ForegroundColor Green
Write-Host "  agrinios@saasplug.app  Giorgos Admin" -ForegroundColor Green
Write-Host ""
Write-Host "── Seeded Data ────────────────────────────────────────────" -ForegroundColor Cyan
Write-Host "  100 completed reservations  (bluePlug 40 · redPlug 35 · greenPlug 25)" -ForegroundColor Yellow
Write-Host "  Analytics stats pre-built for the current month" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Press Ctrl+C to stop the frontend dev server." -ForegroundColor Yellow
Write-Host "  Backend containers keep running — stop with: docker compose down" -ForegroundColor Yellow
Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

Write-Info "Starting Vite dev server at http://localhost:5173 ..."
npm --prefix $webappPath run dev
