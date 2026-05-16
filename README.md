# NTUA ECE SAAS 2026 PROJECT

## TEAM 09

## 📁 Root structure
```
saasplug/
│
├── apps/ # entry points
│ ├── api-gateway/
│ ├── web-app/ # frontend
│
├── services/
│ ├── auth-service/
│ ├── user-service/
│ ├── charger-service/
│ ├── reservation-service/
│ ├── provider-service/
│ ├── analytics-service/
│ ├── admin-service/
│ ├── plug-service/ 
│ ├── adapters/ 
│   ├── blueplug/
│   ├── redplug/
│   ├── greenplug/
│
├── shared/ # shared logic
│ ├── types/ # DTOs, interfaces
│ ├── utils/
│ ├── config/
│ ├── logger/
│ ├── errors/
│
├── scripts/ # dev scripts
│
├── .eslintrc.js
├── .prettierrc
├── package.json
├── docker-compose.yml
└── README.md
```

## Docker Compose modes

Production-like mode exposes only the API Gateway on the host. All services,
databases, RabbitMQ, and plug adapters stay internal to the Docker network.

```bash
docker compose up -d --build
```

Local dev/debug mode adds explicit host ports for modular testing and tools
such as MongoDB Compass or the RabbitMQ management UI.

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Stop local dev mode with the same compose files:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```

The canonical public API entrypoint is:

```text
http://localhost/api
```
