export type StationBountyInput = {
  last_priced_at: Date | null;
  consensus_confidence: string | null;
  consensus_report_count: number;
};

const HIGH_BOUNTY = 0.5;
const MED_BOUNTY = 0.25;
const STAKE_THRESHOLD = 0.2;
const STAKE_RATIO = 0.2;
const CONFIRM_TOLERANCE = 0.05;

export function computeBountyAmount(s: StationBountyInput): number {
  const now = Date.now();
  const lastMs = s.last_priced_at ? s.last_priced_at.getTime() : null;
  const ageHours = lastMs === null ? Infinity : (now - lastMs) / (1000 * 60 * 60);

  if (ageHours > 12) return HIGH_BOUNTY;
  if (
    ageHours > 6 &&
    (s.consensus_confidence === "low" || s.consensus_confidence === null)
  ) {
    return MED_BOUNTY;
  }
  return 0;
}

export function shouldRequireStake(bounty: number): boolean {
  return bounty >= STAKE_THRESHOLD;
}

export function stakeAmountFor(bounty: number): number {
  return Math.round(bounty * STAKE_RATIO * 1_000_000) / 1_000_000;
}

/** Mini-consensus check used by the resolver: is the staked report's price
 *  within CONFIRM_TOLERANCE of the average of the most-recent-N prices? */
export function isWithinTolerance(
  reportedPrice: number,
  consensusPrice: number,
  tolerance: number = CONFIRM_TOLERANCE,
): boolean {
  if (consensusPrice <= 0) return false;
  return Math.abs(reportedPrice - consensusPrice) / consensusPrice <= tolerance;
}
