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

Stop with
```bash
docker compose down
```

Host ports are exposed for all services, enabling direct access via MongoDB Compass,
the RabbitMQ management UI (http://localhost:15672), or tools like Postman.

The canonical public API entrypoint is:

```text
http://localhost/api
```
