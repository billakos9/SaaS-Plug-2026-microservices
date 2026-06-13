import http from "./http";

export async function getAllUsers() {
  const res = await http.get("/admin/users");
  return res.data;
}

export async function getAllProviders() {
  const res = await http.get("/admin/providers");
  return res.data;
}

export async function getProviderById(id) {
  const res = await http.get(`/admin/providers/${id}`);
  return res.data;
}

export async function getAllChargers() {
  const res = await http.get("/admin/chargers");
  return res.data;
}

export async function getGlobalStats() {
  const res = await http.get("/admin/analytics");
  return res.data;
}

export async function getProviderBreakdown() {
  const res = await http.get("/admin/analytics/providers");
  return res.data;
}

export async function getSystemHealth() {
  const res = await http.get("/admin/system-health");
  return res.data;
}

export async function registerProvider(providerData) {
  const res = await http.post("/admin/providers", providerData);
  return res.data;
}

export async function deleteProvider(id) {
  const res = await http.delete(`/admin/providers/delete/${id}`);
  return res.data;
}

export async function deleteUser(id) {
  const res = await http.delete(`/admin/users/${id}`);
  return res.data;
}

export async function createAdminAccount(data) {
  const res = await http.post("/admin/accounts", data);
  return res.data;
}

export async function getAllAdmins() {
  const res = await http.get("/admin/accounts");
  return res.data;
}

export async function deleteAdminAccount(id) {
  const res = await http.delete(`/admin/accounts/${id}`);
  return res.data;
}
