# saasPlug Dev Environment Setup — Windows Guide

This guide covers running the saasPlug development environment on Windows.

## Prerequisites

1. **Docker Desktop** — https://www.docker.com/products/docker-desktop
   - Must be **running** before you start the setup
   - Recommended: Enable WSL 2 backend in Docker Desktop settings

2. **Node.js >= 20** — https://nodejs.org/
   - Includes npm

3. **Git Bash** (for Git users) OR **PowerShell** (built-in)
   - Both are supported; choose one based on preference

---

## Option A: Git Bash (Recommended for Git users)

**1. Open Git Bash and navigate to the project:**
```bash
cd /path/to/saasplug-project
```

**2. Run the setup script:**
```bash
bash scripts/setup-dev-windows.sh
```

**To skip database wipe (keep existing data):**
```bash
bash scripts/setup-dev-windows.sh --no-wipe
```

The script will:
- Create all `.env` files for each service
- Build all Docker images
- Start the full backend stack
- Seed 100 regular users, 3 providers, 3 admins, and 100 reservations with analytics
- Install frontend dependencies
- Start the Vite dev server at `http://localhost:5173`

**When done:** The terminal will show all test account credentials. Press `Ctrl+C` to stop the frontend (backend containers keep running).

---

## Option B: PowerShell (Windows Native)

**1. Open PowerShell as Administrator:**
- Search for "PowerShell" → Right-click → "Run as administrator"

**2. Allow script execution (one-time):**
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
```

**3. Navigate to the project:**
```powershell
cd "C:\path\to\saasplug-project"
```

**4. Run the setup script:**
```powershell
.\scripts\setup-dev-windows.ps1
```

**To skip database wipe:**
```powershell
.\scripts\setup-dev-windows.ps1 -NoWipe
```

**When done:** The terminal will show all test account credentials. Press `Ctrl+C` to stop the frontend.

---

## Troubleshooting

### "Docker daemon not responding"
- Open Docker Desktop application (it runs in the background)
- Wait 30 seconds for it to fully start
- Re-run the setup script

### "node not found" or "npm not found"
- Close the terminal and open a new one (so PATH updates)
- Verify Node.js installed: `node --version`
- If still failing, reinstall Node.js and restart your computer

### "Permission denied" (Git Bash only)
- Run: `chmod +x scripts/setup-dev-windows.sh`
- Then re-run: `bash scripts/setup-dev-windows.sh`

### "docker: command not found"
- Docker Desktop is not in your PATH
- Reinstall Docker Desktop, ensuring "Add Docker to PATH" is checked
- Restart your terminal after installation

### Vite server won't start
- Check if port 5173 is already in use: `netstat -ano | findstr :5173` (PowerShell)
- If in use, kill the process or use a different port by editing the script
- Alternatively, wait a few seconds and try again

### WSL 2 integration issues (advanced)
If you get `docker` connection errors:
1. Open Docker Desktop → Settings → Resources → WSL Integration
2. Enable integration for your WSL distribution
3. Restart Docker Desktop

---

## After Setup

Once the environment is running:

- **Frontend:** http://localhost:5173
- **API Gateway:** http://localhost
- **Test Accounts:** Printed in the terminal at startup

### Stopping Everything
When done, press `Ctrl+C` to stop the Vite server. To also stop Docker containers:
```bash
docker compose down
```

### Restarting with Existing Data
```bash
bash scripts/setup-dev-windows.sh --no-wipe   # Git Bash
# OR
.\scripts\setup-dev-windows.ps1 -NoWipe       # PowerShell
```

---

## For Your Team

Share the appropriate script with teammates:
- **Bash users:** `scripts/setup-dev-windows.sh`
- **PowerShell users:** `scripts/setup-dev-windows.ps1`

Both do the same thing — choose based on shell preference.
