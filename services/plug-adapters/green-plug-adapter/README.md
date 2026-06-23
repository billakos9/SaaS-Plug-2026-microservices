# green-plug-adapter

Adapter for the Softlab greenPlug provider API.

## Internal Mount

```text
/greenPlugAdapter
```

## Routes

```text
GET  /greenPlugAdapter/fetchPoints
POST /greenPlugAdapter/postReservations
GET  /health
```

## Responsibilities

- Calls the greenPlug external provider API.
- Normalizes charger point responses for `plug-service`.
- Submits reservation requests to greenPlug when needed.

## Required Environment

```text
PORT=3000
GREEN_PLUG_BASE_URL=https://davinci.softlab.ntua.gr/saas26/greenPlug/api
GREEN_PLUG_AUTH_TOKEN=...
```
