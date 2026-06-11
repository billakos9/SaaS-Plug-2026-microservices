import http from "./http";

/**
 * Fetches all users (Admin only).
 * Backend route: GET /admin/users
 */
export async function getAllUsers() {
  const res = await http.get("/admin/users");
  return res.data;
}

/**
 * Fetches all providers (Admin only).
 * Backend route: GET /admin/providers
 */
export async function getAllProviders() {
  const res = await http.get("/admin/providers");
  return res.data;
}

/**
 * Fetches all chargers (Admin only).
 * Backend route: GET /admin/chargers
 */
export async function getAllChargers() {
  const res = await http.get("/admin/chargers");
  return res.data;
}

/**
 * Fetches global statistics for the admin dashboard.
 * Backend route: GET /admin/analytics
 */
export async function getGlobalStats() {
  const res = await http.get("/admin/analytics");
  return res.data;
}

/**
 * Fetches energy/session breakdown by provider.
 * Backend route: GET /admin/analytics/providers
 */
export async function getProviderBreakdown() {
  const res = await http.get("/admin/analytics/providers");
  return res.data;
}

/**
 * Approves or registers a new provider (Admin only).
 * Backend route: POST /admin/providers
 */
export async function registerProvider(providerData) {
  const res = await http.post("/admin/providers", providerData);
  return res.data;
}

/**
 * Deletes a user (Admin only).
 * Backend route: DELETE /admin/users/:id
 */
export async function deleteUser(id) {
  const res = await http.delete(`/admin/users/${id}`);
  return res.data;
}
