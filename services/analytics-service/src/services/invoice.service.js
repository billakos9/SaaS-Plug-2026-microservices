import InvoiceRepository from "../repositories/invoice.repository.js";
import AnalyticStatRepository from "../repositories/analytic-stat.repository.js";
import AppError from "../errors/app-error.js";
import { HttpCode } from "../constants/http-codes.js";
import { RESERVATION_SERVICE_URL } from "../config/env.js";

class InvoiceService {
  static async generate({ providerName, period }) {
    if (!providerName || !period) {
      throw new AppError(HttpCode.BAD_REQUEST, "providerName and period are required");
    }

    const invoices  = await InvoiceRepository.findByProviderName(providerName);
    const duplicate = invoices.find((inv) => inv.period === period) ?? null;

    if (duplicate) {
      throw new AppError(HttpCode.CONFLICT, "Invoice already exists for this provider and period");
    }

    const stat = await AnalyticStatRepository.getByProviderAndPeriod(providerName, period);
    if (!stat) {
      throw new AppError(HttpCode.NOT_FOUND, "No analytics data found for this provider and period");
    }

    const totalSessions = stat.totalReservations ?? 0;
    const totalRevenue  = stat.totalRevenue ?? 0;

    const commissionRate   = 0.10;
    const feePerSession    = 0.30;
    const commissionAmount = totalRevenue * commissionRate;
    const sessionFee       = totalSessions * feePerSession;
    const totalDue         = Math.round((commissionAmount + sessionFee) * 100) / 100;

    const invoiceId = await InvoiceRepository.getNextId();

    let invoice;
    try {
      invoice = await InvoiceRepository.create({
        invoiceId,
        providerName,
        period,
        totalSessions,
        totalRevenue,
        commissionRate,
        commissionAmount,
        feePerSession,
        sessionFee,
        totalDue,
      });
    } catch (err) {
      if (err.code === 11000) {
        throw new AppError(HttpCode.CONFLICT, "Invoice already exists for this provider and period");
      }
      throw err;
    }

    return invoice;
  }

  static async getByProviderName(providerName) {
    return InvoiceRepository.findByProviderName(providerName);
  }

  static async getAll() {
    return InvoiceRepository.findAll();
  }

  static async markPaid(invoiceId) {
    const numericId = Number(invoiceId);
    const existing = await InvoiceRepository.findById(numericId);
    if (!existing) {
      throw new AppError(HttpCode.NOT_FOUND, `Invoice ${numericId} not found`);
    }
    return InvoiceRepository.markPaid(numericId);
  }

  static async getDetail(invoiceId, requesterRole, requesterProviderName) {
    const numericId = Number(invoiceId);
    const invoice = await InvoiceRepository.findById(numericId);
    if (!invoice) {
      throw new AppError(HttpCode.NOT_FOUND, `Invoice ${numericId} not found`);
    }
    if (requesterRole === "provider" && invoice.providerName !== requesterProviderName) {
      throw new AppError(HttpCode.FORBIDDEN, "This invoice does not belong to your account");
    }

    const url = `${RESERVATION_SERVICE_URL}/internal/by-provider?providerName=${encodeURIComponent(invoice.providerName)}&period=${invoice.period}`;
    let reservations = [];
    try {
      const res = await fetch(url);
      if (res.ok) reservations = await res.json();
    } catch {
      // reservation-service unreachable — return invoice with empty lines
    }

    const lines = reservations.map(r => {
      const durationHrs = (r.duration || 0) / 3600;
      const energyKwh   = parseFloat((durationHrs * (r.capacityKw || 22)).toFixed(3));
      const cost        = parseFloat((energyKwh * (r.kwhPrice || 0)).toFixed(2));
      return {
        reservationId: r.reservationId,
        locationName:  r.locationName || `Charger ${r.chargerId}`,
        date:          r.createdAt,
        durationMin:   Math.round((r.duration || 0) / 60),
        energyKwh,
        kwhPrice:      r.kwhPrice || 0,
        cost,
        status:        r.status,
      };
    });

    return { invoice, lines };
  }

  static async payAsProvider(invoiceId, providerName) {
    const numericId = Number(invoiceId);
    const existing = await InvoiceRepository.findById(numericId);
    if (!existing) {
      throw new AppError(HttpCode.NOT_FOUND, `Invoice ${numericId} not found`);
    }
    if (existing.providerName !== providerName) {
      throw new AppError(HttpCode.FORBIDDEN, "This invoice does not belong to your account");
    }
    if (existing.status === "paid") {
      throw new AppError(HttpCode.CONFLICT, "Invoice is already paid");
    }
    return InvoiceRepository.markPaid(numericId);
  }
}

export default InvoiceService;
