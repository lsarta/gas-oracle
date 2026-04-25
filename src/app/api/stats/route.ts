import { createClient } from "@/lib/db/client";
import { privateKeyToAccount } from "viem/accounts";

type Stats = {
  totalTxLast24h: number;
  oracleQueriesLast24h: number;
  cashbackTxLast24h: number;
  stakeResolutionsTx24h: number;
  totalUsdcVolume24h: number;
  totalUsdcVolumeAllTime: number;
  agentQueryRatePerMinute: number;
  uniqueWalletsLast24h: number;
  masterWallet: string | null;
};

function masterWallet(): string | null {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) return null;
  try {
    return privateKeyToAccount(pk as `0x${string}`).address;
  } catch {
    return null;
  }
}

const CACHE_TTL_MS = 3000;
let cached: { payload: Stats; expiresAt: number } | null = null;

function zero(): Stats {
  return {
    totalTxLast24h: 0,
    oracleQueriesLast24h: 0,
    cashbackTxLast24h: 0,
    stakeResolutionsTx24h: 0,
    totalUsdcVolume24h: 0,
    totalUsdcVolumeAllTime: 0,
    agentQueryRatePerMinute: 0,
    uniqueWalletsLast24h: 0,
    masterWallet: masterWallet(),
  };
}

async function compute(): Promise<Stats> {
  const client = createClient();
  await client.connect();
  try {
    // Run all aggregates in parallel.
    const [
      oqCount,
      cashbackCount,
      stakesResolved,
      oqVol24h,
      reportsVol24h,
      oqVolAll,
      reportsVolAll,
      oqRate5m,
      walletsCount,
    ] = await Promise.all([
      client.query<{ n: string }>(
        `SELECT COUNT(*) AS n FROM oracle_queries WHERE created_at > now() - interval '24 hours'`,
      ),
      client.query<{ n: string }>(
        `SELECT COUNT(*) AS n FROM reports
           WHERE payout_tx_hash IS NOT NULL
             AND created_at > now() - interval '24 hours'`,
      ),
      client.query<{ n: string }>(
        `SELECT COUNT(*) AS n FROM stakes
           WHERE status IN ('confirmed','slashed')
             AND resolved_at > now() - interval '24 hours'`,
      ),
      client.query<{ s: string | null }>(
        `SELECT COALESCE(SUM(amount_paid_usdc), 0) AS s FROM oracle_queries
           WHERE created_at > now() - interval '24 hours'`,
      ),
      client.query<{ s: string | null }>(
        `SELECT COALESCE(SUM(payout_amount_usdc), 0) AS s FROM reports
           WHERE created_at > now() - interval '24 hours'`,
      ),
      client.query<{ s: string | null }>(
        `SELECT COALESCE(SUM(amount_paid_usdc), 0) AS s FROM oracle_queries`,
      ),
      client.query<{ s: string | null }>(
        `SELECT COALESCE(SUM(payout_amount_usdc), 0) AS s FROM reports`,
      ),
      client.query<{ n: string }>(
        `SELECT COUNT(*) AS n FROM oracle_queries
           WHERE created_at > now() - interval '5 minutes'`,
      ),
      client.query<{ n: string }>(
        `SELECT COUNT(DISTINCT wallet) AS n FROM (
           SELECT user_wallet AS wallet FROM reports WHERE created_at > now() - interval '24 hours'
           UNION
           SELECT caller_address AS wallet FROM oracle_queries WHERE created_at > now() - interval '24 hours'
         ) u`,
      ),
    ]);

    const oracleQueriesLast24h = Number(oqCount.rows[0].n);
    const cashbackTxLast24h = Number(cashbackCount.rows[0].n);
    const stakeResolutionsTx24h = Number(stakesResolved.rows[0].n);
    const totalUsdcVolume24h =
      Number(oqVol24h.rows[0].s ?? 0) + Number(reportsVol24h.rows[0].s ?? 0);
    const totalUsdcVolumeAllTime =
      Number(oqVolAll.rows[0].s ?? 0) + Number(reportsVolAll.rows[0].s ?? 0);
    const agentQueryRatePerMinute = Number(oqRate5m.rows[0].n) / 5;
    const uniqueWalletsLast24h = Number(walletsCount.rows[0].n);

    return {
      totalTxLast24h:
        oracleQueriesLast24h + cashbackTxLast24h + stakeResolutionsTx24h,
      oracleQueriesLast24h,
      cashbackTxLast24h,
      stakeResolutionsTx24h,
      totalUsdcVolume24h: Math.round(totalUsdcVolume24h * 1_000_000) / 1_000_000,
      totalUsdcVolumeAllTime:
        Math.round(totalUsdcVolumeAllTime * 1_000_000) / 1_000_000,
      agentQueryRatePerMinute:
        Math.round(agentQueryRatePerMinute * 100) / 100,
      uniqueWalletsLast24h,
      masterWallet: masterWallet(),
    };
  } finally {
    await client.end();
  }
}

export async function GET() {
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return Response.json(cached.payload);
  }
  try {
    const payload = await compute();
    cached = { payload, expiresAt: now + CACHE_TTL_MS };
    return Response.json(payload);
  } catch (err) {
    console.error("[stats] compute failed:", err);
    return Response.json(zero());
  }
}
