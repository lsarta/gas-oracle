import { GatewayClient } from "@circle-fin/x402-batching/client";
import { ensureGatewayBalance } from "./_gateway-balance";

const ORACLE_HOST = process.env.ORACLE_HOST ?? "http://localhost:3000";
const GAS_PATH = "/api/oracle/cheapest-gas";
const PARKING_PATH = "/api/oracle/cheapest-parking";
const QUERY_INTERVAL_MS = 5000;
const SF_LAT = 37.7749;
const SF_LNG = -122.4194;
const JITTER = 0.02;

function ts() {
  return new Date().toTimeString().slice(0, 8);
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

  console.log("=".repeat(64));
  console.log("Gyas routing agent (gas + parking)");
  console.log(`Address:         ${client.address}`);

  const { available, deposited } = await ensureGatewayBalance(client);
  const balanceLabel = Number.isFinite(available) ? `${available} USDC` : "(unparsed)";
  console.log(`Gateway balance: ${balanceLabel}${deposited ? " (topped up)" : ""}`);

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
