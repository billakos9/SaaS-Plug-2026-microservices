# Plug Adapters

Adapters isolate the platform from provider-specific APIs.

Current adapters:

```text
blue-plug-adapter
red-plug-adapter
green-plug-adapter
```

Each adapter exposes:

```text
GET  /<provider>Adapter/fetchPoints
POST /<provider>Adapter/postReservations
GET  /health
```

They are consumed internally by `plug-service` and are not part of the public API
contract. In production-like mode they are internal-only. In local dev mode they
can be exposed on ports `3009-3011`.

## Provider API Credentials

Each adapter uses its own token environment variable:

```text
BLUE_PLUG_AUTH_TOKEN
RED_PLUG_AUTH_TOKEN
GREEN_PLUG_AUTH_TOKEN
```

Base URLs are configured in `docker-compose.yml` and point to the Softlab
provider APIs.
