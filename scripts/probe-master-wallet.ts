import { createPublicClient, http, parseAbi, parseAbiItem } from "viem";
import { arcTestnet } from "../src/lib/chains";

const USDC = "0x3600000000000000000000000000000000000000";
const MASTER = "0xd4D8F2f8BdB323bc741AC2Eb6F6469506c38E808";
const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

async function main() {
  const rpc = createPublicClient({ chain: arcTestnet, transport: http() });
  const head = await rpc.getBlockNumber();
  console.log(`Arc head: ${head}`);

  // 1) Current USDC balance
  const bal = await rpc.readContract({
    address: USDC as `0x${string}`,
    abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
    functionName: "balanceOf",
    args: [MASTER as `0x${string}`],
  });
  console.log(`Master USDC balance: ${(Number(bal) / 1_000_000).toFixed(6)} USDC`);

  // 1.5) OUTGOING from master (cashback to users) — these go on-chain via
  //      our own viem writeContract, so they SHOULD show as Transfer events.
  console.log(`\nLast 10K blocks of OUTGOING USDC from master:`);
  const outLogs = await rpc.getLogs({
    address: USDC as `0x${string}`,
    event: TRANSFER_EVENT,
    args: { from: MASTER as `0x${string}` },
    fromBlock: head - 9_999n,
    toBlock: head,
  });
  console.log(`  ${outLogs.length} outgoing transfers`);
  for (const l of outLogs.slice(0, 5)) {
    const block = await rpc.getBlock({ blockNumber: l.blockNumber! });
    console.log(
      `    blk=${l.blockNumber}  ts=${new Date(Number(block.timestamp) * 1000).toISOString()}  to=${l.args.to}  amt=${(Number(l.args.value!) / 1_000_000).toFixed(6)}  tx=${l.transactionHash}`,
    );
  }

  // 2) Walk backward in 10K-block chunks looking for ANY incoming USDC transfer
  console.log(`\nWalking backward 10K blocks at a time looking for any incoming USDC…`);
  const CHUNK = 9_999n;
  let cursor = head;
  let totalChunks = 0;
  let firstFound = false;
  while (cursor > 0n && totalChunks < 20) {
    const fromBlock = cursor > CHUNK ? cursor - CHUNK : 0n;
    const logs = await rpc.getLogs({
      address: USDC as `0x${string}`,
      event: TRANSFER_EVENT,
      args: { to: MASTER as `0x${string}` },
      fromBlock,
      toBlock: cursor,
    });
    totalChunks++;
    if (logs.length > 0) {
      console.log(`  ✓ ${logs.length} transfers in blocks ${fromBlock}–${cursor}`);
      for (const l of logs.slice(0, 5)) {
        const block = await rpc.getBlock({ blockNumber: l.blockNumber! });
        console.log(
          `    blk=${l.blockNumber}  ts=${new Date(Number(block.timestamp) * 1000).toISOString()}  from=${l.args.from}  amt=${(Number(l.args.value!) / 1_000_000).toFixed(6)} USDC  tx=${l.transactionHash}`,
        );
      }
      firstFound = true;
      break;
    } else {
      console.log(`  · no transfers in blocks ${fromBlock}–${cursor} (~${((Number(cursor - fromBlock)) / 60).toFixed(0)}m back)`);
    }
    cursor = fromBlock - 1n;
  }
  if (!firstFound) {
    console.log(`\nNo incoming USDC transfers found in the last ${totalChunks * 10000} blocks.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
