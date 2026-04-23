import { GatewayClient } from "@circle-fin/x402-batching/client";

const ORACLE_BASE = "http://localhost:3000/api/oracle/cheapest-gas";
const QUERY_INTERVAL_MS = 5000;
const MIN_GATEWAY_BALANCE_USDC = 0.1;
const DEPOSIT_AMOUNT_USDC = "0.5";
const SF_LAT = 37.7749;
const SF_LNG = -122.4194;
const JITTER = 0.02;

function ts() {
  return new Date().toTimeString().slice(0, 8);
}

function gatewayAvailable(b: unknown): number {
  const x = b as Record<string, any>;
  const candidates = [
    x?.gateway?.available?.formatted,
    x?.gateway?.availableFormatted,
    x?.gatewayAvailable?.formatted,
    x?.available?.formatted,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n)) return n;
  }
  return Number.NaN;
}

async function main() {
  const pk = process.env.ROUTING_AGENT_PRIVATE_KEY;
  if (!pk) throw new Error("ROUTING_AGENT_PRIVATE_KEY missing");

  const client = new GatewayClient({ chain: "arcTestnet", privateKey: pk as `0x${string}` });

  const balances = await client.getBalances();
  const available = gatewayAvailable(balances);

  console.log("=".repeat(64));
  console.log("Gyas routing agent");
  console.log(`Address:         ${client.address}`);
  console.log(`Gateway balance: ${Number.isFinite(available) ? `${available} USDC` : "(unparsed)"}`);

  if (!Number.isFinite(available) || available < MIN_GATEWAY_BALANCE_USDC) {
    console.log(`Depositing ${DEPOSIT_AMOUNT_USDC} USDC into Gateway...`);
    await client.deposit(DEPOSIT_AMOUNT_USDC);
    console.log("Deposit confirmed.");
  }

  console.log(`Querying oracle every ${QUERY_INTERVAL_MS / 1000}s...`);
  console.log("=".repeat(64));

  let totalQueries = 0;
  let totalSpent = 0;

  for (;;) {
    const lat = SF_LAT + (Math.random() - 0.5) * 2 * JITTER;
    const lng = SF_LNG + (Math.random() - 0.5) * 2 * JITTER;
    const url = `${ORACLE_BASE}?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}&radiusMinutes=5`;

    try {
      const result = await client.pay(url);
      const data = (result as { data: any }).data;
      const formatted = (result as { formattedAmount?: string }).formattedAmount ?? "0.001";
      totalQueries += 1;
      totalSpent += Number(formatted);

      if (data?.station) {
        console.log(
          `[${ts()}] queried (${lat.toFixed(4)}, ${lng.toFixed(4)}) → cheapest: ${data.station.name} ($${data.station.price.toFixed(2)}, ${data.distanceMiles} mi away) — paid $${formatted} USDC`,
        );
      } else {
        console.log(
          `[${ts()}] queried (${lat.toFixed(4)}, ${lng.toFixed(4)}) → no station within radius — paid $${formatted} USDC`,
        );
      }

      if (totalQueries % 5 === 0) {
        console.log(
          `--- ${totalQueries} queries, total spent: $${totalSpent.toFixed(3)} USDC ---`,
        );
      }
    } catch (err) {
      console.error(`[${ts()}] query failed:`, err instanceof Error ? err.message : err);
    }

    await new Promise((r) => setTimeout(r, QUERY_INTERVAL_MS));
  }
}

main().catch((err) => {
  console.error("[routing-agent] fatal:", err);
  process.exit(1);
});
