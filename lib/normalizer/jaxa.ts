import type { JaxaLayerImage, JaxaResults, JaxaSpatialStats, JaxaTimeseries } from "../mcp/types";
import { coerceNumericValue } from "../coerce-number";
import type { NormalizedJaxa, NormalizedTimeseriesEntry, TimeseriesDataPoint } from "./index";

const KELVIN_OFFSET = 273.15;
const KELVIN_LIKE_THRESHOLD = 150;

export function normalizeJaxa(raw: JaxaResults): NormalizedJaxa {
  const result: NormalizedJaxa = {};

  if (raw.elevation) {
    result.elevation = {
      mean: coerceNumericValue(raw.elevation.mean),
      min: coerceNumericValue(raw.elevation.min),
      max: coerceNumericValue(raw.elevation.max),
      unit: "m",
    };
  }

  if (raw.ndvi) {
    const mean = coerceNumericValue(raw.ndvi.mean);
    let description = "データなし";
    if (mean !== undefined) {
      if (mean < 0.1) description = "植生なし（裸地・水域・都市部）";
      else if (mean < 0.2) description = "植生が非常に少ない";
      else if (mean < 0.3) description = "植生が少ない（都市部に多い）";
      else if (mean < 0.5) description = "中程度の植生";
      else if (mean < 0.7) description = "豊かな植生";
      else description = "非常に豊かな植生（森林地帯に多い）";
    }
    result.ndvi = {
      mean,
      min: coerceNumericValue(raw.ndvi.min),
      max: coerceNumericValue(raw.ndvi.max),
      description,
    };
  }

  if (raw.lst) {
    const mean = coerceNumericValue(raw.lst.mean);
    const min = coerceNumericValue(raw.lst.min);
    const max = coerceNumericValue(raw.lst.max);
    result.lst = {
      mean: normalizeLstValue(mean, raw.lst.unit),
      min: normalizeLstValue(min, raw.lst.unit),
      max: normalizeLstValue(max, raw.lst.unit),
      unit: "°C",
    };
  }

  if (raw.precipitation) {
    result.precipitation = {
      mean: coerceNumericValue(raw.precipitation.mean),
      unit: "mm",
    };
  }

  const visualizations = [
    buildVisualization(raw.images?.ndvi, raw.ndvi, undefined),
    buildVisualization(
      raw.images?.lst,
      raw.lst,
      "°C",
      (value) => normalizeLstValue(value, raw.lst?.unit) ?? value
    ),
    buildVisualization(raw.images?.precipitation, raw.precipitation, "mm"),
  ].filter((value): value is NonNullable<typeof value> => value !== null);

  if (visualizations.length > 0) {
    result.visualizations = visualizations;
  }

  // Normalize timeseries data
  if (raw.timeseriesData) {
    const ts: NonNullable<NormalizedJaxa["timeseries"]> = {};

    if (raw.timeseriesData.ndvi) {
      const entry = normalizeTimeseries(raw.timeseriesData.ndvi, "NDVI", "");
      if (entry) ts.ndvi = entry;
    }
    if (raw.timeseriesData.lst) {
      const entry = normalizeTimeseries(
        raw.timeseriesData.lst,
        "地表面温度",
        "°C",
        (value) => normalizeLstValue(value, raw.timeseriesData?.lst?.unit) ?? value
      );
      if (entry) ts.lst = entry;
    }
    if (raw.timeseriesData.precipitation) {
      const entry = normalizeTimeseries(raw.timeseriesData.precipitation, "月次降水量", "mm/月");
      if (entry) ts.precipitation = entry;
    }

    if (Object.keys(ts).length > 0) {
      result.timeseries = ts;
    }
  }

  return result;
}

function normalizeTimeseries(
  raw: JaxaTimeseries,
  label: string,
  unit: string,
  normalizeValue: (value: number) => number = (value) => value
): NormalizedTimeseriesEntry | undefined {
  if (!raw.points || raw.points.length === 0) return undefined;

  const data: TimeseriesDataPoint[] = [];
  for (const p of raw.points) {
    const mean = normalizeValue(p.mean);
    if (!Number.isFinite(mean)) continue;
    const point: TimeseriesDataPoint = { date: p.date, mean };
    if (p.min !== undefined) {
      const min = normalizeValue(p.min);
      if (Number.isFinite(min)) point.min = min;
    }
    if (p.max !== undefined) {
      const max = normalizeValue(p.max);
      if (Number.isFinite(max)) point.max = max;
    }
    data.push(point);
  }

  if (data.length === 0) return undefined;
  return { label, unit, data };
}

function buildVisualization(
  image: JaxaLayerImage | null | undefined,
  stats: JaxaSpatialStats | null | undefined,
  unitOverride?: string,
  normalizeValue: (value: number) => number = (value) => value
) {
  if (!image) return null;

  const mean = coerceNumericValue(stats?.mean);
  const min = coerceNumericValue(stats?.min);
  const max = coerceNumericValue(stats?.max);

  return {
    ...image,
    mean: mean !== undefined ? normalizeValue(mean) : undefined,
    min: min !== undefined ? normalizeValue(min) : undefined,
    max: max !== undefined ? normalizeValue(max) : undefined,
    unit: unitOverride ?? stats?.unit,
    valueLabel: formatValueLabel(image.id, mean, unitOverride ?? stats?.unit, normalizeValue),
  };
}

function formatValueLabel(
  id: "ndvi" | "lst" | "precipitation",
  value: number | undefined,
  unit?: string,
  normalizeValue: (value: number) => number = (value) => value
): string | undefined {
  if (value === undefined) return undefined;

  const normalizedValue = normalizeValue(value);
  if (id === "ndvi") {
    return `平均 ${normalizedValue.toLocaleString("ja-JP", { maximumFractionDigits: 3 })}`;
  }

  return `平均 ${normalizedValue.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}${unit ?? ""}`;
}

function normalizeLstValue(value: number | undefined, unit?: string): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;

  const normalizedUnit = normalizeTemperatureUnit(unit);
  if (normalizedUnit === "celsius") return value;
  if (normalizedUnit === "kelvin") return value - KELVIN_OFFSET;

  // JAXA LST is normally Kelvin. If the upstream wrapper omits the unit,
  // only convert values that are clearly Kelvin-like to avoid double conversion.
  return value >= KELVIN_LIKE_THRESHOLD ? value - KELVIN_OFFSET : value;
}

function normalizeTemperatureUnit(unit?: string): "celsius" | "kelvin" | undefined {
  const normalized = unit?.trim().toLowerCase();
  if (!normalized) return undefined;

  if (normalized === "k" || normalized === "kelvin") {
    return "kelvin";
  }

  if (normalized === "c" || normalized === "°c" || normalized === "℃" || normalized === "celsius") {
    return "celsius";
  }

  return undefined;
}
