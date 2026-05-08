// Provider-service is the authoritative source of provider data — it only publishes events.
// It must not consume from its own exchange (would create a self-loop).
// This file is intentionally empty and kept for structural consistency.
export async function startProviderQueueConsumer() {}
