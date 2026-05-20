import { createClient } from "@vercel/postgres";
import { STATIONS } from "./db-seed";
import { PARKING } from "./db-seed-parking";

// Read-only. Lists rows in stations / parking_locations whose
// (name, address) does NOT appear in the current seed spec — i.e.
// catalog leftovers from previous seed runs that would be removed
// if we added a DELETE step to seed-demo-state.ts.

async function main() {
  const c = createClient();
  await c.connect();
  try {
    const expectedStations = new Set(
      STATIONS.map((s) => `${s.brand}|${s.address}`),
    );
    const expectedParking = new Set(PARKING.map((p) => `${p.name}|${p.address}`));

    const sRes = await c.query<{
      id: string;
      name: string;
      address: string;
      current_price_per_gallon: string | null;
      last_priced_at: Date | null;
    }>(
      `SELECT id, name, address, current_price_per_gallon, last_priced_at
         FROM stations
        ORDER BY name, address`,
    );
    const pRes = await c.query<{
      id: string;
      name: string;
      address: string;
      current_hourly_rate: string | null;
    }>(
      `SELECT id, name, address, current_hourly_rate
         FROM parking_locations
        ORDER BY name, address`,
    );

    const staleStations = sRes.rows.filter(
      (r) => !expectedStations.has(`${r.name}|${r.address}`),
    );
    const staleParking = pRes.rows.filter(
      (r) => !expectedParking.has(`${r.name}|${r.address}`),
    );

    console.log(
      `\nStations not in current spec (${staleStations.length} of ${sRes.rows.length}):\n`,
    );
    for (const r of staleStations) {
      const price = r.current_price_per_gallon
        ? `$${Number(r.current_price_per_gallon).toFixed(2)}`
        : "—";
      console.log(
        `  ${r.name.padEnd(10)} ${r.address.padEnd(48)} ${price.padStart(7)}`,
      );
    }

    console.log(
      `\nParking not in current spec (${staleParking.length} of ${pRes.rows.length}):\n`,
    );
    for (const r of staleParking) {
      const rate = r.current_hourly_rate
        ? `$${Number(r.current_hourly_rate).toFixed(2)}/hr`
        : "—";
      console.log(
        `  ${r.name.padEnd(28)} ${r.address.padEnd(40)} ${rate.padStart(10)}`,
      );
    }
    console.log(``);
  } finally {
    await c.end();
  }
}

main().catch((err) => {
  console.error("[db-list-stale-catalog] failed:", err);
  process.exit(1);
});
