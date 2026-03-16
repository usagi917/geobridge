export function coerceNumericValue(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const direct = Number(trimmed);
    if (Number.isFinite(direct)) {
      return direct;
    }

    // Handle comma-separated numbers like "1,000,000"
    const commaStripped = trimmed.replace(/,/g, "");
    if (commaStripped !== trimmed) {
      const commaFree = Number(commaStripped);
      if (Number.isFinite(commaFree)) return commaFree;
    }

    const match = trimmed.match(/[-+]?(?:\d+\.\d*|\d*\.\d+|\d+)(?:e[-+]?\d+)?/i);
    if (!match) return undefined;

    const extracted = Number(match[0]);
    return Number.isFinite(extracted) ? extracted : undefined;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const coerced = coerceNumericValue(entry);
      if (coerced !== undefined) {
        return coerced;
      }
    }
  }

  return undefined;
}
