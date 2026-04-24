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
      `SELECT s.id, s.status, s.stake_amount_usdc, s.bounty_amount_usdc,
              s.resolved_at, s.resolution_reason, s.created_at,
              st.id AS station_id, st.name AS station_name
         FROM stakes s
         JOIN reports r ON r.id = s.report_id
         JOIN stations st ON st.id = r.station_id
         WHERE s.user_wallet = $1
         ORDER BY s.created_at DESC
         LIMIT 10`,
      [wallet],
    );
    return Response.json({
      stakes: rows.map((r) => ({
        id: r.id,
        status: r.status,
        stakeAmountUsdc: Number(r.stake_amount_usdc),
        bountyAmountUsdc: Number(r.bounty_amount_usdc),
        stationId: r.station_id,
        stationName: r.station_name,
        createdAt:
          r.created_at instanceof Date
            ? r.created_at.toISOString()
            : r.created_at,
        resolvedAt:
          r.resolved_at instanceof Date
            ? r.resolved_at.toISOString()
            : r.resolved_at,
        resolutionReason: r.resolution_reason,
      })),
    });
  } finally {
    await client.end();
  }
}
