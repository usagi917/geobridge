export function formatPrecipitation(value: number): string {
  const fractionDigits = Math.abs(value) < 0.1 ? 3 : 1;
  return value.toLocaleString("ja-JP", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}
