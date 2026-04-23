const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export function computeFreshnessPayout(
  lastPricedAt: Date | null,
  options?: { volumeMultiplier?: number },
): number {
  const multiplier = options?.volumeMultiplier ?? 1;
  const now = Date.now();
  const ageMs =
    lastPricedAt === null ? Number.POSITIVE_INFINITY : now - lastPricedAt.getTime();

  let base: number;
  if (ageMs > 24 * HOUR_MS) base = 0.5;
  else if (ageMs > 12 * HOUR_MS) base = 0.3;
  else if (ageMs > 6 * HOUR_MS) base = 0.15;
  else if (ageMs > 1 * HOUR_MS) base = 0.05;
  else if (ageMs > 15 * MINUTE_MS) base = 0.02;
  else base = 0.005;

  return Math.round(base * multiplier * 1_000_000) / 1_000_000;
}

export function computeImpliedPrice(
  transactionAmountUsd: number,
  gallons: number,
): number {
  if (!(gallons > 0) || gallons > 50) {
    throw new Error(`Invalid gallons: ${gallons} (must be > 0 and <= 50)`);
  }
  const price = transactionAmountUsd / gallons;
  if (price < 1 || price > 20) {
    throw new Error(
      `Implied price $${price.toFixed(3)}/gal is outside sanity range ($1–$20)`,
    );
  }
  return Math.round(price * 1000) / 1000;
}
