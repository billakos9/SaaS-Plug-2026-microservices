export const API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  "/api";

export const API_ENDPOINTS = {
  auth: {
    login: "/auth/login",
    register: "/auth/register",
    registerAdmin: "/auth/admin/register",
    registerProvider: "/auth/provider/register",
  },
  users: {
    me: "/users/me",
  },
  admin: {
    users: "/admin/users",
    user: (id) => `/admin/users/${id}`,
    providers: "/admin/providers",
    provider: (id) => `/admin/providers/${id}`,
    deleteProvider: (id) => `/admin/providers/delete/${id}`,
    chargers: "/admin/chargers",
    analytics: "/admin/analytics",
    providerAnalytics: "/admin/analytics/providers",
    systemHealth: "/admin/system-health",
    accounts: "/admin/accounts",
    account: (id) => `/admin/accounts/${id}`,
  },
  chargers: {
    list: "/chargers/",
    byStatus: (status) => `/chargers/status/${status}`,
    byProvider: (providerId) => `/chargers/provider/${providerId}`,
    byId: (id) => `/chargers/id/${id}`,
  },
  reservations: {
    create: "/reservations",
    byUser: (userId) => `/reservations/user/${userId}`,
    byId: (id) => `/reservations/${id}`,
    cancel: (id) => `/reservations/${id}/cancel`,
    complete: (id) => `/reservations/${id}/complete`,
  },
  providers: {
    legacyRegister: "/providers",
    me: "/providers/me",
  },
  billing: {
    myInvoices: "/billing/invoices/my",
    invoices: "/billing/invoices",
    generate: "/billing/invoices/generate",
    markPaid: (invoiceId) => `/billing/invoices/${invoiceId}/paid`,
    payMine: (invoiceId) => `/billing/invoices/${invoiceId}/pay`,
    detail: (invoiceId) => `/billing/invoices/${invoiceId}/detail`,
  },
  analytics: {
    global: (query = "") => `/analytics/global${query}`,
    providers: (query = "") => `/analytics/providers${query}`,
    provider: (providerName, query = "") =>
      `/analytics/provider/${providerName}${query}`,
    globalHistory: "/analytics/history/global",
    providerHistory: (providerName) =>
      `/analytics/history/provider/${providerName}`,
  },
};
