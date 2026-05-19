import { createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { arcTestnet } from "../src/lib/chains";

const USDC = "0x3600000000000000000000000000000000000000";

async function main() {
  const pk = process.env.ROUTING_AGENT_PRIVATE_KEY;
  if (!pk) throw new Error("ROUTING_AGENT_PRIVATE_KEY missing from env");

  const acct = privateKeyToAccount(pk as `0x${string}`);
  console.log(`Routing agent address: ${acct.address}`);

  const rpc = createPublicClient({ chain: arcTestnet, transport: http() });
  const onchain = await rpc.readContract({
    address: USDC as `0x${string}`,
    abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
    functionName: "balanceOf",
    args: [acct.address],
  });
  console.log(`On-chain USDC balance: ${(Number(onchain) / 1_000_000).toFixed(6)} USDC`);

  const client = new GatewayClient({
    chain: "arcTestnet",
    privateKey: pk as `0x${string}`,
  });
  const balances = await client.getBalances();
  console.log(`\nGateway balances (raw):`);
  console.log(
    JSON.stringify(
      balances,
      (_k, v) => (typeof v === "bigint" ? v.toString() : v),
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
