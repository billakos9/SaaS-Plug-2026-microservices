# Scripts

This directory contains setup and seed scripts for local development and the
Softlab VM demo environment.

## VM / Production-like Setup

Use this on the Softlab VM or locally when you want the same single-port shape:

```bash
python3 scripts/setup-vm.py --team 09
```

For Team 09 the default public port is:

```text
3309
```

Safe rebuild without DB wipe/seed:

```bash
python3 scripts/setup-vm.py --team 09 --rebuild
```

Keep DB volumes but recreate containers:

```bash
python3 scripts/setup-vm.py --team 09 --no-wipe
```

Fresh setup behavior:

- writes runtime `.env` files
- builds `apps/web-app`
- generates `apps/api-gateway/nginx.vm.conf`
- generates `docker-compose.override.yml`
- starts the stack
- seeds users, providers, admins, reservations, analytics, and billing data

Generated files are ignored by git.

## Local Dev Setup

Cross-platform Python script:

```bash
python3 scripts/setup-dev.py
```

Bash script:

```bash
./scripts/setup-dev.sh
```

Both scripts set up the dev stack and then start the Vite dev server.

Important:

- A normal run wipes Docker volumes.
- `--no-wipe` keeps volumes but still recreates containers and reseeds data.
- These scripts write local `.env` files.

## Seed Scripts

Seed helpers live in:

```text
scripts/seed_scripts/
```

Files:

```text
seed-providers.js
seed-admins.js
seed-stats.js
```

They are executed inside service containers by the setup scripts.

## Quick Checks

```bash
python3 -m py_compile scripts/setup-vm.py scripts/setup-dev.py
bash -n scripts/setup-dev.sh
node --check scripts/seed_scripts/seed-admins.js
node --check scripts/seed_scripts/seed-providers.js
node --check scripts/seed_scripts/seed-stats.js
```
