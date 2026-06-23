import http from "./http";
import { API_ENDPOINTS } from "../config/api";

export async function getAllUsers() {
  const res = await http.get(API_ENDPOINTS.admin.users);
  return res.data;
}

export async function getAllProviders() {
  const res = await http.get(API_ENDPOINTS.admin.providers);
  return res.data;
}

export async function getProviderById(id) {
  const res = await http.get(API_ENDPOINTS.admin.provider(id));
  return res.data;
}

export async function getAllChargers() {
  const res = await http.get(API_ENDPOINTS.admin.chargers);
  return res.data;
}

export async function getGlobalStats() {
  const res = await http.get(API_ENDPOINTS.admin.analytics);
  return res.data;
}

export async function getProviderBreakdown() {
  const res = await http.get(API_ENDPOINTS.admin.providerAnalytics);
  return res.data;
}

export async function getSystemHealth() {
  const res = await http.get(API_ENDPOINTS.admin.systemHealth);
  return res.data;
}

export async function registerProvider(providerData) {
  const res = await http.post(API_ENDPOINTS.admin.providers, providerData);
  return res.data;
}

export async function deleteProvider(id) {
  const res = await http.delete(API_ENDPOINTS.admin.deleteProvider(id));
  return res.data;
}

export async function deleteUser(id) {
  const res = await http.delete(API_ENDPOINTS.admin.user(id));
  return res.data;
}

export async function createAdminAccount(data) {
  const res = await http.post(API_ENDPOINTS.auth.registerAdmin, data);
  return res.data;
}

export async function getAllAdmins() {
  const res = await http.get(API_ENDPOINTS.admin.accounts);
  return res.data;
}

export async function deleteAdminAccount(id) {
  const res = await http.delete(API_ENDPOINTS.admin.account(id));
  return res.data;
}
