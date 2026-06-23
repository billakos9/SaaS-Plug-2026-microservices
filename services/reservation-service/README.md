# reservation-service

Reservation lifecycle service for charger sessions.

## Internal Mount

```text
/reservation
```

Gateway prefix:

```text
/api/reservations
```

All reservation routes require a valid user JWT.

## Main Routes

```text
POST /api/reservations
GET  /api/reservations/user/:userId
GET  /api/reservations/:id
POST /api/reservations/:id/cancel
POST /api/reservations/:id/complete
```

## Responsibilities

- Creates active reservations.
- Ensures one active reservation per user.
- Ensures one active reservation per charger with a MongoDB partial unique
  index.
- Completes/cancels reservations and publishes events.
- Cancels active reservations when a user is deleted.
- Maintains a charger cache from charger events.
- Runs a session monitor that finalizes expired active reservations.

## Startup Repair

Before syncing indexes, the service repairs duplicate active reservations for
the same charger by cancelling later duplicates. This prevents old dirty local
data from blocking the unique active-reservation index.

## Required Environment

```text
PORT=3000
MONGOOSE_URL=mongodb://reservation-db:27017/reservation
RABBITMQ_URL=amqp://rabbitmq:5672
CHARGER_SERVICE_URL=http://charger-service:3000
JWT_SECRET=...
```
