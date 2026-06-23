export const MessageQueues = Object.freeze({
  PROVIDER: "provider.management.queue",
  PROVIDER_REGISTRATION: "provider.registration.queue",
});

export const Exchanges = Object.freeze({
  PROVIDER: "provider",
});

export const RoutingKeys = Object.freeze({
  PROVIDER_UPDATE: "provider.update",
  PROVIDER_DELETE: "provider.delete",
  PROVIDER_ADD: "provider.add",
  PROVIDER_REGISTERED: "provider.registered",
});
