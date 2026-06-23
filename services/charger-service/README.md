# charger-service

Charger/station catalog service.

## Internal Mount

```text
/charger
```

Gateway prefix:

```text
/api/chargers
```

## Main Routes

```text
GET  /api/chargers/
GET  /api/chargers/status/:status
GET  /api/chargers/id/:id
GET  /api/chargers/location/:lat/:lon/{radius}
POST /api/chargers/                  admin only
```

## Responsibilities

- Stores charger points in `charger-db`.
- Exposes public charger lookup/list endpoints.
- Accepts charger add/update events from plug/adapters.
- Supports reservation-service charger lookup/cache needs.

## Required Environment

```text
PORT=3000
MONGOOSE_URL=mongodb://charger-db:27017/charger
RABBITMQ_URL=amqp://rabbitmq:5672
JWT_SECRET=...
```
