import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/db/client";
import {
  computeFreshnessPayout,
  computeImpliedPrice,
} from "@/lib/oracle/pricing";
import { sendUsdcToUser } from "@/lib/circle/payout";

const BodySchema = z.object({
  stationId: z.string().uuid(),
  userWallet: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "userWallet must be a 0x-prefixed 20-byte address"),
  transactionAmountUsd: z.number().positive(),
  gallons: z.number().positive(),
});

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

    const payoutAmount = computeFreshnessPayout(station.last_priced_at);

    const insertRes = await client.query(
      `INSERT INTO reports (
         station_id, user_wallet, transaction_amount_usd, gallons,
         computed_price_per_gallon, payout_amount_usdc
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [stationId, userWallet, transactionAmountUsd, gallons, impliedPrice, payoutAmount],
    );
    const reportId = insertRes.rows[0].id as string;

    await client.query(
      `UPDATE stations
         SET current_price_per_gallon = $1, last_priced_at = now()
       WHERE id = $2`,
      [impliedPrice, stationId],
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
