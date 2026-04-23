import { createClient } from "@vercel/postgres";

async function main() {
  const client = createClient();
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT created_at, caller_address, query_params, amount_paid_usdc, payment_tx_id
         FROM oracle_queries ORDER BY created_at DESC LIMIT 20`,
    );
    if (rows.length === 0) {
      console.log("(no oracle queries yet)");
      return;
    }
    console.log(`${rows.length} oracle quer(y/ies):`);
    for (const r of rows) {
      console.log(
        `  · ${r.created_at.toISOString()}  caller=${r.caller_address}  paid=${r.amount_paid_usdc}  tx=${r.payment_tx_id ?? "—"}  params=${JSON.stringify(r.query_params)}`,
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
