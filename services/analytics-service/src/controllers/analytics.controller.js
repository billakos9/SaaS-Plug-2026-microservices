import AnalyticsService from "../services/analytics.service.js";
import { toAnalyticsReportDTO } from "../dto/analytics.dto.js";

export async function getProviderReport(req, res, next) {
  try {
    const { providerName } = req.params;
    const period = req.query.period ?? new Date().toISOString().slice(0, 7);
    const report = await AnalyticsService.getProviderReport(providerName, period);
    res.json(toAnalyticsReportDTO(report));
  } catch (err) {
    next(err);
  }
}

export async function getAllProvidersReport(req, res, next) {
  try {
    const period = req.query.period ?? new Date().toISOString().slice(0, 7);
    const result = await AnalyticsService.getAllProvidersReport(period);
    res.json({
      period:      result.period,
      generatedAt: result.generatedAt,
      providers:   result.providers.map(toAnalyticsReportDTO),
    });
  } catch (err) {
    next(err);
  }
}

export async function getProviderHistory(req, res, next) {
  try {
    const { providerName } = req.params;
    const data = await AnalyticsService.getProviderHistory(providerName);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getGlobalHistory(req, res, next) {
  try {
    const data = await AnalyticsService.getGlobalHistory();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getGlobalReport(req, res, next) {
  try {
    const period = req.query.period ?? new Date().toISOString().slice(0, 7);
    const result = await AnalyticsService.getGlobalReport(period);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
