/**
 * One-off demo seeder: spin up N fresh wallets, fund each from master,
 * and have each fire real x402-paid oracle queries. Real on-chain txs
 * so the activity feed and "Unique wallets" stat reflect genuine users.
 *
 * Cleanup: not idempotent — generated wallets are random. Save the
 * private keys printed at the top if you need to recover the funds
 * back out of them later. Otherwise the residual dust stays in the
 * burner addresses.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseEther,
  parseUnits,
} from "viem";
import {
  privateKeyToAccount,
  generatePrivateKey,
} from "viem/accounts";
import { GatewayClient } from "@circle-fin/x402-batching/client";
import {
  arcTestnet,
  USDC_ADDRESS_ARC_TESTNET,
} from "../src/lib/chains";

const N_WALLETS = 3;
const QUERIES_PER_WALLET = 5;
const NATIVE_PER_WALLET = parseEther("0.1"); // 0.1 native USDC for gas
const ERC20_PER_WALLET = parseUnits("0.6", 6); // 0.6 USDC ERC20 (covers 0.5 deposit + queries)
const GATEWAY_DEPOSIT = "0.5";
const SF_LAT = 37.7749;
const SF_LNG = -122.4194;
const JITTER = 0.03;
const BASE_URL = "https://www.gyasss.com";

const erc20Abi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
]);

function randomLatLng(): { lat: number; lng: number } {
  return {
    lat: SF_LAT + (Math.random() - 0.5) * 2 * JITTER,
    lng: SF_LNG + (Math.random() - 0.5) * 2 * JITTER,
  };
}

async function fund(
  master: ReturnType<typeof privateKeyToAccount>,
  recipient: `0x${string}`,
) {
  const rpc = createPublicClient({ chain: arcTestnet, transport: http() });
  const wallet = createWalletClient({
    account: master,
    chain: arcTestnet,
    transport: http(),
  });

  console.log(`  · sending ${NATIVE_PER_WALLET} wei native USDC...`);
  const nativeHash = await wallet.sendTransaction({
    to: recipient,
    value: NATIVE_PER_WALLET,
  });
  await rpc.waitForTransactionReceipt({ hash: nativeHash });
  console.log(`    native tx: ${nativeHash}`);

  console.log(`  · sending ${ERC20_PER_WALLET} atomic USDC (ERC20)...`);
  const erc20Hash = await wallet.writeContract({
    address: USDC_ADDRESS_ARC_TESTNET,
    abi: erc20Abi,
    functionName: "transfer",
    args: [recipient, ERC20_PER_WALLET],
  });
  await rpc.waitForTransactionReceipt({ hash: erc20Hash });
  console.log(`    erc20 tx: ${erc20Hash}`);
}

async function fireQueries(pk: `0x${string}`, n: number) {
  const client = new GatewayClient({ chain: "arcTestnet", privateKey: pk });

  console.log(`  · depositing ${GATEWAY_DEPOSIT} USDC into Gateway...`);
  await client.deposit(GATEWAY_DEPOSIT);

  for (let i = 1; i <= n; i++) {
    const { lat, lng } = randomLatLng();
    const path = i % 2 === 0 ? "/api/oracle/cheapest-parking" : "/api/oracle/cheapest-gas";
    const url = `${BASE_URL}${path}?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}&radiusMinutes=10`;
    try {
      const res = (await client.pay(url)) as {
        paymentResponse?: { transaction?: string };
        transaction?: string;
        formattedAmount?: string;
      };
      const tx =
        res.paymentResponse?.transaction ?? res.transaction ?? "?";
      console.log(`    [${i}/${n}] ok  ${path.split("/").pop()}  tx=${tx}`);
    } catch (e) {
      console.error(
        `    [${i}/${n}] FAIL: ${e instanceof Error ? e.message : e}`,
      );
    }
  }
}

async function main() {
  const masterPk = process.env.PRIVATE_KEY;
  if (!masterPk) throw new Error("PRIVATE_KEY missing");
  const master = privateKeyToAccount(masterPk as `0x${string}`);
  console.log(`Master: ${master.address}\n`);

  const wallets: { pk: `0x${string}`; address: string }[] = [];
  for (let i = 0; i < N_WALLETS; i++) {
    const pk = generatePrivateKey();
    const acct = privateKeyToAccount(pk);
    wallets.push({ pk, address: acct.address });
  }

  console.log("Generated burner wallets:");
  for (const w of wallets) {
    console.log(`  ${w.address}  pk=${w.pk}`);
  }
  console.log("");

  for (const [idx, w] of wallets.entries()) {
    console.log(`\n=== wallet ${idx + 1}/${N_WALLETS}: ${w.address} ===`);
    console.log("step 1: fund from master");
    await fund(master, w.address as `0x${string}`);
    console.log("step 2: fire queries");
    await fireQueries(w.pk, QUERIES_PER_WALLET);
  }

  console.log(`\nDone. Seeded ${N_WALLETS} wallets × ${QUERIES_PER_WALLET} queries.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
