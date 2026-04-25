import { createClient } from "@/lib/db/client";

export type ActivityKind = "agent_query" | "cashback" | "stake_resolution";

type ActivityRow = {
  id: string;
  kind: ActivityKind;
  description: string;
  amountUsdc: number;
  txHash: string | null;
  createdAt: string;
};

export async function GET() {
  const client = createClient();
  await client.connect();
  try {
    // Pull last ~40 from each source, interleave by timestamp, take top 20.
    const [oq, rep, stk] = await Promise.all([
      client.query<{
        id: string;
        caller_address: string;
        amount_paid_usdc: string;
        payment_tx_id: string | null;
        created_at: Date;
        query_params: Record<string, unknown>;
      }>(
        `SELECT id, caller_address, amount_paid_usdc, payment_tx_id, created_at, query_params
           FROM oracle_queries ORDER BY created_at DESC LIMIT 40`,
      ),
      client.query<{
        id: string;
        user_wallet: string;
        payout_amount_usdc: string;
        payout_tx_hash: string | null;
        created_at: Date;
        station_name: string | null;
      }>(
        `SELECT r.id, r.user_wallet, r.payout_amount_usdc, r.payout_tx_hash,
                r.created_at, s.name AS station_name
           FROM reports r LEFT JOIN stations s ON s.id = r.station_id
           WHERE r.payout_tx_hash IS NOT NULL
           ORDER BY r.created_at DESC LIMIT 40`,
      ),
      client.query<{
        id: string;
        status: string;
        stake_amount_usdc: string;
        bounty_amount_usdc: string;
        resolved_at: Date;
        user_wallet: string;
      }>(
        `SELECT id, status, stake_amount_usdc, bounty_amount_usdc, resolved_at, user_wallet
           FROM stakes
           WHERE status IN ('confirmed', 'slashed')
             AND resolved_at IS NOT NULL
           ORDER BY resolved_at DESC LIMIT 40`,
      ),
    ]);

    const all: ActivityRow[] = [];

    for (const r of oq.rows) {
      const vertical =
        ((r.query_params as { vertical?: string })?.vertical as string) ?? "gas";
      all.push({
        id: `oq-${r.id}`,
        kind: "agent_query",
        description: `Agent paid for ${vertical} oracle query`,
        amountUsdc: Number(r.amount_paid_usdc),
        txHash: r.payment_tx_id,
        createdAt: r.created_at.toISOString(),
      });
    }
    for (const r of rep.rows) {
      all.push({
        id: `rep-${r.id}`,
        kind: "cashback",
        description: `Cashback to reporter at ${r.station_name ?? "station"}`,
        amountUsdc: Number(r.payout_amount_usdc),
        txHash: r.payout_tx_hash,
        createdAt: r.created_at.toISOString(),
      });
    }
    for (const r of stk.rows) {
      const amount =
        r.status === "confirmed"
          ? Number(r.stake_amount_usdc) + Number(r.bounty_amount_usdc)
          : Number(r.stake_amount_usdc);
      all.push({
        id: `stk-${r.id}`,
        kind: "stake_resolution",
        description:
          r.status === "confirmed"
            ? "Stake confirmed (returned to reporter)"
            : "Stake slashed",
        amountUsdc: amount,
        txHash: null,
        createdAt: r.resolved_at.toISOString(),
      });
    }

    all.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return Response.json({ activity: all.slice(0, 20) });
  } finally {
    await client.end();
  }
}
