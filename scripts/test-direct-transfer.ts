import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet, USDC_ADDRESS_ARC_TESTNET } from "../src/lib/chains";

const ATOMIC_AMOUNT = BigInt(50_000); // 0.05 USDC at 6 decimals (ES2017 target — no n-literal)

const erc20Abi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
]);

async function main() {
  const senderPk = process.env.PRIVATE_KEY;
  const recipientPk = process.env.ROUTING_AGENT_PRIVATE_KEY;
  if (!senderPk) throw new Error("PRIVATE_KEY missing from environment");
  if (!recipientPk) throw new Error("ROUTING_AGENT_PRIVATE_KEY missing from environment");

  const sender = privateKeyToAccount(senderPk as `0x${string}`);
  const recipient = privateKeyToAccount(recipientPk as `0x${string}`).address;

  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const walletClient = createWalletClient({ account: sender, chain: arcTestnet, transport: http() });

  console.log("=".repeat(60));
  console.log(`Chain:      ${arcTestnet.name} (id=${arcTestnet.id})`);
  console.log(`USDC ERC20: ${USDC_ADDRESS_ARC_TESTNET}`);
  console.log(`From:       ${sender.address}`);
  console.log(`To:         ${recipient}`);
  console.log(`Amount:     ${ATOMIC_AMOUNT}n atomic units (= 0.05 USDC at 6 decimals)`);
  console.log("=".repeat(60));

  let hash: `0x${string}`;
  try {
    hash = await walletClient.writeContract({
      address: USDC_ADDRESS_ARC_TESTNET,
      abi: erc20Abi,
      functionName: "transfer",
      args: [recipient, ATOMIC_AMOUNT],
    });
  } catch (err) {
    console.error("[test-transfer] writeContract(transfer) failed:");
    throw err;
  }

  console.log(`tx hash:    ${hash}`);
  console.log("Waiting for confirmation...");

  let receipt;
  try {
    receipt = await publicClient.waitForTransactionReceipt({ hash });
  } catch (err) {
    console.error("[test-transfer] waitForTransactionReceipt failed:");
    throw err;
  }

  console.log(`status:     ${receipt.status}`);
  console.log(`block:      ${receipt.blockNumber}`);
  console.log(`gas used:   ${receipt.gasUsed}`);
  console.log(`explorer:   ${arcTestnet.blockExplorers!.default.url}/tx/${hash}`);
  console.log("=== test-direct-transfer: success ===");
}

main().catch((err) => {
  console.error("\n[test-direct-transfer] error:");
  console.error(err);
  process.exit(1);
});
