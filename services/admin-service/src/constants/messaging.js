export const MessageQueues = Object.freeze({
  PROVIDER: "admin.provider.events.queue",
  CHARGER:  "admin.charger.events.queue",
});

export const Exchanges = Object.freeze({
  PROVIDER: "provider",
  CHARGER:  "charger",
});

export const RoutingKeys = Object.freeze({
  PROVIDER_ADD:    "provider.add",
  PROVIDER_UPDATE: "provider.update",
  PROVIDER_DELETE: "provider.delete",
  CHARGER_ADD:     "charger.add",
  CHARGER_UPDATE:  "charger.update",
  CHARGER_DELETE:  "charger.delete",
});
