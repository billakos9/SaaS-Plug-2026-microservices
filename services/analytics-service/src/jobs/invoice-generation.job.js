import cron from "node-cron";
import AnalyticStatRepository from "../repositories/analytic-stat.repository.js";
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

  const stats = await AnalyticStatRepository.getAllByPeriod(period);
  if (!stats.length) {
    console.log(`[invoice-job] No analytics data for ${period}, skipping`);
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const stat of stats) {
    try {
      await InvoiceService.generate({ providerName: stat.providerName, period });
      created++;
    } catch (err) {
      if (err.statusCode === 409) {
        skipped++;
      } else {
        console.error(`[invoice-job] Failed for ${stat.providerName}: ${err.message}`);
      }
    }
  }

  console.log(`[invoice-job] Done — created: ${created}, already existed: ${skipped}`);
}

export function startInvoiceGenerationJob() {
  // Run at 00:00 on the 1st of every month
  cron.schedule("0 0 1 * *", () => {
    generateMonthlyInvoices().catch(err =>
      console.error("[invoice-job] Unhandled error:", err.message)
    );
  });
  console.log("[invoice-job] Monthly invoice generation scheduled (1st of each month, 00:00)");
}
