# Web App

Current React/Vite frontend for saasPlug. The legacy `apps/front-end` directory
is ignored and should not be used for current development.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
```

## API Configuration

The app uses `/api` by default:

```js
VITE_API_BASE=/api
```

In Vite dev mode, `/api` is proxied by `vite.config.js`.

The proxy target is chosen in this order:

1. `VITE_API_PROXY_TARGET`
2. root `.env` value `PUBLIC_HTTP_PORT`, for example `http://localhost:3309`
3. fallback `http://localhost`

This means that after running `scripts/setup-vm.py --team 09 --rebuild`, Vite
automatically proxies to the local gateway on port `3309`.

## Production / VM Build

The VM setup script builds the app:

```bash
python3 scripts/setup-vm.py --team 09 --rebuild
```

Build output goes to:

```text
apps/web-app/dist/
```

`dist/` is generated and ignored by git.

## Auth

JWT access tokens are stored in `sessionStorage`. A browser refresh keeps the
token for the current tab session, but closing the tab/browser may clear it
depending on browser behavior.

Supported roles:

```text
user
provider
admin
```

Role-specific routes:

```text
/profile
/provider
/provider/invoices
/provider/profile
/admin
```
