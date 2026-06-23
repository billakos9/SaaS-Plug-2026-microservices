import OutboxEvent from "../models/outbox-event.model.js";

export async function writeOutbox(exchange, routingKey, payload) {
  return OutboxEvent.create({ exchange, routingKey, payload });
}

export function startOutboxRelay(publishFn) {
  const RELAY_INTERVAL_MS = 30_000;
  const RELAY_DELAY_MS    = 30_000; // only retry entries older than 30s

  setInterval(async () => {
    const cutoff = new Date(Date.now() - RELAY_DELAY_MS);
    let pending;
    try {
      pending = await OutboxEvent.find({ publishedAt: null, createdAt: { $lt: cutoff } });
    } catch (err) {
      console.error("[outbox] relay query failed:", err.message);
      return;
    }

    for (const entry of pending) {
      try {
        await publishFn(entry.exchange, entry.routingKey, entry.payload);
        entry.publishedAt = new Date();
        await entry.save();
      } catch (err) {
        console.error("[outbox] relay publish failed for entry", entry._id, ":", err.message);
      }
    }
  }, RELAY_INTERVAL_MS);
}
