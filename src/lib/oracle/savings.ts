export type EstimateSavingsOpts = {
  recommendedPrice: number;
  baselinePrice: number;
  gallonsAssumed?: number;
};

const DEFAULT_GALLONS = 12;

export function estimateSavings(opts: EstimateSavingsOpts): number {
  const gallons = opts.gallonsAssumed ?? DEFAULT_GALLONS;
  const raw = (opts.baselinePrice - opts.recommendedPrice) * gallons;
  const floored = Math.max(0, raw);
  return Math.round(floored * 100) / 100;
}

// Median price across station rows. Returns null if input is empty.
export function medianPrice(prices: number[]): number | null {
  const valid = prices.filter((p) => Number.isFinite(p)).sort((a, b) => a - b);
  if (valid.length === 0) return null;
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 === 1
    ? valid[mid]
    : (valid[mid - 1] + valid[mid]) / 2;
}
