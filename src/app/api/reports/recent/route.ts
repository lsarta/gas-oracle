import { createClient } from "@/lib/db/client";

export async function GET() {
  const client = createClient();
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT r.id, r.user_wallet, r.transaction_amount_usd, r.gallons,
              r.computed_price_per_gallon, r.payout_amount_usdc, r.payout_tx_hash,
              r.created_at, s.name AS station_name
         FROM reports r
         JOIN stations s ON s.id = r.station_id
         ORDER BY r.created_at DESC
         LIMIT 10`,
    );
    const reports = rows.map((r) => ({
      id: r.id as string,
      stationName: r.station_name as string,
      userWallet: r.user_wallet as string,
      transactionAmountUsd: Number(r.transaction_amount_usd),
      gallons: r.gallons === null ? null : Number(r.gallons),
      pricePerGallon:
        r.computed_price_per_gallon === null ? null : Number(r.computed_price_per_gallon),
      payoutAmountUsdc:
        r.payout_amount_usdc === null ? null : Number(r.payout_amount_usdc),
      payoutTxHash: r.payout_tx_hash as string | null,
      createdAt: (r.created_at as Date).toISOString(),
    }));
    return Response.json({ reports });
  } finally {
    await client.end();
  }
}
