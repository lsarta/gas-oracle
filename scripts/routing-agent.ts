import { GatewayClient } from "@circle-fin/x402-batching/client";

const ORACLE_HOST = "http://localhost:3000";
const GAS_PATH = "/api/oracle/cheapest-gas";
const PARKING_PATH = "/api/oracle/cheapest-parking";
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

type GasResp = {
  station?: { name: string; price: number } | null;
  distanceMiles?: number;
};
type ParkingResp = {
  location?: { name: string; hourlyRate: number } | null;
  distanceMiles?: number;
};

async function main() {
  const pk = process.env.ROUTING_AGENT_PRIVATE_KEY;
  if (!pk) throw new Error("ROUTING_AGENT_PRIVATE_KEY missing");

  const client = new GatewayClient({ chain: "arcTestnet", privateKey: pk as `0x${string}` });

  const balances = await client.getBalances();
  const available = gatewayAvailable(balances);

  console.log("=".repeat(64));
  console.log("Gyas routing agent (gas + parking)");
  console.log(`Address:         ${client.address}`);
  console.log(`Gateway balance: ${Number.isFinite(available) ? `${available} USDC` : "(unparsed)"}`);

  if (!Number.isFinite(available) || available < MIN_GATEWAY_BALANCE_USDC) {
    console.log(`Depositing ${DEPOSIT_AMOUNT_USDC} USDC into Gateway...`);
    await client.deposit(DEPOSIT_AMOUNT_USDC);
    console.log("Deposit confirmed.");
  }

  console.log(`Querying alternating gas/parking oracles every ${QUERY_INTERVAL_MS / 1000}s...`);
  console.log("=".repeat(64));

  let totalQueries = 0;
  let totalSpent = 0;

  for (;;) {
    const lat = SF_LAT + (Math.random() - 0.5) * 2 * JITTER;
    const lng = SF_LNG + (Math.random() - 0.5) * 2 * JITTER;
    const isParking = totalQueries % 2 === 1;
    const path = isParking ? PARKING_PATH : GAS_PATH;
    const url = `${ORACLE_HOST}${path}?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}&radiusMinutes=10`;

    try {
      const result = await client.pay(url);
      const data = (result as { data: GasResp & ParkingResp }).data;
      const formatted = (result as { formattedAmount?: string }).formattedAmount ?? "0.001";
      totalQueries += 1;
      totalSpent += Number(formatted);

      if (isParking) {
        if (data?.location) {
          console.log(
            `[${ts()}] PARKING (${lat.toFixed(4)}, ${lng.toFixed(4)}) → ${data.location.name} ($${data.location.hourlyRate.toFixed(2)}/hr, ${data.distanceMiles} mi) — paid $${formatted} USDC`,
          );
        } else {
          console.log(
            `[${ts()}] PARKING (${lat.toFixed(4)}, ${lng.toFixed(4)}) → no location within radius — paid $${formatted} USDC`,
          );
        }
      } else {
        if (data?.station) {
          console.log(
            `[${ts()}] GAS     (${lat.toFixed(4)}, ${lng.toFixed(4)}) → ${data.station.name} ($${data.station.price.toFixed(2)}/gal, ${data.distanceMiles} mi) — paid $${formatted} USDC`,
          );
        } else {
          console.log(
            `[${ts()}] GAS     (${lat.toFixed(4)}, ${lng.toFixed(4)}) → no station within radius — paid $${formatted} USDC`,
          );
        }
      }

      if (totalQueries % 5 === 0) {
        console.log(
          `--- ${totalQueries} queries (gas + parking), total spent: $${totalSpent.toFixed(3)} USDC ---`,
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
