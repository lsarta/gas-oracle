import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/db/client";
import { estimateSavings } from "@/lib/oracle/savings";

const Body = z.object({
  userWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  stationId: z.string().uuid(),
  recommendedPrice: z.number().positive(),
  baselinePrice: z.number().positive(),
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
  const { userWallet, stationId, recommendedPrice, baselinePrice } = parsed.data;

  const estimatedSavings = estimateSavings({
    recommendedPrice,
    baselinePrice,
    gallonsAssumed: 12,
  });

  const client = createClient();
  await client.connect();
  try {
    const ins = await client.query<{ id: string }>(
      `INSERT INTO savings_events
         (user_wallet, station_id, estimated_savings_usd, recommended_price, baseline_price, gallons_assumed, source)
       VALUES ($1, $2, $3, $4, $5, $6, 'opportunity_taken')
       RETURNING id`,
      [userWallet, stationId, estimatedSavings, recommendedPrice, baselinePrice, 12],
    );

    const upd = await client.query<{ total_saved_usd: string }>(
      `UPDATE users
         SET total_saved_usd = COALESCE(total_saved_usd, 0) + $1
       WHERE wallet_address = $2
       RETURNING total_saved_usd`,
      [estimatedSavings, userWallet],
    );

    const lifetimeTotal = upd.rows[0]
      ? Number(upd.rows[0].total_saved_usd)
      : null;

    return Response.json({
      savingsId: ins.rows[0].id,
      estimatedSavings,
      lifetimeTotal,
    });
  } finally {
    await client.end();
  }
}
