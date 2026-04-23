import { createPublicClient, http, parseAbi, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet, USDC_ADDRESS_ARC_TESTNET } from "../src/lib/chains";

const erc20Abi = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const MIN_USDC = 0.5;

async function main() {
  const masterPk = process.env.PRIVATE_KEY;
  const agentPk = process.env.ROUTING_AGENT_PRIVATE_KEY;
  if (!masterPk || !agentPk) throw new Error("missing keys");

  const master = privateKeyToAccount(masterPk as `0x${string}`).address;
  const agent = privateKeyToAccount(agentPk as `0x${string}`).address;

  const pc = createPublicClient({ chain: arcTestnet, transport: http() });

  const [masterNative, masterErc20, agentNative, agentErc20] = await Promise.all([
    pc.getBalance({ address: master }),
    pc.readContract({ address: USDC_ADDRESS_ARC_TESTNET, abi: erc20Abi, functionName: "balanceOf", args: [master] }),
    pc.getBalance({ address: agent }),
    pc.readContract({ address: USDC_ADDRESS_ARC_TESTNET, abi: erc20Abi, functionName: "balanceOf", args: [agent] }),
  ]);

  const rows = [
    { label: "MASTER (PRIVATE_KEY)", addr: master, native: masterNative, erc20: masterErc20 as bigint },
    { label: "AGENT  (ROUTING_AGENT_PRIVATE_KEY)", addr: agent, native: agentNative, erc20: agentErc20 as bigint },
  ];

  console.log("Arc Testnet balances (chain id 5042002):");
  for (const r of rows) {
    console.log(`\n${r.label}`);
    console.log(`  address:        ${r.addr}`);
    console.log(`  native (18dec): ${formatUnits(r.native, 18)} (${r.native} wei)`);
    console.log(`  USDC ERC20 (6): ${formatUnits(r.erc20, 6)} USDC (${r.erc20} atomic)`);
  }

  console.log(`\nMin needed (per script): ${MIN_USDC} USDC ERC20`);
  for (const r of rows) {
    const usdc = Number(formatUnits(r.erc20, 6));
    const ok = usdc >= MIN_USDC;
    console.log(`  ${r.label}: ${ok ? "OK" : "INSUFFICIENT"} (${usdc} USDC)`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
