import { createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  arcTestnet,
  USDC_ADDRESS_ARC_TESTNET,
} from "../src/lib/chains";

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("PRIVATE_KEY missing");
  const master = privateKeyToAccount(pk as `0x${string}`).address;
  console.log(`Master address: ${master}`);

  const rpc = createPublicClient({ chain: arcTestnet, transport: http() });
  const nativeBal = await rpc.getBalance({ address: master });
  console.log(`Native balance: ${nativeBal} wei`);

  const usdc = await rpc.readContract({
    address: USDC_ADDRESS_ARC_TESTNET as `0x${string}`,
    abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
    functionName: "balanceOf",
    args: [master],
  });
  console.log(`USDC balance: ${(Number(usdc) / 1_000_000).toFixed(6)} USDC`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
