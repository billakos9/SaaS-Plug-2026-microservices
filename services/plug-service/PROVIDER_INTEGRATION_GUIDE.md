# Plug-Service — Provider Integration Guide

The provider-service is now fully implemented and publishes RabbitMQ events whenever
providers are added, updated, or deleted. This guide describes the **3 changes** needed
in plug-service to integrate with it.

---

## Context

Currently plug-service has this in `src/constants/provider-base-url.js`:

```js
export const PROVIDER_BASE_URLS = {
  bluePlug:  BLUE_PLUG_ADAPTER_URL,
  redPlug:   RED_PLUG_ADAPTER_URL,
  greenPlug: GREEN_PLUG_ADAPTER_URL,
};
```

And `app.js` passes this hardcoded map to `startProviderPolling()`.

The goal is to replace this with:
1. A dynamic map fetched from provider-service on startup (HTTP).
2. A RabbitMQ consumer that updates the map live as providers change.

The `startProviderPolling()` job itself does not need to change — it already accepts
the map as a parameter and the map is read on every polling cycle.

---

## Change 1 — `src/infrastructure/rabbitMQ.js`

Assert the `provider` exchange and bind the `provider.management.queue` inside
`setupMessaging()`, so plug-service can consume provider events.

Add after the existing exchange/queue assertions:

```js
// Provider exchange — consume add/update/delete events from provider-service
await channel.assertExchange("provider", "topic", { durable: true });
await channel.assertQueue("provider.management.queue", { durable: true });
await channel.bindQueue("provider.management.queue", "provider", "provider.*");
```

---

## Change 2 — `src/events/rabbitmq.consumer.js`

Add a new exported function `startProviderQueueConsumer(providers)`.

The `providers` parameter is the **live map object** (`{ [providerName]: apiBaseUrl }`).
Mutations to it are immediately visible to the running polling job because JavaScript
objects are passed by reference.

```js
/**
 * Subscribes to provider.management.queue and keeps the providers map up to date.
 *
 * @param {Object} providers - Live map of { providerName: adapterBaseUrl }.
 *                             Mutated in-place so the polling job sees changes immediately.
 */
export async function startProviderQueueConsumer(providers) {
  try {
    const channel = await getChannelWithRetry();

    await channel.assertQueue("provider.management.queue", { durable: true });

    await channel.consume("provider.management.queue", (message) => {
      if (!message) return;

      const routingKey = message.fields.routingKey;
      const data = JSON.parse(message.content.toString());

      switch (routingKey) {
        case "provider.add":
        case "provider.update":
          providers[data.providerName] = data.apiBaseUrl;
          console.log(`Provider map updated: ${data.providerName} → ${data.apiBaseUrl}`);
          break;

        case "provider.delete":
          // provider.delete payload only contains { providerId }, not providerName.
          // Find the entry by scanning the map.
          // NOTE: if you want to avoid this scan, change the provider-service
          // deleteProvider() to also include providerName in the event payload.
          for (const [name, _] of Object.entries(providers)) {
            // You can't match by providerId here without extra state.
            // Simplest fix: include providerName in the delete event payload
            // (one-line change in provider-service/src/services/provider.service.js).
          }
          console.log("Provider delete event received — see NOTE above.");
          break;

        default:
          console.log("Unhandled provider event:", routingKey);
      }

      channel.ack(message);
    });
  } catch (error) {
    console.error("Provider queue consumer error:", error);
  }
}
```

> **NOTE on provider.delete**: The current provider-service publishes
> `{ providerId }` on delete. To remove the right entry from the map you also
> need `providerName`. The easiest fix is a one-line change in
> `provider-service/src/services/provider.service.js`, in `deleteProvider()`:
>
> ```js
> // Change this:
> await publishEvent(Exchanges.PROVIDER, RoutingKeys.PROVIDER_DELETE, { providerId });
>
> // To this (you need the provider object — fetch it before deleting):
> const provider = await ProviderRepository.getById(providerId);
> const result = await ProviderRepository.delete(providerId);
> await publishEvent(Exchanges.PROVIDER, RoutingKeys.PROVIDER_DELETE, {
>   providerId,
>   providerName: provider.providerName,
> });
> ```
>
> Then in the consumer the `provider.delete` case becomes:
> ```js
> case "provider.delete":
>   delete providers[data.providerName];
>   break;
> ```

---

## Change 3 — `src/app.js`

Replace the hardcoded `PROVIDER_BASE_URLS` import with a dynamic HTTP fetch from
provider-service, then start the provider queue consumer.

```js
// Replace:
// import { PROVIDER_BASE_URLS } from "./constants/provider-base-url.js";

import { startProviderQueueConsumer } from "./events/rabbitmq.consumer.js";

// Helper — fetch all providers from provider-service with retry/self-healing
async function fetchProvidersWithRetry(retries = 5, delayMs = 3000) {
  while (retries > 0) {
    try {
      const response = await fetch("http://provider-service:3000/provider");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const providers = await response.json();
      // providers is [{ providerId, providerName, apiBaseUrl }, ...]
      const map = {};
      for (const p of providers) {
        map[p.providerName] = p.apiBaseUrl;
      }
      console.log("Fetched providers from provider-service:", map);
      return map;
    } catch (err) {
      console.warn(`Could not reach provider-service (${err.message}), retrying...`);
      retries--;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  console.warn("provider-service unreachable — starting with empty provider map (self-healing)");
  return {};
}

// In your startup sequence (replace the existing startProviderPolling call):
setupMessaging();
startChargerQueueConsumer();

const providers = await fetchProvidersWithRetry();  // { providerName: adapterUrl }
startProviderQueueConsumer(providers);               // keeps map live via events
startProviderPolling(providers, 1);                  // polling uses same map object
```

`fetch` is available natively in Node 18+. No extra package needed.

---

## What `apiBaseUrl` contains

The `apiBaseUrl` stored in provider-service for each provider is the **base URL of
the internal plug adapter** for that provider, e.g.:

| providerName | apiBaseUrl |
|---|---|
| `bluePlug`  | `http://blueplug-adapter:3000/bluePlugAdapter`  |
| `redPlug`   | `http://redplug-adapter:3000/redPlugAdapter`    |
| `greenPlug` | `http://greenplug-adapter:3000/greenPlugAdapter`|

This is exactly what `PlugAdapterHttpClient` appends `/fetchPoints` and
`/postReservations` to — so no changes are needed there.

When registering a provider via `POST /provider/register`, set `apiBaseUrl` to the
adapter's base path as shown above.

---

## Summary of files to touch in plug-service

| File | Change |
|---|---|
| `src/infrastructure/rabbitMQ.js` | Assert `provider` exchange + queue in `setupMessaging()` |
| `src/events/rabbitmq.consumer.js` | Add `startProviderQueueConsumer(providers)` |
| `src/app.js` | Replace hardcoded map with `fetchProvidersWithRetry()`, call new consumer |
