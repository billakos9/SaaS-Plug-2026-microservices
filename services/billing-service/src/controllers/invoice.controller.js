import InvoiceService from "../services/invoice.service.js";

export async function postGenerate(req, res, next) {
  try {
    const { providerName, period } = req.body;
    const invoice = await InvoiceService.generate({ providerName, period });
    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
}

export async function getByProvider(req, res, next) {
  try {
    const { providerName } = req.user;
    const invoices = await InvoiceService.getByProviderName(providerName);
    res.json(invoices);
  } catch (err) {
    next(err);
  }
}

export async function getAll(req, res, next) {
  try {
    const invoices = await InvoiceService.getAll();
    res.json(invoices);
  } catch (err) {
    next(err);
  }
}

export async function patchMarkPaid(req, res, next) {
  try {
    const { invoiceId } = req.params;
    const invoice = await InvoiceService.markPaid(invoiceId);
    res.json(invoice);
  } catch (err) {
    next(err);
  }
}

export async function getDetail(req, res, next) {
  try {
    const { invoiceId } = req.params;
    const { role, providerName } = req.user;
    const detail = await InvoiceService.getDetail(invoiceId, role, providerName);
    res.json(detail);
  } catch (err) {
    next(err);
  }
}

export async function patchPayAsProvider(req, res, next) {
  try {
    const { invoiceId } = req.params;
    const { providerName } = req.user;
    const invoice = await InvoiceService.payAsProvider(invoiceId, providerName);
    res.json(invoice);
  } catch (err) {
    next(err);
  }
}
