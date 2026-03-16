import { coerceNumericValue } from "./coerce-number";
import type { JaxaTimeseriesPoint } from "./mcp/types";

export interface RawSpatialStatsSeries {
  mean?: unknown[];
  min?: unknown[];
  max?: unknown[];
}

export function generateMonthLabels(startYear: number, count: number): string[] {
  const labels: string[] = [];
  let year = startYear;
  let month = 1;

  for (let index = 0; index < count; index++) {
    labels.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;

    if (month > 12) {
      year += 1;
      month = 1;
    }
  }

  return labels;
}

export function buildMonthlyTimeseriesPoints(
  raw: RawSpatialStatsSeries,
  year: number
): JaxaTimeseriesPoint[] {
  const meanSeries = raw.mean ?? [];
  const minSeries = raw.min ?? [];
  const maxSeries = raw.max ?? [];

  if (meanSeries.length === 0) {
    return [];
  }

  const labels = generateMonthLabels(year, meanSeries.length);
  const points: JaxaTimeseriesPoint[] = [];

  for (let index = 0; index < meanSeries.length; index++) {
    const mean = coerceNumericValue(meanSeries[index]);
    if (mean === undefined) {
      continue;
    }

    const point: JaxaTimeseriesPoint = {
      date: labels[index] ?? `${year}-${String(index + 1).padStart(2, "0")}`,
      mean,
    };

    const min = coerceNumericValue(minSeries[index]);
    if (min !== undefined) {
      point.min = min;
    }

    const max = coerceNumericValue(maxSeries[index]);
    if (max !== undefined) {
      point.max = max;
    }

    points.push(point);
  }

  return points;
}
