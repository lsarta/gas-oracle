import { createClient } from "@vercel/postgres";
import { seedStations, STATIONS } from "./db-seed";
import { seedParking, PARKING } from "./db-seed-parking";

// Idempotent demo-state seeder. Re-run any time before/during the
// May 28 demo cycle to reset the public DB to a known-good state.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/seed-demo-state.ts <DEMO_WALLET>
//   DEMO_WALLET=0x... npx tsx --env-file=.env.local scripts/seed-demo-state.ts
//
// Companion: scripts/reset-demo-state.ts (removes synthetic demo rows
// without re-seeding).
//
// Idempotency rule: every demo-seeded row uses a wallet matching
// `^0x0{30,}` (30+ leading zeros after 0x), which is excluded from
// normal-traffic queries by the same convention as cleanup-test-data.ts.

const SYNTHETIC_PREFIX = "0x000000000000000000000000000000000000"; // 36 chars; +6 hex suffix = 42 chars total
const SYNTHETIC_PATTERN = "^0x0{30,}";

const DEMO = {
  home: {
    lat: 37.7912,
    lng: -122.4358,
    address: "2398 Pacific Ave, San Francisco, CA 94115",
  },
  work: {
    lat: 37.7929,
    lng: -122.4014,
    address: "345 California St, San Francisco, CA 94104",
  },
  hourlyValueUsd: 75.0,
  avgMpg: 25.0,
  typicalFillupGallons: 12.0,
};

// Parking locations that should remain stale post-seed to demo the
// freshness/bounty UX. Match by name (unique within parking_locations
// when paired with address, but name alone is unambiguous in our seed).
const STALE_PARKING_NAMES = new Set(["Civic Center Garage", "Lombard Garage"]);

const HEALTHY_OQ_24H = 80;
const REPORTER_POOL_SIZE = 60;

const REPOINT_WARN_MILES = 2;

function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 3958.7613;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function syntheticWallet(idx: number): string {
  // 0x + 34 zeros + 6 hex chars = 42 chars. Suffix is hex of (idx+1)
  // padded to 6 chars. Caps at 16,777,215 — far beyond demo needs.
  return `${SYNTHETIC_PREFIX}${(idx + 1).toString(16).padStart(6, "0")}`;
}

// Pool of REPORTER_POOL_SIZE distinct wallet IDs. Each report draws
// randomly from this pool so /stats's uniqueWalletsLast24h tile reads
// as a believable mid-traffic snapshot (~60 wallets, ~3 reports each)
// rather than 185 single-report ghosts.
function pickReporter(): string {
  return syntheticWallet(Math.floor(Math.random() * REPORTER_POOL_SIZE));
}

function recentMinutesAgo(): number {
  // 2 to 112 minutes ago, uniform. Spread keeps consensus dominance
  // share <70% (the 'low confidence' trip-wire in lib/oracle/consensus.ts).
  return 2 + Math.random() * 110;
}

function jitterPrice(base: number): number {
  // 80% within ±$0.05, 20% within ±$0.15 (per spec). Always well inside
  // the 5%-spread window required for 'high' confidence.
  const wide = Math.random() < 0.2;
  const range = wide ? 0.15 : 0.05;
  return Math.round((base + (Math.random() - 0.5) * 2 * range) * 1000) / 1000;
}

function jitterGallons(): number {
  return 8 + Math.random() * 8;
}

