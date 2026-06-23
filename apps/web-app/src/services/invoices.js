import http from "./http";
import { API_ENDPOINTS } from "../config/api";

export async function getMyInvoices() {
  const res = await http.get(API_ENDPOINTS.billing.myInvoices);
  return res.data;
}

export async function getAllInvoices() {
  const res = await http.get(API_ENDPOINTS.billing.invoices);
  return res.data;
}

export async function generateInvoice({ providerName, period }) {
  const res = await http.post(API_ENDPOINTS.billing.generate, { providerName, period });
  return res.data;
}

export async function markInvoicePaid(invoiceId) {
  const res = await http.patch(API_ENDPOINTS.billing.markPaid(invoiceId));
  return res.data;
}

export async function payMyInvoice(invoiceId) {
  const res = await http.patch(API_ENDPOINTS.billing.payMine(invoiceId));
  return res.data;
}

export async function getInvoiceDetail(invoiceId) {
  const res = await http.get(API_ENDPOINTS.billing.detail(invoiceId));
  return res.data;
}
