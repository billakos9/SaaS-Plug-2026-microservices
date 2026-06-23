# red-plug-adapter

Adapter for the Softlab redPlug provider API.

## Internal Mount

```text
/redPlugAdapter
```

## Routes

```text
GET  /redPlugAdapter/fetchPoints
POST /redPlugAdapter/postReservations
GET  /health
```

## Responsibilities

- Calls the redPlug external provider API.
- Normalizes charger point responses for `plug-service`.
- Submits reservation requests to redPlug when needed.

## Required Environment

```text
PORT=3000
RED_PLUG_BASE_URL=https://davinci.softlab.ntua.gr/saas26/redPlug/api
RED_PLUG_AUTH_TOKEN=...
```
