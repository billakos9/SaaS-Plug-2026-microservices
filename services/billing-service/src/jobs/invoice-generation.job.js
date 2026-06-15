import cron from "node-cron";
import BilledReservationRepository from "../repositories/billed-reservation.repository.js";
import InvoiceService from "../services/invoice.service.js";

function previousMonthPeriod() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

async function generateMonthlyInvoices() {
  const period = previousMonthPeriod();
  console.log(`[invoice-job] Generating invoices for period ${period}`);

  const providers = await BilledReservationRepository.distinctProvidersForPeriod(period);
  if (!providers.length) {
    console.log(`[invoice-job] No billing data for ${period}, skipping`);
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const providerName of providers) {
    try {
      await InvoiceService.generate({ providerName, period });
      created++;
    } catch (err) {
      if (err.statusCode === 409) {
        skipped++;
      } else {
        console.error(`[invoice-job] Failed for ${providerName}: ${err.message}`);
      }
    }
  }

  console.log(`[invoice-job] Done — created: ${created}, already existed: ${skipped}`);
}

export function startInvoiceGenerationJob() {
  cron.schedule("0 0 1 * *", () => {
    generateMonthlyInvoices().catch(err =>
      console.error("[invoice-job] Unhandled error:", err.message)
    );
  });
  console.log("[invoice-job] Monthly invoice generation scheduled (1st of each month, 00:00)");
}
