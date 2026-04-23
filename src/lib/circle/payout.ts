import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet, USDC_ADDRESS_ARC_TESTNET } from "@/lib/chains";

const erc20Abi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
]);

export async function sendUsdcToUser(
  recipientAddress: `0x${string}`,
  amountUsdc: number,
): Promise<{ txHash: `0x${string}`; blockNumber: bigint }> {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("PRIVATE_KEY missing from environment");

  if (!(amountUsdc > 0)) {
    throw new Error(`sendUsdcToUser: amount must be > 0 (got ${amountUsdc})`);
  }

  const sender = privateKeyToAccount(pk as `0x${string}`);
  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const walletClient = createWalletClient({
    account: sender,
    chain: arcTestnet,
    transport: http(),
  });

  // USDC has 6 decimals. Use a string-based conversion to avoid float drift.
  const atomicAmount = BigInt(Math.round(amountUsdc * 1_000_000));
  if (atomicAmount <= BigInt(0)) {
    throw new Error(`sendUsdcToUser: rounded atomic amount is 0 (input ${amountUsdc})`);
  }

  let hash: `0x${string}`;
  try {
    hash = await walletClient.writeContract({
      address: USDC_ADDRESS_ARC_TESTNET,
      abi: erc20Abi,
      functionName: "transfer",
      args: [recipientAddress, atomicAmount],
    });
  } catch (err) {
    throw new Error(
      `USDC transfer failed (writeContract): ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let receipt;
  try {
    receipt = await publicClient.waitForTransactionReceipt({ hash });
  } catch (err) {
    throw new Error(
      `USDC transfer failed (waitForTransactionReceipt) tx=${hash}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (receipt.status !== "success") {
    throw new Error(`USDC transfer reverted: tx=${hash} status=${receipt.status}`);
  }

  return { txHash: hash, blockNumber: receipt.blockNumber };
}
