# auth-service

Authentication & JWT issuance microservice.

## Responsibility
- Verify email/password credentials
- Issue signed JWT access tokens
- Expose a token validation endpoint for other services / gateway

## Architecture

`Route → Controller → Service → Repository → Model`

---

## Folder Structure

```
services/auth-service/
├── package.json
├── Dockerfile
├── .env.development.local
├── README.md
└── src/
    ├── app.js
    ├── config/
    │   └── env.js                 
    ├── constants/
    │   ├── http-codes.js          
    │   └── messaging.js       
    ├── controllers/
    │   └── auth.controller.js     # postLogin, getValidate
    ├── dto/
    │   └── auth.dto.js            # toAuthResponse, toValidateResponse
    ├── errors/
    │   └── app-error.js         
    ├── infrastructure/
    │   ├── mongoDB.js             # connect + syncIndexes for Counter
    │   └── rabbitMQ.js        
    ├── middleware/
    │   ├── error.middleware.js 
    │   └── unmatched-routes.middleware.js 
    ├── models/
    │   ├── auth-user.model.js     # { userId, email, passwordHash, role }
    │   └── counter.model.js       # { _id: "userId", seq: Number }
    ├── repositories/
    │   └── auth-user.repository.js
    ├── routes/
    │   └── auth.route.js
    └── services/
        └── auth.service.js
```

---

## API Contract

### POST /auth/login
**Request body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Success 200:**
```json
{
  "accessToken": "eyJ...",
  "expiresIn": 86400,
  "role": "user"
}
```

**Error 400:** Invalid credentials / missing fields  
**Error 500:** Server error

### GET /auth/validate?token=...
**Query param:** `token` (JWT string)

**Success 200:**
```json
{
  "valid": true,
  "userId": 1,
  "role": "user"
}
```

**Error 401:** Invalid or expired token

---

## Data Models

### AuthUser (Mongoose)
```js
{
  userId:       { type: Number, required: true, unique: true },
  email:        { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role:         { type: String, enum: ["user", "provider", "admin"], default: "user" }
}
```

### Counter (Mongoose)
```js
{
  _id:  { type: String, required: true },   // "userId"
  seq:  { type: Number, default: 0 }
}
```

Use `Counter.findByIdAndUpdate("userId", { $inc: { seq: 1 } }, { new: true, upsert: true })` to generate the next integer `userId` when seeding manually.

---

## Dependencies (`package.json`)

```json
{
  "name": "auth-service",
  "version": "1.0.0",
  "description": "Authentication & JWT issuance microservice",
  "main": "src/app.js",
  "type": "module",
  "scripts": {
    "start": "node src/app.js"
  },
  "dependencies": {
    "amqplib": "^1.0.3",
    "bcrypt": "^5.1.1",
    "dotenv": "^17.2.3",
    "express": "^5.2.1",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^9.5.0"
  }
}
```

---

## Environment Variables (`.env.development.local`)

```
PORT=3000
MONGOOSE_URL=mongodb://localhost:27012/auth
RABBITMQ_URL=amqp://localhost:5672
JWT_SECRET=saasplug-dev-secret-change-me
```

> **JWT_SECRET** must be identical across all services that verify tokens.

---

## JWT Design

- **Algorithm:** HS256
- **Payload:** `{ userId, role, iat, exp }`
- **Expiry:** 2 hours (`expiresIn: "2h"`)
- **Secret:** loaded from `JWT_SECRET` env var

---

## Files to Implement (Checklist)

- [ ] `package.json` — dependencies & scripts
- [ ] `Dockerfile` — copy pattern from charger-service
- [ ] `.env.development.local` — local env vars
- [ ] `src/config/env.js` — export `PORT`, `MONGOOSE_URL`, `RABBITMQ_URL`, `JWT_SECRET`
- [ ] `src/constants/http-codes.js` — copy from charger-service
- [ ] `src/constants/messaging.js` — define `USER` exchange, `USER` queue, routing keys (`user.registered`, etc.)
- [ ] `src/errors/app-error.js` — copy from charger-service
- [ ] `src/infrastructure/mongoDB.js` — connect to MongoDB, sync Counter indexes
- [ ] `src/infrastructure/rabbitMQ.js` — copy from charger-service
- [ ] `src/middleware/error.middleware.js` — copy from charger-service
- [ ] `src/middleware/unmatched-routes.middleware.js` — copy from charger-service
- [ ] `src/models/counter.model.js` — auto-increment counter schema
- [ ] `src/models/auth-user.model.js` — auth user schema
- [ ] `src/repositories/auth-user.repository.js` — `findByEmail()`, `findById()`
- [ ] `src/services/auth.service.js` — `login(email, password)`, `validateToken(token)`
- [ ] `src/controllers/auth.controller.js` — `postLogin(req, res)`, `getValidate(req, res)`
- [ ] `src/dto/auth.dto.js` — `toAuthResponse(token, role)`, `toValidateResponse(valid, userId, role)`
- [ ] `src/routes/auth.route.js` — mount `POST /login`, `GET /validate`
- [ ] `src/app.js` — wire Express, MongoDB, RabbitMQ, routes, middleware

---

## Notes

- No registration endpoint — seed users directly in MongoDB (Compass / `mongosh`).
- `passwordHash` must be generated with `bcrypt.hashSync(password, 10)`.
- `userId` must be an integer — use the Counter collection when inserting manually.
- RabbitMQ setup is included now but will only be actively used when choreography events are added later.
