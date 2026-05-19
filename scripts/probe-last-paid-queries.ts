import { createClient } from "@vercel/postgres";

async function main() {
  const c = createClient();
  await c.connect();
  try {
    const r = await c.query(
      `SELECT created_at,
              query_params->>'vertical' AS vertical,
              amount_paid_usdc,
              payment_tx_id,
              caller_address
         FROM oracle_queries
        WHERE payment_tx_id IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 15`,
    );
    console.log(`${r.rows.length} most recent paid queries:\n`);
    for (const x of r.rows) {
      console.log(
        `  ${x.created_at.toISOString()}  ${x.vertical ?? "?"}  $${x.amount_paid_usdc}  ${x.caller_address?.slice(0, 10)}…  tx=${x.payment_tx_id?.slice(0, 12)}…`,
      );
    }
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
