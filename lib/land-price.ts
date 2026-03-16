import { coerceNumericValue } from "./coerce-number";

const RAW_PRICE_KEYS = [
  "price",
  "current_years_price",
  "u_current_years_price",
  "L01_008",
];

const LOCALIZED_PRICE_KEYS = [
  "u_current_years_price_ja",
  "current_years_price_ja",
];

const YEAR_TEXT_KEYS = [
  "target_year_name_ja",
  "survey_year_name_ja",
];

const YEAR_NUMBER_KEYS = [
  "year",
  "target_year",
  "survey_year",
  "L01_007",
];

export function extractLandPriceValue(props: Record<string, unknown>): number | undefined {
  for (const key of RAW_PRICE_KEYS) {
    const parsed = parseLandPriceValue(props[key]);
    if (parsed !== undefined) {
      return parsed;
    }
  }

  for (const key of LOCALIZED_PRICE_KEYS) {
    const parsed = parseLandPriceValue(props[key]);
    if (parsed !== undefined) {
      return parsed;
    }
  }

  return undefined;
}

export function extractLandPriceYear(props: Record<string, unknown>): number | undefined {
  for (const key of YEAR_TEXT_KEYS) {
    const year = extractJapaneseYear(props[key]);
    if (year !== undefined) {
      return year;
    }
  }

  for (const key of YEAR_NUMBER_KEYS) {
    const year = coerceNumericValue(props[key]);
    if (year !== undefined) {
      return year;
    }
  }

  return undefined;
}

export function parseLandPriceValue(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const normalized = trimmed.replace(/,/g, "");
    const numericPart = normalized.match(/[-+]?(?:\d+\.\d*|\d*\.\d+|\d+)/)?.[0];
    if (!numericPart) return undefined;

    const amount = Number(numericPart);
    if (!Number.isFinite(amount)) return undefined;

    if (normalized.includes("億")) return amount * 100_000_000;
    if (normalized.includes("百万円")) return amount * 1_000_000;
    if (normalized.includes("万円")) return amount * 10_000;
    if (normalized.includes("千円")) return amount * 1_000;
    return amount;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const parsed = parseLandPriceValue(entry);
      if (parsed !== undefined) {
        return parsed;
      }
    }
  }

  return undefined;
}

function extractJapaneseYear(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;

  const gregorianMatch = value.match(/\b(19|20)\d{2}\b/);
  if (gregorianMatch) {
    return Number(gregorianMatch[0]);
  }

  const reiwaMatch = value.match(/令和\s*(\d+)/);
  if (reiwaMatch) {
    return 2018 + Number(reiwaMatch[1]);
  }

  const heiseiMatch = value.match(/平成\s*(\d+)/);
  if (heiseiMatch) {
    return 1988 + Number(heiseiMatch[1]);
  }

  return undefined;
}
