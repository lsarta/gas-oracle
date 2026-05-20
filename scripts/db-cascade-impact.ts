import { createClient } from "@vercel/postgres";
import { STATIONS } from "./db-seed";
import { PARKING } from "./db-seed-parking";

// Read-only. Reports what would cascade-delete if we removed the
// stations / parking_locations rows that aren't in the current seed
// spec. Specifically:
//   - reports.station_id → ON DELETE CASCADE → counts deleted reports
//     (real-user vs synthetic) for those stations
//   - stakes.report_id → ON DELETE CASCADE → counts deleted stakes
//   - parking_locations has no child tables yet
//
// Use this before adding a DELETE step to seed-demo-state.ts.

const SYNTHETIC_PATTERN = "^0x0{30,}";

async function main() {
  const c = createClient();
  await c.connect();
  try {
    const expectedStations = new Set(
      STATIONS.map((s) => `${s.brand}|${s.address}`),
    );
    const expectedParking = new Set(PARKING.map((p) => `${p.name}|${p.address}`));

    const stRes = await c.query<{ id: string; name: string; address: string }>(
      `SELECT id, name, address FROM stations`,
    );
    const pkRes = await c.query<{ id: string; name: string; address: string }>(
      `SELECT id, name, address FROM parking_locations`,
    );

    const staleStationIds = stRes.rows
      .filter((r) => !expectedStations.has(`${r.name}|${r.address}`))
      .map((r) => r.id);
    const staleParkingIds = pkRes.rows
      .filter((r) => !expectedParking.has(`${r.name}|${r.address}`))
      .map((r) => r.id);

    if (staleStationIds.length === 0 && staleParkingIds.length === 0) {
      console.log("\nNo stale catalog rows. Nothing would cascade.\n");
      return;
    }

    // Reports tied to stale stations
    const repCounts = await c.query<{
      total: string;
      synthetic: string;
      real: string;
    }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE user_wallet ~ $1)::text AS synthetic,
         COUNT(*) FILTER (WHERE user_wallet !~ $1)::text AS real
       FROM reports WHERE station_id = ANY($2::uuid[])`,
      [SYNTHETIC_PATTERN, staleStationIds],
    );

    // Stakes tied to those reports
    const stakeCount = await c.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n
         FROM stakes
        WHERE report_id IN (SELECT id FROM reports WHERE station_id = ANY($1::uuid[]))`,
      [staleStationIds],
    );

    // Real-user wallets that would lose history (just the distinct count
    // and sample so the user can decide if that's acceptable)
    const realWallets = await c.query<{ user_wallet: string; n: string }>(
      `SELECT user_wallet, COUNT(*)::text AS n
         FROM reports
        WHERE station_id = ANY($1::uuid[]) AND user_wallet !~ $2
        GROUP BY user_wallet
        ORDER BY n DESC`,
      [staleStationIds, SYNTHETIC_PATTERN],
    );

    console.log(`\n--- Cascade impact ---\n`);
    console.log(
      `Stations to delete: ${staleStationIds.length} (of ${stRes.rows.length})`,
    );
    console.log(
      `Parking to delete:  ${staleParkingIds.length} (of ${pkRes.rows.length})\n`,
    );

    console.log(`Reports that would cascade-delete:`);
    console.log(`  total      ${repCounts.rows[0].total}`);
    console.log(
      `  synthetic  ${repCounts.rows[0].synthetic}  (re-seeded each run, expendable)`,
    );
    console.log(
      `  real-user  ${repCounts.rows[0].real}  (genuine history — flagged below)`,
    );
    console.log(``);
    console.log(`Stakes that would cascade-delete: ${stakeCount.rows[0].n}\n`);

    if (realWallets.rowCount && realWallets.rowCount > 0) {
      console.log(
        `Real-user wallets that would lose history (${realWallets.rowCount}):`,
      );
      for (const r of realWallets.rows) {
        console.log(
          `  ${r.user_wallet.slice(0, 10)}…${r.user_wallet.slice(-6)}  ${r.n} report(s)`,
        );
      }
      console.log(``);
    } else {
      console.log(`No real-user wallets affected. Safe to cascade.\n`);
    }
  } finally {
    await c.end();
  }
}

main().catch((err) => {
  console.error("[db-cascade-impact] failed:", err);
  process.exit(1);
});
