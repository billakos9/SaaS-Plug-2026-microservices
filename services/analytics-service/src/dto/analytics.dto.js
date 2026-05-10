export function toAnalyticsReportDTO(data) {
  return {
    providerName:           data.providerName,
    period:                 data.period,
    totalChargers:          data.totalChargers,
    chargersByStatus:       data.chargersByStatus,
    utilizationRate:        data.utilizationRate,
    averageKwhPrice:        data.averageKwhPrice,
    totalReservations:      data.totalReservations,
    averageDurationMinutes: data.averageDurationMinutes,
    totalRevenue:           data.totalRevenue,
  };
}
