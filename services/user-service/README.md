# user-service

User profile service. It stores the profile mirror for auth users and exposes
the authenticated user's profile.

## Internal Mount

```text
/user
```

Gateway paths:

```text
/api/users/me
```

Admin user management is exposed through `admin-service`, not directly through
the public gateway.

## Main Routes

```text
GET    /user/              admin only, internal/direct dev
GET    /user/me            authenticated user
PUT    /user/me            authenticated user
GET    /user/:id           admin only, internal/direct dev
DELETE /user/delete/:id    admin only, internal/direct dev
```

## Responsibilities

- Mirrors users created by auth-service.
- Stores profile fields such as name, username, phone, first/last name, and
  birthdate.
- Verifies JWTs for protected routes.
- Publishes user deletion/update events when relevant.

## Required Environment

```text
PORT=3000
MONGOOSE_URL=mongodb://user-db:27017/user
RABBITMQ_URL=amqp://rabbitmq:5672
JWT_SECRET=...
```
