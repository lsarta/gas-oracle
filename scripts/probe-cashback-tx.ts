import { createClient } from "@vercel/postgres";
import { createPublicClient, http } from "viem";
import { arcTestnet } from "../src/lib/chains";

async function main() {
  const c = createClient();
  await c.connect();
  try {
    const r = await c.query<{ payout_tx_hash: string; created_at: Date }>(
      `SELECT payout_tx_hash, created_at FROM reports
        WHERE payout_tx_hash IS NOT NULL
        ORDER BY created_at DESC LIMIT 3`,
    );
    if (r.rows.length === 0) {
      console.log("No cashback txs in DB.");
      return;
    }
    const rpc = createPublicClient({ chain: arcTestnet, transport: http() });
    const head = await rpc.getBlockNumber();
    console.log(`Arc head: ${head}`);
    for (const row of r.rows) {
      const hash = row.payout_tx_hash as `0x${string}`;
      console.log(`\nCashback tx ${hash}`);
      console.log(`  recorded in DB at: ${row.created_at.toISOString()}`);
      try {
        const tx = await rpc.getTransaction({ hash });
        const receipt = await rpc.getTransactionReceipt({ hash });
        const block = await rpc.getBlock({ blockNumber: receipt.blockNumber });
        const txDate = new Date(Number(block.timestamp) * 1000);
        const ageBlocks = Number(head - receipt.blockNumber);
        console.log(`  on-chain status: ${receipt.status}`);
        console.log(`  block: ${receipt.blockNumber}  (${ageBlocks} blocks old)`);
        console.log(`  block time: ${txDate.toISOString()}`);
        console.log(`  ⇒ Arc block time = ~${(ageBlocks > 0 ? (Date.now() - txDate.getTime()) / 1000 / ageBlocks : 0).toFixed(2)}s/block`);
        console.log(`  to-contract: ${tx.to}  (USDC = 0x3600...)`);
      } catch (err) {
        console.log(`  ✗ tx not found via RPC: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
