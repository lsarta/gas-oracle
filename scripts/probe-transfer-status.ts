import { GatewayClient } from "@circle-fin/x402-batching/client";
import { createClient } from "@vercel/postgres";

async function main() {
  const pk = process.env.ROUTING_AGENT_PRIVATE_KEY;
  if (!pk) throw new Error("ROUTING_AGENT_PRIVATE_KEY missing");
  const client = new GatewayClient({
    chain: "arcTestnet",
    privateKey: pk as `0x${string}`,
  });

  const db = createClient();
  await db.connect();
  try {
    const { rows } = await db.query(
      `SELECT payment_tx_id, caller_address, created_at
         FROM oracle_queries
        WHERE payment_tx_id IS NOT NULL
          AND created_at >= NOW() - INTERVAL '15 minutes'
        ORDER BY created_at DESC
        LIMIT 5`,
    );
    console.log(`Sampling ${rows.length} recent transfers:\n`);
    for (const r of rows) {
      const id = r.payment_tx_id as string;
      try {
        const t = (await client.getTransferById(id)) as Record<string, unknown>;
        console.log(`tx=${id.slice(0, 12)}...  status=${t.status}`);
        console.log(JSON.stringify(t, null, 2));
        console.log("---");
      } catch (e) {
        console.error(
          `tx=${id.slice(0, 12)}...  FETCH FAILED: ${e instanceof Error ? e.message : e}`,
        );
      }
    }
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
