export type ReportRow = {
  id: string;
  user_wallet: string;
  computed_price_per_gallon: number;
  created_at: Date;
};

export type Confidence = "high" | "medium" | "low";

export type ConsensusResult = {
  consensusPrice: number | null;
  reportCount: number;
  confidence: Confidence;
  windowMinutes: number;
};

const DEFAULT_WINDOW_MIN = 120;
const HALF_LIFE_MIN = 60;
const DOMINANCE_THRESHOLD = 0.7;
const TIGHT_SPREAD_PCT = 0.05;

export function computeConsensusPrice(
  reports: ReportRow[],
  options?: { windowMinutes?: number; minReports?: number; now?: Date },
): ConsensusResult {
  const windowMinutes = options?.windowMinutes ?? DEFAULT_WINDOW_MIN;
  const now = options?.now ?? new Date();

  const inWindow = reports.filter(
    (r) => (now.getTime() - r.created_at.getTime()) / 60_000 <= windowMinutes,
  );

  if (inWindow.length === 0) {
    return { consensusPrice: null, reportCount: 0, confidence: "low", windowMinutes };
  }

  if (inWindow.length === 1) {
    return {
      consensusPrice: round3(inWindow[0].computed_price_per_gallon),
      reportCount: 1,
      confidence: "low",
      windowMinutes,
    };
  }

  // Exponential decay: weight = exp(-ageMinutes / HALF_LIFE_MIN).
  type Weighted = { price: number; weight: number };
  const weighted: Weighted[] = inWindow.map((r) => {
    const ageMin = Math.max(0, (now.getTime() - r.created_at.getTime()) / 60_000);
    return {
      price: r.computed_price_per_gallon,
      weight: Math.exp(-ageMin / HALF_LIFE_MIN),
    };
  });
  const totalWeight = weighted.reduce((s, x) => s + x.weight, 0);
  const weightedAvg =
    weighted.reduce((s, x) => s + x.weight * x.price, 0) / totalWeight;

  const dominatingShare =
    Math.max(...weighted.map((w) => w.weight)) / totalWeight;

  const prices = inWindow.map((r) => r.computed_price_per_gallon);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const spreadPct = max > 0 ? (max - min) / max : 0;

  let confidence: Confidence;
  if (dominatingShare > DOMINANCE_THRESHOLD) {
    confidence = "low";
  } else if (inWindow.length >= 3 && spreadPct <= TIGHT_SPREAD_PCT) {
    confidence = "high";
  } else {
    confidence = "medium";
  }

  return {
    consensusPrice: round3(weightedAvg),
    reportCount: inWindow.length,
    confidence,
    windowMinutes,
  };
}

export function isOutlier(
  reportedPrice: number,
  consensus: ConsensusResult,
  options?: { thresholdPct?: number },
): boolean {
  const threshold = options?.thresholdPct ?? 0.15;
  if (consensus.consensusPrice === null) return false;
  const diff = Math.abs(reportedPrice - consensus.consensusPrice);
  return diff / consensus.consensusPrice > threshold;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
