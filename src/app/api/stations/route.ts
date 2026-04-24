import { createClient } from "@/lib/db/client";
import { freshnessLabel } from "@/lib/oracle/freshness";
import {
  computeBountyAmount,
  shouldRequireStake,
  stakeAmountFor,
} from "@/lib/oracle/stakes";

export async function GET() {
  const client = createClient();
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, name, address, lat, lng, current_price_per_gallon, last_priced_at,
              consensus_confidence, consensus_report_count
         FROM stations
         ORDER BY current_price_per_gallon ASC NULLS LAST, name ASC`,
    );
    const stations = rows.map((r) => {
      const lastPricedAt: Date | null = r.last_priced_at;
      const activeBounty = computeBountyAmount({
        last_priced_at: lastPricedAt,
        consensus_confidence: r.consensus_confidence ?? null,
        consensus_report_count: Number(r.consensus_report_count ?? 0),
      });
      const requiresStake = shouldRequireStake(activeBounty);
      return {
        id: r.id as string,
        name: r.name as string,
        address: r.address as string,
        lat: Number(r.lat),
        lng: Number(r.lng),
        currentPricePerGallon:
          r.current_price_per_gallon === null ? null : Number(r.current_price_per_gallon),
        lastPricedAt: lastPricedAt ? lastPricedAt.toISOString() : null,
        freshness: freshnessLabel(lastPricedAt),
        consensusConfidence: (r.consensus_confidence ?? null) as
          | "high"
          | "medium"
          | "low"
          | null,
        consensusReportCount: Number(r.consensus_report_count ?? 0),
        activeBounty,
        requiresStake,
        stakeAmount: requiresStake ? stakeAmountFor(activeBounty) : 0,
      };
    });
    return Response.json({ stations });
  } finally {
    await client.end();
  }
}
