import { NextRequest } from "next/server";
import { createClient } from "@/lib/db/client";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return Response.json({ error: "wallet query param required" }, { status: 400 });
  }
  const client = createClient();
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT s.id, s.estimated_savings_usd, s.recommended_price, s.baseline_price,
              s.created_at, st.name AS station_name, st.address AS station_address
         FROM savings_events s
         LEFT JOIN stations st ON st.id = s.station_id
         WHERE s.user_wallet = $1
         ORDER BY s.created_at DESC
         LIMIT 5`,
      [wallet],
    );
    return Response.json({
      events: rows.map((r) => ({
        id: r.id,
        estimatedSavingsUsd: Number(r.estimated_savings_usd),
        recommendedPrice: Number(r.recommended_price),
        baselinePrice: Number(r.baseline_price),
        stationName: r.station_name,
        stationAddress: r.station_address,
        createdAt:
          r.created_at instanceof Date
            ? r.created_at.toISOString()
            : r.created_at,
      })),
    });
  } finally {
    await client.end();
  }
}
