# plug-service

Event-driven plug orchestrator. It polls provider adapters and publishes charger
updates for the platform.

## Health

```text
GET /health
```

## Responsibilities

- Polls bluePlug, redPlug, and greenPlug adapters.
- Normalizes provider charger data.
- Publishes charger add/update events through RabbitMQ.
- Keeps charger-service/admin-service informed about provider station changes.

## Required Environment

```text
PORT=3000
RABBITMQ_URL=amqp://rabbitmq:5672
BLUE_PLUG_ADAPTER_URL=http://blueplug-adapter:3000/bluePlugAdapter
RED_PLUG_ADAPTER_URL=http://redplug-adapter:3000/redPlugAdapter
GREEN_PLUG_ADAPTER_URL=http://greenplug-adapter:3000/greenPlugAdapter
POLL_INTERVAL_MINUTES=15
```
