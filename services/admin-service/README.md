# admin-service

Admin API for system health, global analytics, user/provider management, charger
views, invoices, and admin account management.

## Internal Mount

```text
/admin
```

Gateway prefix:

```text
/api/admin
```

All routes require a valid admin JWT.

## Main Routes

```text
GET    /api/admin/system-health
GET    /api/admin/profile
GET    /api/admin/accounts
PUT    /api/admin/accounts/:id
DELETE /api/admin/accounts/:id

GET    /api/admin/analytics
GET    /api/admin/analytics/providers

GET    /api/admin/providers
GET    /api/admin/providers/:id
POST   /api/admin/providers
PUT    /api/admin/providers/:id
DELETE /api/admin/providers/delete/:id

GET    /api/admin/users
GET    /api/admin/users/:id
DELETE /api/admin/users/:id

GET    /api/admin/chargers
GET    /api/admin/chargers/status/:status
GET    /api/admin/chargers/:id
```

## Responsibilities

- Aggregates health checks across services.
- Proxies/coordinates admin views over users, providers, chargers, analytics,
  and billing.
- Stores admin profile records in `admin-db`.
- Publishes admin update/delete events so `auth-service` can synchronize login
  credentials.
- Deletes users/providers through their owning services instead of editing all
  databases directly.

## Required Environment

```text
PORT=3000
MONGOOSE_URL=mongodb://admin-db:27017/admin
RABBITMQ_URL=amqp://rabbitmq:5672
JWT_SECRET=...
AUTH_SERVICE_URL=http://auth-service:3000
USER_SERVICE_URL=http://user-service:3000
CHARGER_SERVICE_URL=http://charger-service:3000
RESERVATION_SERVICE_URL=http://reservation-service:3000
ANALYTICS_SERVICE_URL=http://analytics-service:3000
BILLING_SERVICE_URL=http://billing-service:3000
PLUG_SERVICE_URL=http://plug-service:3000
```
