import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/db/client";

const Body = z.object({
  userWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  stationId: z.string().uuid(),
  recommendedPrice: z.number().positive(),
  baselinePrice: z.number().positive(),
  netSavingsUsd: z.number(),
  detourMinutes: z.number().min(0),
  detourMiles: z.number().min(0),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const {
    userWallet,
    stationId,
    recommendedPrice,
    baselinePrice,
    netSavingsUsd,
    detourMinutes,
    detourMiles,
  } = parsed.data;

  // Floor at 0 — we never record negative savings against a user's lifetime.
  const recordedSavings = Math.max(0, Math.round(netSavingsUsd * 100) / 100);

  const client = createClient();
  await client.connect();
  try {
    const ins = await client.query<{ id: string }>(
      `INSERT INTO savings_events
         (user_wallet, station_id, estimated_savings_usd, net_savings_usd,
          detour_minutes, detour_miles,
          recommended_price, baseline_price, gallons_assumed, source)
       VALUES ($1, $2, $3, $3, $4, $5, $6, $7, 12, 'opportunity_taken')
       RETURNING id`,
      [
        userWallet,
        stationId,
        recordedSavings,
        Math.round(detourMinutes * 10) / 10,
        Math.round(detourMiles * 100) / 100,
        recommendedPrice,
        baselinePrice,
      ],
    );

    const upd = await client.query<{ total_saved_usd: string }>(
      `UPDATE users
         SET total_saved_usd = COALESCE(total_saved_usd, 0) + $1
       WHERE wallet_address = $2
       RETURNING total_saved_usd`,
      [recordedSavings, userWallet],
    );

    return Response.json({
      savingsId: ins.rows[0].id,
      netSavings: recordedSavings,
      lifetimeTotal: upd.rows[0] ? Number(upd.rows[0].total_saved_usd) : null,
    });
  } finally {
    await client.end();
  }
}
