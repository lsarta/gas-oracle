import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/db/client";
import {
  computeFreshnessPayout,
  computeImpliedPrice,
} from "@/lib/oracle/pricing";
import {
  computeConsensusPrice,
  isOutlier,
  type ReportRow,
} from "@/lib/oracle/consensus";
import { sendUsdcToUser } from "@/lib/circle/payout";

const BodySchema = z.object({
  stationId: z.string().uuid(),
  userWallet: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "userWallet must be a 0x-prefixed 20-byte address"),
  transactionAmountUsd: z.number().positive(),
  gallons: z.number().positive(),
});

const OUTLIER_PAYOUT_FRACTION = 0.5;
const REPORT_FETCH_LIMIT = 30;

async function fetchRecentReports(
  client: ReturnType<typeof createClient>,
  stationId: string,
): Promise<ReportRow[]> {
  const { rows } = await client.query<{
    id: string;
    user_wallet: string;
    computed_price_per_gallon: string | number;
    created_at: Date | string;
  }>(
    `SELECT id, user_wallet, computed_price_per_gallon, created_at
       FROM reports
      WHERE station_id = $1 AND computed_price_per_gallon IS NOT NULL
      ORDER BY created_at DESC
      LIMIT ${REPORT_FETCH_LIMIT}`,
    [stationId],
  );
  return rows.map((r) => ({
    id: r.id,
    user_wallet: r.user_wallet,
    computed_price_per_gallon: Number(r.computed_price_per_gallon),
    created_at: r.created_at instanceof Date ? r.created_at : new Date(r.created_at),
  }));
}

export async function POST(request: NextRequest) {
  let parsed;
  try {
    parsed = BodySchema.parse(await request.json());
  } catch (err) {
    return Response.json(
      { error: "Invalid request body", detail: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  const { stationId, userWallet, transactionAmountUsd, gallons } = parsed;

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
    const stationRes = await client.query(
      `SELECT id, name, last_priced_at FROM stations WHERE id = $1`,
      [stationId],
    );
    if (stationRes.rows.length === 0) {
      return Response.json({ error: "Station not found" }, { status: 404 });
    }
    const station = stationRes.rows[0] as {
      id: string;
      name: string;
      last_priced_at: Date | null;
    };

    // ---- Consensus BEFORE this report is counted.
    const priorReports = await fetchRecentReports(client, stationId);
    const priorConsensus = computeConsensusPrice(priorReports);

    // Outlier only meaningful when we have enough signal — require high-confidence
    // consensus before flagging. Otherwise the first disagreement gets penalized.
    const wasOutlier =
      priorConsensus.confidence === "high" &&
      isOutlier(impliedPrice, priorConsensus);

    const freshnessPayout = computeFreshnessPayout(station.last_priced_at);
    const payoutAmount = wasOutlier
      ? Math.round(freshnessPayout * OUTLIER_PAYOUT_FRACTION * 1_000_000) /
        1_000_000
      : freshnessPayout;

    const insertRes = await client.query(
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
    const reportId = insertRes.rows[0].id as string;

    // ---- Consensus AFTER including the new report.
    const postReports = await fetchRecentReports(client, stationId);
    const newConsensus = computeConsensusPrice(postReports);
    const newStationPrice = newConsensus.consensusPrice ?? impliedPrice;

    await client.query(
      `UPDATE stations
         SET current_price_per_gallon = $1,
             last_priced_at = now(),
             consensus_confidence = $2,
             consensus_report_count = $3
       WHERE id = $4`,
      [newStationPrice, newConsensus.confidence, newConsensus.reportCount, stationId],
    );

    let txHash: string | null = null;
    let blockNumber: string | null = null;
    let payoutError: string | null = null;
    try {
      const result = await sendUsdcToUser(userWallet as `0x${string}`, payoutAmount);
      txHash = result.txHash;
      blockNumber = result.blockNumber.toString();

      await client.query(
        `UPDATE reports SET payout_tx_hash = $1 WHERE id = $2`,
        [txHash, reportId],
      );
      await client.query(
        `UPDATE users SET total_earned_usdc = total_earned_usdc + $1 WHERE wallet_address = $2`,
        [payoutAmount, userWallet],
      );
    } catch (err) {
      payoutError = err instanceof Error ? err.message : String(err);
    }

    if (payoutError) {
      return Response.json(
        {
          reportId,
          impliedPrice,
          payoutAmountUsdc: payoutAmount,
          payoutTxHash: null,
          blockNumber: null,
          stationName: station.name,
          wasOutlier,
          consensusPrice: priorConsensus.consensusPrice,
          consensusConfidence: newConsensus.confidence,
          newStationPrice,
          warning: "Report saved, but cashback transfer failed. Engineering will reconcile.",
          error: payoutError,
        },
        { status: 502 },
      );
    }

    return Response.json({
      reportId,
      impliedPrice,
      payoutAmountUsdc: payoutAmount,
      payoutTxHash: txHash,
      blockNumber,
      stationName: station.name,
      wasOutlier,
      consensusPrice: priorConsensus.consensusPrice,
      consensusConfidence: newConsensus.confidence,
      newStationPrice,
    });
  } catch (err) {
    return Response.json(
      { error: "Internal error", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  } finally {
    await client.end();
  }
}