async function main() {
  const wallet = (process.env.DEMO_WALLET ?? process.argv[2] ?? "")
    .trim()
    .toLowerCase();

  const c = createClient();
  await c.connect();
  try {
    // === 1. Catalog: ensure all 25 stations + 12 parking locations exist.
    console.log("\n=== 1. Ensuring station + parking catalog ===");
    const stationSeed = await seedStations(c);
    const parkingSeed = await seedParking(c);
    console.log(
      `  · stations: ${stationSeed.inserted} inserted, ${stationSeed.refreshed} refreshed (${STATIONS.length} total)`,
    );
    console.log(
      `  · parking:  ${parkingSeed.inserted} inserted, ${parkingSeed.refreshed} refreshed (${PARKING.length} total)`,
    );

    // === 1.5. Prune stale catalog rows. Re-point real reports to the
    // nearest in-spec station first so user history isn't lost; then
    // delete (synthetic reports cascade-delete naturally on the second
    // pass, since they get re-cleaned in step 2 anyway).
    console.log("\n=== 1.5. Pruning stale catalog rows ===");

    const expectedStations = new Set(
      STATIONS.map((s) => `${s.brand}|${s.address}`),
    );
    const expectedParking = new Set(
      PARKING.map((p) => `${p.name}|${p.address}`),
    );

    const allStRes = await c.query<{
      id: string;
      name: string;
      address: string;
      lat: number;
      lng: number;
    }>(`SELECT id, name, address, lat, lng FROM stations`);
    const specStations = allStRes.rows.filter((r) =>
      expectedStations.has(`${r.name}|${r.address}`),
    );
    const staleStations = allStRes.rows.filter(
      (r) => !expectedStations.has(`${r.name}|${r.address}`),
    );

    let totalRepointed = 0;
    for (const s of staleStations) {
      // Find nearest in-spec station by haversine
      let best = specStations[0];
      let bestDist = haversineMiles(s, best);
      for (const t of specStations) {
        const d = haversineMiles(s, t);
        if (d < bestDist) {
          best = t;
          bestDist = d;
        }
      }
      // Only re-point real-user reports; synthetic ones get nuked in step 2.
      const upd = await c.query(
        `UPDATE reports SET station_id = $1
           WHERE station_id = $2 AND user_wallet !~ $3`,
        [best.id, s.id, SYNTHETIC_PATTERN],
      );
      const moved = upd.rowCount ?? 0;
      totalRepointed += moved;
      if (moved > 0) {
        const warn = bestDist > REPOINT_WARN_MILES ? `  ← STRETCH` : "";
        console.log(
          `  · ${moved.toString().padStart(2)} reports: ${s.name}/${s.address.slice(0, 40)} → ${best.name}/${best.address.slice(0, 40)}  (${bestDist.toFixed(1)} mi)${warn}`,
        );
      }
    }

    if (staleStations.length > 0) {
      const delSt = await c.query(
        `DELETE FROM stations WHERE id = ANY($1::uuid[])`,
        [staleStations.map((s) => s.id)],
      );
      console.log(
        `  · re-pointed ${totalRepointed} real-user reports; deleted ${delSt.rowCount} stale stations`,
      );
    } else {
      console.log(`  · no stale stations to prune`);
    }

    const allPkRes = await c.query<{ id: string; name: string; address: string }>(
      `SELECT id, name, address FROM parking_locations`,
    );
    const staleParking = allPkRes.rows.filter(
      (r) => !expectedParking.has(`${r.name}|${r.address}`),
    );
    if (staleParking.length > 0) {
      const delPk = await c.query(
        `DELETE FROM parking_locations WHERE id = ANY($1::uuid[])`,
        [staleParking.map((p) => p.id)],
      );
      console.log(
        `  · deleted ${delPk.rowCount} stale parking rows (no FK dependencies)`,
      );
    } else {
      console.log(`  · no stale parking to prune`);
    }

    // === 2. Cleanup prior synthetic demo rows.
    console.log("\n=== 2. Cleaning prior synthetic demo rows ===");
    const delStakes = await c.query(
      `DELETE FROM stakes WHERE user_wallet ~ $1`,
      [SYNTHETIC_PATTERN],
    );
    const delReports = await c.query(
      `DELETE FROM reports WHERE user_wallet ~ $1`,
      [SYNTHETIC_PATTERN],
    );
    console.log(
      `  · deleted ${delReports.rowCount} reports, ${delStakes.rowCount} stakes`,
    );

    // === 3. Seed 5-10 reports per station (last 2h, tight cluster).
    console.log("\n=== 3. Seeding 5-10 fresh reports per station ===");
    const stationsRes = await c.query<{
      id: string;
      name: string;
      address: string;
      current_price_per_gallon: string;
    }>(
      `SELECT id, name, address, current_price_per_gallon
         FROM stations
        WHERE current_price_per_gallon IS NOT NULL`,
    );

    let totalReports = 0;
    for (const s of stationsRes.rows) {
      const basePrice = Number(s.current_price_per_gallon);
      const n = 5 + Math.floor(Math.random() * 6); // 5-10
      for (let i = 0; i < n; i++) {
        const minsAgo = recentMinutesAgo();
        const price = jitterPrice(basePrice);
        const gallons = jitterGallons();
        const txAmount = Math.round(price * gallons * 100) / 100;
        await c.query(
          `INSERT INTO reports (
             station_id, user_wallet, transaction_amount_usd, gallons,
             computed_price_per_gallon, payout_amount_usdc, was_outlier, created_at
           ) VALUES ($1, $2, $3, $4, $5, $6, false, now() - ($7 || ' minutes')::interval)`,
          [
            s.id,
            pickReporter(),
            txAmount,
            gallons.toFixed(3),
            price,
            0.05,
            minsAgo.toFixed(2),
          ],
        );
        totalReports++;
      }
      // Lock in 'high' confidence + fresh stamp on the station row.
      // last_priced_at <= 6h with confidence='high' keeps stake-gating off
      // (see lib/oracle/stakes.ts: bounty=0 when ageHours<=6).
      await c.query(
        `UPDATE stations
            SET current_price_per_gallon = $1,
                last_priced_at = now() - interval '5 minutes',
                consensus_confidence = 'high',
                consensus_report_count = $2,
                active_bounty_usdc = 0
          WHERE id = $3`,
        [basePrice, n, s.id],
      );
    }
    console.log(
      `  · seeded ${totalReports} reports across ${stationsRes.rows.length} stations`,
    );

    // === 4. Parking freshness: 10 fresh, 2 deliberately stale.
    console.log("\n=== 4. Refreshing parking (2 deliberately stale) ===");
    const parkingRes = await c.query<{ id: string; name: string }>(
      `SELECT id, name FROM parking_locations`,
    );
    let freshCount = 0;
    let staleCount = 0;
    for (const p of parkingRes.rows) {
      if (STALE_PARKING_NAMES.has(p.name)) {
        const hoursAgo = 14 + Math.random() * 8; // 14-22h per spec
        await c.query(
          `UPDATE parking_locations
              SET last_priced_at = now() - ($1 || ' hours')::interval
            WHERE id = $2`,
          [hoursAgo.toFixed(2), p.id],
        );
        staleCount++;
      } else {
        const minsAgo = recentMinutesAgo();
        await c.query(
          `UPDATE parking_locations
              SET last_priced_at = now() - ($1 || ' minutes')::interval
            WHERE id = $2`,
          [minsAgo.toFixed(2), p.id],
        );
        freshCount++;
      }
    }
    console.log(
      `  · ${freshCount} fresh, ${staleCount} stale (Civic Center & Lombard)`,
    );

    // === 5. Demo wallet preferences.
    console.log("\n=== 5. Demo wallet setup ===");
    if (!wallet) {
      console.log(
        "  · No DEMO_WALLET provided. Skipping wallet config.\n" +
          "    To configure: pass as CLI arg or set DEMO_WALLET env var.",
      );
    } else if (!/^0x[a-f0-9]{40}$/.test(wallet)) {
      console.log(
        `  · Invalid wallet "${wallet}" — must be 0x-prefixed 40 hex chars`,
      );
    } else {
      const upd = await c.query(
        `UPDATE users SET
            home_lat = $1, home_lng = $2, home_address = $3,
            work_lat = $4, work_lng = $5, work_address = $6,
            hourly_value_usd = $7, avg_mpg = $8, typical_fillup_gallons = $9
          WHERE wallet_address = $10
          RETURNING wallet_address`,
        [
          DEMO.home.lat,
          DEMO.home.lng,
          DEMO.home.address,
          DEMO.work.lat,
          DEMO.work.lng,
          DEMO.work.address,
          DEMO.hourlyValueUsd,
          DEMO.avgMpg,
          DEMO.typicalFillupGallons,
          wallet,
        ],
      );
      if (upd.rowCount === 0) {
        console.log(
          `  · Wallet ${wallet.slice(0, 10)}…${wallet.slice(-6)} not in users table.\n` +
            `    Sign in once at https://www.gyasss.com to create the row,\n` +
            `    then re-run this script.`,
        );
      } else {
        console.log(
          `  · ${wallet.slice(0, 10)}…${wallet.slice(-6)}: home=Pacific Heights, work=345 California, $${DEMO.hourlyValueUsd}/hr, ${DEMO.avgMpg} mpg, ${DEMO.typicalFillupGallons} gal/fillup`,
        );
      }
    }

    // === 6. /stats activity check (no auto-spawn — caller decides).
    console.log("\n=== 6. /stats activity check ===");
    const oqCountRes = await c.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n
         FROM oracle_queries
        WHERE created_at > now() - interval '24 hours'`,
    );
    const oqLast24h = Number(oqCountRes.rows[0].n);
    console.log(`  · oracle_queries last 24h: ${oqLast24h}`);
    if (oqLast24h >= HEALTHY_OQ_24H) {
      console.log(`  · Healthy (>=${HEALTHY_OQ_24H}) — no top-up needed.`);
    } else {
      console.log(
        `  · Sparse (want >=${HEALTHY_OQ_24H}). To top up with authentic on-chain calls:`,
      );
      console.log(`      1. npm run dev               (in one terminal)`);
      console.log(
        `      2. npm run agent:run         (in another, leave for ~8-10 min)`,
      );
      console.log(
        `    Cost: ~$0.001 USDC per call (+ one-time 0.5 USDC Gateway deposit).`,
      );
    }

    // === 7. Verification summary.
    console.log("\n=== 7. Verification ===");
    const verify = await Promise.all([
      c.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM stations WHERE current_price_per_gallon IS NOT NULL`,
      ),
      c.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM stations
          WHERE consensus_confidence = 'high'
            AND last_priced_at > now() - interval '6 hours'`,
      ),
      c.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM stations WHERE active_bounty_usdc > 0`,
      ),
      c.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM parking_locations`,
      ),
      c.query<{ name: string; hours_ago: string }>(
        `SELECT name, EXTRACT(EPOCH FROM (now() - last_priced_at))/3600 AS hours_ago
           FROM parking_locations
          WHERE last_priced_at < now() - interval '12 hours'
          ORDER BY name`,
      ),
      c.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM reports WHERE user_wallet ~ $1`,
        [SYNTHETIC_PATTERN],
      ),
      c.query<{
        name: string;
        address: string;
        current_price_per_gallon: string;
      }>(
        `SELECT name, address, current_price_per_gallon FROM stations
          ORDER BY current_price_per_gallon ASC LIMIT 5`,
      ),
    ]);

    console.log(
      `  · stations with prices:                ${verify[0].rows[0].n} / ${STATIONS.length}`,
    );
    console.log(
      `  · stations 'high' confidence + fresh:  ${verify[1].rows[0].n}`,
    );
    console.log(
      `  · stations with active bounty (>0):    ${verify[2].rows[0].n}  (should be 0 for stake-free demo)`,
    );
    console.log(
      `  · parking locations total:             ${verify[3].rows[0].n} / ${PARKING.length}`,
    );
    console.log(`  · parking deliberately stale (>12h):`);
    for (const r of verify[4].rows) {
      console.log(`      - ${r.name}  ${Number(r.hours_ago).toFixed(1)}h ago`);
    }
    console.log(
      `  · synthetic demo reports in DB:        ${verify[5].rows[0].n}`,
    );
    console.log(`  · cheapest 5 stations (sanity check):`);
    for (const r of verify[6].rows) {
      console.log(
        `      $${Number(r.current_price_per_gallon).toFixed(2)}  ${r.name.padEnd(8)}  ${r.address}`,
      );
    }

    console.log("\n✓ Demo state seeded.");
    console.log("\nNext steps:");
    console.log("  · Visit https://www.gyasss.com (signed in as DEMO_WALLET)");
    console.log("  · Home page should surface Pacific Heights Valero ($5.85) as");
    console.log("    the best detour on the Pac Heights → 345 California commute");
    console.log("    (~$5-6 net savings after detour costs on a 12gal fillup).");
    console.log("  · /stats should show fresh activity if oqLast24h was healthy.");
    console.log("  · /parking should show 10 fresh + 2 stale (Civic Center, Lombard).\n");
  } finally {
    await c.end();
  }
}

main().catch((err) => {
  console.error("[seed-demo-state] failed:", err);
  process.exit(1);
});
