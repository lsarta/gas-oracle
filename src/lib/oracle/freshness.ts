export function freshnessLabel(lastPricedAt: Date | null): string {
  if (lastPricedAt === null) return "no data";
  const ageMs = Date.now() - lastPricedAt.getTime();
  if (ageMs < 60_000) return "just now";
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
