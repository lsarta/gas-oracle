import { createClient } from "@vercel/postgres";
import { createPublicClient, http, parseAbiItem } from "viem";
import { arcTestnet } from "../src/lib/chains";

// Empirical settlement-latency measurement.
//
// What we know:
//   - Each query → facilitator.settle() returns immediately with a Circle
//     batch UUID, written to oracle_queries.payment_tx_id.
//   - Actual on-chain USDC moves later in batches from the Gateway contract
//     (0x0077777...) to our master wallet (0xd4D8F2...).
//
// What this script does:
//   - Fetch the last 24h of oracle_queries from Postgres.
//   - Fetch USDC Transfer events on Arc Testnet from the Gateway contract
//     to the master wallet over the same window.
//   - For each query, find the FIRST Transfer event whose block timestamp
//     is >= the query's created_at. That's the batch the query was in.
//   - Latency = transfer_block_time − query_created_at.
//   - Report median, p50/p90/p99, batch size distribution.

const USDC = "0x3600000000000000000000000000000000000000";
const GATEWAY = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";
const MASTER = "0xd4D8F2f8BdB323bc741AC2Eb6F6469506c38E808";

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

// Arc Testnet RPC limits eth_getLogs to a 10K block range.
// At ~1s blocks that's about 2.7 hours. Plenty for our purposes.
const BLOCK_LOOKBACK = 9_999n;

async function main() {
  const rpc = createPublicClient({ chain: arcTestnet, transport: http() });
  const head = await rpc.getBlockNumber();
  const fromBlock = head > BLOCK_LOOKBACK ? head - BLOCK_LOOKBACK : 0n;
  console.log(`Arc head: ${head}  fetching from block ${fromBlock} (~last few hours)`);

  // 1) Fetch ALL USDC Transfer events whose `to` is the master wallet over
  //    the window — we don't yet know what the `from` will be (might not
  //    be the Gateway contract directly).
  const logs = await rpc.getLogs({
    address: USDC as `0x${string}`,
    event: TRANSFER_EVENT,
    args: { to: MASTER as `0x${string}` },
    fromBlock,
    toBlock: head,
  });
  console.log(`Found ${logs.length} incoming USDC transfers to master`);
  if (logs.length > 0) {
    const fromCounts = new Map<string, number>();
    for (const l of logs) {
      const f = l.args.from!.toLowerCase();
      fromCounts.set(f, (fromCounts.get(f) ?? 0) + 1);
    }
    console.log("  by sender:");
    for (const [from, n] of fromCounts) console.log(`    ${from}: ${n}`);
  }

  // 2) Resolve block timestamps so we can compute time deltas.
  const uniqueBlocks = Array.from(new Set(logs.map((l) => l.blockNumber!)));
  const blockTimes = new Map<bigint, number>();
  console.log(`Fetching timestamps for ${uniqueBlocks.length} unique blocks…`);
  for (const bn of uniqueBlocks) {
    const b = await rpc.getBlock({ blockNumber: bn });
    blockTimes.set(bn, Number(b.timestamp));
  }
  type Settlement = {
    txHash: string;
    blockNumber: bigint;
    timestamp: number;
    valueUsdc: number;
  };
  const settlements: Settlement[] = logs
    .map((l) => ({
      txHash: l.transactionHash!,
      blockNumber: l.blockNumber!,
      timestamp: blockTimes.get(l.blockNumber!)!,
      valueUsdc: Number(l.args.value!) / 1_000_000,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (settlements.length === 0) {
    console.log("\nNo settlements found in the window. Either the lookback is too short");
    console.log("or no batches have hit on-chain yet.");
    return;
  }

  console.log(`\nSettlement window: ${new Date(settlements[0].timestamp * 1000).toISOString()} → ${new Date(settlements[settlements.length - 1].timestamp * 1000).toISOString()}`);
  const totalIn = settlements.reduce((s, x) => s + x.valueUsdc, 0);
  console.log(`Total USDC into master in window: $${totalIn.toFixed(6)} across ${settlements.length} settlements`);

  // 3) Pull oracle_queries from the same window.
  const c = createClient();
  await c.connect();
  try {
    const startTs = Math.min(...settlements.map((s) => s.timestamp));
    const startIso = new Date(startTs * 1000).toISOString();
    const { rows } = await c.query<{
      created_at: Date;
      amount_paid_usdc: string;
    }>(
      `SELECT created_at, amount_paid_usdc FROM oracle_queries
        WHERE created_at >= $1
        ORDER BY created_at ASC`,
      [startIso],
    );
    console.log(`\n${rows.length} oracle_queries in the same window\n`);

    // 4) Match each query to the first settlement whose timestamp >= query time.
    type Latency = { querySec: number; settlementSec: number; latencySec: number };
    const latencies: Latency[] = [];
    let unmatched = 0;
    for (const q of rows) {
      const qSec = Math.floor(new Date(q.created_at).getTime() / 1000);
      const match = settlements.find((s) => s.timestamp >= qSec);
      if (!match) {
        unmatched++;
        continue;
      }
      latencies.push({
        querySec: qSec,
        settlementSec: match.timestamp,
        latencySec: match.timestamp - qSec,
      });
    }
    console.log(`Matched ${latencies.length} queries to settlements (${unmatched} unmatched — likely too recent, batch hasn't fired yet)`);

    if (latencies.length === 0) return;

    // 5) Stats
    const sorted = latencies.map((l) => l.latencySec).sort((a, b) => a - b);
    const pct = (p: number) =>
      sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
    const median = pct(0.5);
    const mean = sorted.reduce((s, x) => s + x, 0) / sorted.length;
    console.log(`\nSettlement latency (query → on-chain):`);
    console.log(`  min:    ${sorted[0]}s`);
    console.log(`  p50:    ${pct(0.5)}s`);
    console.log(`  p90:    ${pct(0.9)}s`);
    console.log(`  p99:    ${pct(0.99)}s`);
    console.log(`  max:    ${sorted[sorted.length - 1]}s`);
    console.log(`  mean:   ${mean.toFixed(1)}s`);
    console.log(`  median: ${median}s`);

    // 6) Batch composition: how many queries per settlement
    const queriesPerBatch = new Map<bigint, number>();
    for (const l of latencies) {
      const batch = settlements.find((s) => s.timestamp === l.settlementSec)!.blockNumber;
      queriesPerBatch.set(batch, (queriesPerBatch.get(batch) ?? 0) + 1);
    }
    const sizes = Array.from(queriesPerBatch.values()).sort((a, b) => a - b);
    console.log(`\nBatch sizes (queries bundled per on-chain settlement):`);
    console.log(`  median: ${sizes[Math.floor(sizes.length / 2)]} queries`);
    console.log(`  range:  ${sizes[0]} – ${sizes[sizes.length - 1]} queries`);
    console.log(`  ${queriesPerBatch.size} batches observed`);

    // 7) Inter-batch interval
    const intervals: number[] = [];
    for (let i = 1; i < settlements.length; i++) {
      intervals.push(settlements[i].timestamp - settlements[i - 1].timestamp);
    }
    if (intervals.length > 0) {
      intervals.sort((a, b) => a - b);
      console.log(`\nInter-batch interval (time between successive settlements):`);
      console.log(`  median: ${intervals[Math.floor(intervals.length / 2)]}s`);
      console.log(`  range:  ${intervals[0]}s – ${intervals[intervals.length - 1]}s`);
    }
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
