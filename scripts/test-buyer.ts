import { GatewayClient } from "@circle-fin/x402-batching/client";

const SELLER_URL = "http://localhost:3100/test-paid-endpoint";
const MIN_GATEWAY_BALANCE_USDC = 0.5;
const DEPOSIT_AMOUNT_USDC = "1";

function fmt(v: unknown) {
  return JSON.stringify(v, (_k, val) => (typeof val === "bigint" ? val.toString() : val), 2);
}

async function step<T>(label: string, fn: () => Promise<T>): Promise<T> {
  console.log(`\n--- ${label} ---`);
  try {
    return await fn();
  } catch (err) {
    console.error(`[FAIL] ${label}`);
    throw err;
  }
}

async function main() {
  const pk = process.env.ROUTING_AGENT_PRIVATE_KEY;
  if (!pk) throw new Error("ROUTING_AGENT_PRIVATE_KEY missing from environment");

  const client = await step("Step 1: init GatewayClient (chain=arcTestnet)", async () => {
    const c = new GatewayClient({ chain: "arcTestnet", privateKey: pk as `0x${string}` });
    console.log(`Buyer (routing agent) address: ${c.address}`);
    return c;
  });

  const balances = await step("Step 2: getBalances() — wallet + gateway", async () => {
    const b = await client.getBalances();
    console.log(fmt(b));
    return b;
  });

  // Best-effort: find a "gateway available" figure across plausible shapes.
  const gatewayAvailableUsdc = (() => {
    const b: any = balances;
    const candidates = [
      b?.gateway?.available?.formatted,
      b?.gateway?.availableFormatted,
      b?.gatewayAvailable?.formatted,
      b?.available?.formatted,
    ];
    for (const c of candidates) {
      const n = Number(c);
      if (Number.isFinite(n)) return n;
    }
    return Number.NaN;
  })();
  console.log(`(parsed) gateway available USDC = ${gatewayAvailableUsdc}`);

  if (!Number.isFinite(gatewayAvailableUsdc) || gatewayAvailableUsdc < MIN_GATEWAY_BALANCE_USDC) {
    await step(`Step 3: deposit ${DEPOSIT_AMOUNT_USDC} USDC into Gateway`, async () => {
      const result = await client.deposit(DEPOSIT_AMOUNT_USDC);
      console.log(fmt(result));
      console.log("Deposit confirmed.");
      return result;
    });
  } else {
    console.log(
      `\n--- Step 3: skip deposit (gateway available ${gatewayAvailableUsdc} >= ${MIN_GATEWAY_BALANCE_USDC}) ---`,
    );
  }

  const payResult = await step(`Step 4: pay(${SELLER_URL})`, async () => {
    const r = await client.pay(SELLER_URL);
    return r;
  });

  await step("Step 5: response + updated balances", async () => {
    const r: any = payResult;
    console.log(`status: ${r?.status ?? "(no status field)"}`);
    console.log("response body:");
    console.log(fmt(r?.data ?? r));
    const after = await client.getBalances();
    console.log("balances after payment:");
    console.log(fmt(after));
  });

  console.log("\n=== test-buyer: success ===");
}

main().catch((err) => {
  console.error("\n[test-buyer] error:");
  console.error(err);
  process.exit(1);
});
