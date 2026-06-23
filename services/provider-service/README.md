# provider-service

Provider network registry. Provider login credentials live in `auth-service`;
provider profile/network records live here.

## Internal Mount

```text
/provider
```

Gateway prefix:

```text
/api/providers
```

Direct provider routes require JWT auth. Admin-facing provider management is
usually accessed through `admin-service`.

## Main Routes

```text
GET    /provider/
GET    /provider/:id
POST   /provider/register       admin only
PUT    /provider/update/:id     admin only
DELETE /provider/delete/:id     admin only
```

## Responsibilities

- Stores provider network metadata.
- Keeps provider records separate from auth credentials.
- Accepts admin-controlled provider changes.
- Participates in provider sync flows initiated by auth/admin services.

## Required Environment

```text
PORT=3000
MONGOOSE_URL=mongodb://provider-db:27017/provider
RABBITMQ_URL=amqp://rabbitmq:5672
JWT_SECRET=...
```
