import { createClient } from "@vercel/postgres";

async function main() {
  const client = createClient();
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, privy_user_id, email, wallet_address, total_earned_usdc, total_saved_usd, created_at
         FROM users ORDER BY created_at DESC LIMIT 20`,
    );
    if (rows.length === 0) {
      console.log("(no users yet)");
      return;
    }
    console.log(`${rows.length} user(s):`);
    for (const r of rows) {
      console.log(
        `  · ${r.created_at.toISOString()}  privy=${r.privy_user_id}  email=${r.email ?? "—"}  wallet=${r.wallet_address}  earned=${r.total_earned_usdc} saved=${r.total_saved_usd}`,
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
