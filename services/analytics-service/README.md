# analytics-service

Aggregated analytics service for global and provider charging statistics.

## Internal Mount

```text
/analytics
```

Gateway prefix:

```text
/api/analytics
```

Analytics routes require authenticated provider/admin access.

## Main Routes

```text
GET /api/analytics/global
GET /api/analytics/providers
GET /api/analytics/history/global
GET /api/analytics/history/provider/:providerName
GET /api/analytics/provider/:providerName
```

Provider-specific routes enforce access to the owning provider unless the caller
has admin privileges.

## Responsibilities

- Consumes reservation events.
- Maintains provider/month analytic stat documents.
- Deduplicates processed reservation analytic events.
- Combines analytics with charger data where needed.

## Required Environment

```text
PORT=3000
MONGOOSE_URL=mongodb://analytics-db:27017/analytics
RABBITMQ_URL=amqp://rabbitmq:5672
CHARGER_SERVICE_URL=http://charger-service:3000
JWT_SECRET=...
```
