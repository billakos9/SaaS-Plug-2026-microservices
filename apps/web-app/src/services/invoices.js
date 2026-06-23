import http from "./http";

export async function getMyInvoices() {
  const res = await http.get("/billing/invoices/my");
  return res.data;
}

export async function getAllInvoices() {
  const res = await http.get("/billing/invoices");
  return res.data;
}

export async function generateInvoice({ providerName, period }) {
  const res = await http.post("/billing/invoices/generate", { providerName, period });
  return res.data;
}

export async function markInvoicePaid(invoiceId) {
  const res = await http.patch(`/billing/invoices/${invoiceId}/paid`);
  return res.data;
}

export async function payMyInvoice(invoiceId) {
  const res = await http.patch(`/billing/invoices/${invoiceId}/pay`);
  return res.data;
}

export async function getInvoiceDetail(invoiceId) {
  const res = await http.get(`/billing/invoices/${invoiceId}/detail`);
  return res.data;
}
