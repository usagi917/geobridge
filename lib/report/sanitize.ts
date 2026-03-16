export function sanitizeLandPricePoints(
  points: Array<{ price: number; address?: string; year?: number }> | undefined
): Array<{ price: number; address?: string; year?: number }> {
  return (points ?? []).filter((point) => Number.isFinite(point.price) && point.price >= 100);
}

export function sanitizeLandPriceHistory(
  points: Array<{ year: number; price: number; address?: string }> | undefined
): Array<{ year: number; price: number; address?: string }> {
  return (points ?? []).filter((point) => (
    Number.isFinite(point.year) &&
    Number.isFinite(point.price) &&
    point.price > 0
  ));
}
