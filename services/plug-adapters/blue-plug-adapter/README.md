# blue-plug-adapter

Adapter for the Softlab bluePlug provider API.

## Internal Mount

```text
/bluePlugAdapter
```

## Routes

```text
GET  /bluePlugAdapter/fetchPoints
POST /bluePlugAdapter/postReservations
GET  /health
```

## Responsibilities

- Calls the bluePlug external provider API.
- Normalizes charger point responses for `plug-service`.
- Submits reservation requests to bluePlug when needed.

## Required Environment

```text
PORT=3000
BLUE_PLUG_BASE_URL=https://davinci.softlab.ntua.gr/saas26/bluePlug/api
BLUE_PLUG_AUTH_TOKEN=...
```
