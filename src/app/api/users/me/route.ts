import { NextRequest } from "next/server";
import { createClient } from "@/lib/db/client";

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return Response.json({ error: "wallet query param required (0x address)" }, { status: 400 });
  }

  const client = createClient();
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, privy_user_id, email, wallet_address,
              total_earned_usdc, total_saved_usd, home_lat, home_lng, created_at
         FROM users WHERE wallet_address = $1`,
      [wallet],
    );
    if (rows.length === 0) {
      return Response.json({ user: null });
    }
    const r = rows[0];

    const reportsCountRes = await client.query(
      `SELECT COUNT(*)::int AS n FROM reports WHERE user_wallet = $1`,
      [wallet],
    );

    return Response.json({
      user: {
        id: r.id,
        privyUserId: r.privy_user_id,
        email: r.email,
        walletAddress: r.wallet_address,
        totalEarnedUsdc: Number(r.total_earned_usdc),
        totalSavedUsd: Number(r.total_saved_usd),
        homeLat: r.home_lat === null ? null : Number(r.home_lat),
        homeLng: r.home_lng === null ? null : Number(r.home_lng),
        createdAt: (r.created_at as Date).toISOString(),
        reportsCount: reportsCountRes.rows[0].n as number,
      },
    });
  } finally {
    await client.end();
  }
}
