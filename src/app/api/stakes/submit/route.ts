import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/db/client";
import { computeImpliedPrice, computeFreshnessPayout } from "@/lib/oracle/pricing";
import {
  computeBountyAmount,
  shouldRequireStake,
  stakeAmountFor,
} from "@/lib/oracle/stakes";
import {
  computeConsensusPrice,
  isOutlier,
  type ReportRow,
} from "@/lib/oracle/consensus";

const BodySchema = z.object({
  stationId: z.string().uuid(),
  userWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  transactionAmountUsd: z.number().positive(),
  gallons: z.number().positive(),
  stakeAmount: z.number().positive(),
});

/**
 * Demo-scope note on custody:
 * A full implementation pulls USDC from the user's Privy embedded wallet
 * into the master wallet's escrow via a server-initiated signed transfer
 * (Privy admin API + PRIVY_APP_SECRET). That transfer is out-of-scope for
 * this hackathon build — we record the staker's intent in the `stakes`
 * row (status='pending') and treat the stake as logically escrowed. The
 * resolution path DOES move real USDC on confirm (master → user covers
 * stake + bounty via sendUsdcToUser). Slashes keep the stake "notionally"
 * with the protocol.
 */
export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { stationId, userWallet, transactionAmountUsd, gallons, stakeAmount } =
    parsed.data;

  let impliedPrice: number;
  try {
    impliedPrice = computeImpliedPrice(transactionAmountUsd, gallons);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  const client = createClient();
  await client.connect();
  try {
    const stationRes = await client.query<{
      id: string;
      name: string;
      last_priced_at: Date | null;
      consensus_confidence: string | null;
      consensus_report_count: number;
    }>(
      `SELECT id, name, last_priced_at, consensus_confidence, consensus_report_count
         FROM stations WHERE id = $1`,
      [stationId],
    );
    if (stationRes.rows.length === 0) {
      return Response.json({ error: "Station not found" }, { status: 404 });
    }
    const station = stationRes.rows[0];

    const bounty = computeBountyAmount({
      last_priced_at: station.last_priced_at,
      consensus_confidence: station.consensus_confidence,
      consensus_report_count: Number(station.consensus_report_count ?? 0),
    });
    if (!shouldRequireStake(bounty)) {
      return Response.json(
        {
          error: "Station does not require a stake",
          detail: "Use POST /api/reports for non-staked reports.",
        },
        { status: 400 },
      );
    }
    const expectedStake = stakeAmountFor(bounty);
    // 1e-6 tolerance for numeric(10,6) round-trip.
    if (Math.abs(stakeAmount - expectedStake) > 1e-6) {
      return Response.json(
        {
          error: "Stake amount mismatch",
          expected: expectedStake,
          received: stakeAmount,
        },
        { status: 400 },
      );
    }

    // Consensus context for the staked report's outlier flag.
    const priorReportsRes = await client.query<{
      id: string;
      user_wallet: string;
      computed_price_per_gallon: string;
      created_at: Date;
    }>(
      `SELECT id, user_wallet, computed_price_per_gallon, created_at
         FROM reports
        WHERE station_id = $1 AND computed_price_per_gallon IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 30`,
      [stationId],
    );
    const priorReports: ReportRow[] = priorReportsRes.rows.map((r) => ({
      id: r.id,
      user_wallet: r.user_wallet,
      computed_price_per_gallon: Number(r.computed_price_per_gallon),
      created_at: r.created_at instanceof Date ? r.created_at : new Date(r.created_at),
    }));
    const priorConsensus = computeConsensusPrice(priorReports);
    const wasOutlier =
      priorConsensus.confidence === "high" &&
      isOutlier(impliedPrice, priorConsensus);

    // The normal freshness cashback still fires for staked reports (halved
    // if outlier). Separately, the stake + bounty resolve later.
    const freshnessPayout = computeFreshnessPayout(station.last_priced_at);
    const payoutAmount = wasOutlier
      ? Math.round(freshnessPayout * 0.5 * 1_000_000) / 1_000_000
      : freshnessPayout;

    const reportIns = await client.query<{ id: string }>(
      `INSERT INTO reports (
         station_id, user_wallet, transaction_amount_usd, gallons,
         computed_price_per_gallon, payout_amount_usdc,
         consensus_at_report, was_outlier
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        stationId,
        userWallet,
        transactionAmountUsd,
        gallons,
        impliedPrice,
        payoutAmount,
        priorConsensus.consensusPrice,
        wasOutlier,
      ],
    );
    const reportId = reportIns.rows[0].id;

    const stakeIns = await client.query<{ id: string }>(
      `INSERT INTO stakes (report_id, user_wallet, stake_amount_usdc,
                           bounty_amount_usdc, status)
         VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id`,
      [reportId, userWallet, stakeAmount, bounty],
    );

    return Response.json({
      reportId,
      stakeId: stakeIns.rows[0].id,
      stakeAmount,
      bountyAmount: bounty,
      wasOutlier,
      message:
        "Stake recorded. Resolution after 2 more reports on this station.",
    });
  } finally {
    await client.end();
  }
}
