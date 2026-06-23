import http from "./http";
import { API_ENDPOINTS } from "../config/api";


const normalizeProvider = (provider) => ({
  id: provider.providerId ?? provider.id ?? null,
  name: provider.providerName ?? provider.name ?? "",
  email: provider.providerEmail ?? provider.email ?? "",
  phoneNumber: provider.providerPhoneNumber ?? provider.phoneNumber ?? null,
  status: provider.status ?? "pending",
  raw: provider,
});

// legacy — used by admin panel flows
export async function registerProvider(payload) {
  const res = await http.post(API_ENDPOINTS.providers.legacyRegister, payload);
  return normalizeProvider(res.data ?? {});
}

// public self-registration — gated by registration code
export async function selfRegisterProvider(payload) {
  const res = await http.post(API_ENDPOINTS.auth.registerProvider, payload);
  return res.data ?? {};
}


export async function getProviderProfile() {
  const res = await http.get(API_ENDPOINTS.providers.me);
  return normalizeProvider(res.data ?? {});
}


export async function updateProviderProfile(payload) {
  const res = await http.patch(API_ENDPOINTS.providers.me, payload);
  return normalizeProvider(res.data ?? {});
}

export { normalizeProvider };
