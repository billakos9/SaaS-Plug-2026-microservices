# billing-service

Provider invoice and billing snapshot service.

## Internal Mount

```text
/billing/invoices
```

Gateway prefix:

```text
/api/billing/invoices
```

## Main Routes

```text
POST  /api/billing/invoices/generate       admin only
GET   /api/billing/invoices                admin only
PATCH /api/billing/invoices/:id/paid       admin only

GET   /api/billing/invoices/my             provider only
PATCH /api/billing/invoices/:id/pay        provider only

GET   /api/billing/invoices/:id/detail     admin or owning provider
```

## Responsibilities

- Stores billed reservation snapshots.
- Generates provider invoices from completed reservations.
- Supports admin invoice management.
- Supports provider self-service invoice views and payments.
- Consumes reservation/token events where needed.

## Required Environment

```text
PORT=3000
MONGOOSE_URL=mongodb://billing-db:27017/billing
RABBITMQ_URL=amqp://rabbitmq:5672
JWT_SECRET=...
```
