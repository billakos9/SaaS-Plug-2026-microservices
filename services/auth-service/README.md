# auth-service

Authentication, registration, JWT issuance, and auth/account lifecycle events.

## Internal Mount

```text
/auth
```

Gateway prefix:

```text
/api/auth
```

## Main Routes

```text
POST /api/auth/login
POST /api/auth/register
POST /api/auth/provider/register
POST /api/auth/admin/register
GET  /api/auth/validate?token=...
```

`/api/auth/internal/provider` exists for internal admin-service calls and is
blocked from public gateway access.

## Responsibilities

- Stores login credentials in `auth-db`.
- Issues JWT access tokens.
- Public register creates normal `role: "user"` accounts.
- Provider self-registration is guarded by `PROVIDER_REGISTRATION_CODE`.
- Admin registration requires an existing admin JWT.
- Publishes user/admin/provider lifecycle events through RabbitMQ.
- Consumes admin update/delete events to keep auth credentials in sync.

## JWT Payload

Typical payload:

```json
{
  "userId": 1,
  "email": "user@example.com",
  "role": "user"
}
```

Provider tokens also include `providerName`.

## Required Environment

```text
PORT=3000
MONGOOSE_URL=mongodb://auth-db:27017/auth
RABBITMQ_URL=amqp://rabbitmq:5672
JWT_SECRET=...
PROVIDER_REGISTRATION_CODE=...
SEED_ADMIN_CREDENTIALS=...
```

`JWT_SECRET` must be explicit and shared with services that verify tokens.
