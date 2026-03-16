import type { JaxaSpatialStats, JaxaTimeseries } from "./mcp/types";

function getDaysInMonthUtc(year: number, monthOneBased: number): number {
  return new Date(Date.UTC(year, monthOneBased, 0)).getUTCDate();
}

function getMonthHours(dateLabel: string): number {
  const [yearText, monthText] = dateLabel.split("-");
  const year = Number.parseInt(yearText ?? "", 10);
  const month = Number.parseInt(monthText ?? "", 10);

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return 24;
  }

  return getDaysInMonthUtc(year, month) * 24;
}

export function getMonthlyHoursFromRange([start, end]: [string, string]): number {
  const startMonth = start.slice(0, 7);
  const endMonth = end.slice(0, 7);

  if (startMonth === endMonth) {
    return getMonthHours(startMonth);
  }

  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

  if (!Number.isFinite(diffHours) || diffHours <= 0) {
    return 24;
  }

  return Math.round(diffHours + 1 / 3600);
}

function convertRateValue(value: number | undefined, hours: number): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  return Number((value * hours).toFixed(4));
}

export function convertMonthlyRateStatsToAccumulation(
  stats: JaxaSpatialStats | null,
  dateRange: [string, string]
): JaxaSpatialStats | null {
  if (!stats) {
    return null;
  }

  const hours = getMonthlyHoursFromRange(dateRange);

  return {
    ...stats,
    mean: convertRateValue(stats.mean, hours),
    std: convertRateValue(stats.std, hours),
    min: convertRateValue(stats.min, hours),
    max: convertRateValue(stats.max, hours),
    median: convertRateValue(stats.median, hours),
    unit: "mm",
  };
}

export function convertMonthlyRateTimeseriesToAccumulation(
  timeseries: JaxaTimeseries | null
): JaxaTimeseries | null {
  if (!timeseries) {
    return null;
  }

  return {
    ...timeseries,
    unit: "mm/月",
    points: timeseries.points.map((point) => {
      const hours = getMonthHours(point.date);
      return {
        ...point,
        mean: convertRateValue(point.mean, hours) ?? point.mean,
        min: convertRateValue(point.min, hours),
        max: convertRateValue(point.max, hours),
      };
    }),
  };
}
