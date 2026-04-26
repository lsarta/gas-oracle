import { createClient } from "@vercel/postgres";

// Demo: drive from 1 Steuart St (Embarcadero) to MindsDB
// (3154 17th St, Mission). Route is ~3 mi southwest through SoMa.
//
// We make Shell at 1395 Bryant St the bargain. It sits well on the
// SoMa segment of that route — a real "cheaper gas DURING your
// commute" story, not just "near your destination."
//
// We also bump every other station's "freshness" so the engine prefers
// the recently-confirmed bargain over older data.

const COMMUTE = {
  home: { lat: 37.7937, lng: -122.3935, address: "1 Steuart St, San Francisco, CA 94105" },
  work: { lat: 37.7635, lng: -122.4145, address: "3154 17th St, San Francisco, CA 94110" },
};

const BARGAIN = {
  address: "1395 Bryant St, San Francisco",
  price: 4.39,
  hoursAgo: 0.08, // ~5 min
  confidence: "high" as const,
  reportCount: 3,
};

// Ensure neighbors aren't *also* in bargain territory so the contrast is clear.
const NEIGHBORS_FLOOR = 5.05;

async function main() {
  const wallet = process.argv[2];
  if (!wallet) {
    console.log(
      "Tip: pass a wallet address to also set your home + work, e.g.\n" +
        "  npx tsx --env-file=.env.local scripts/seed-demo-commute.ts 0x...\n",
    );
  }

  const c = createClient();
  await c.connect();
  try {
    // 1) Bargain station
    const b = await c.query(
      `UPDATE stations
         SET current_price_per_gallon = $1,
             last_priced_at = now() - ($2 || ' hours')::interval,
             consensus_confidence = $3,
             consensus_report_count = $4
       WHERE address = $5
       RETURNING name, address, current_price_per_gallon`,
      [
        BARGAIN.price,
        String(BARGAIN.hoursAgo),
        BARGAIN.confidence,
        BARGAIN.reportCount,
        BARGAIN.address,
      ],
    );
    if (b.rowCount === 0) {
      console.error(`Station not found: ${BARGAIN.address}`);
      process.exit(1);
    }
    console.log(
      `BARGAIN: ${b.rows[0].name} — ${b.rows[0].address}  →  $${BARGAIN.price}/gal (${BARGAIN.confidence} confidence, ${BARGAIN.reportCount} reports, ~5min ago)\n`,
    );

    // 2) Floor every other station's price so the contrast holds.
    //    Also re-stamp last_priced_at to ~6 hours ago so they look "stale-ish"
    //    but not so stale they get a bounty (>12h triggers $0.50 bounty,
    //    which would fight with the bargain narrative).
    const others = await c.query(
      `UPDATE stations
         SET current_price_per_gallon = GREATEST(current_price_per_gallon, $1),
             last_priced_at = now() - interval '6 hours',
             consensus_confidence = 'medium',
             consensus_report_count = 2
       WHERE address <> $2
         AND current_price_per_gallon IS NOT NULL
       RETURNING name, address, current_price_per_gallon`,
      [NEIGHBORS_FLOOR, BARGAIN.address],
    );
    console.log(`Floored ${others.rowCount} neighbors at $${NEIGHBORS_FLOOR}/gal+, marked 6h-stale medium-confidence.`);

    // 3) Optional: set home + work for a specific wallet
    if (wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      const u = await c.query(
        `UPDATE users
           SET home_lat = $1, home_lng = $2, home_address = $3,
               work_lat = $4, work_lng = $5, work_address = $6
         WHERE wallet_address = $7
         RETURNING wallet_address`,
        [
          COMMUTE.home.lat, COMMUTE.home.lng, COMMUTE.home.address,
          COMMUTE.work.lat, COMMUTE.work.lng, COMMUTE.work.address,
          wallet,
        ],
      );
      if (u.rowCount && u.rowCount > 0) {
        console.log(
          `\nUser ${wallet.slice(0, 10)}…${wallet.slice(-6)}: home → Steuart St, work → MindsDB`,
        );
      } else {
        console.log(
          `\n(Wallet ${wallet} not found in users table — sign in once to create the row, then re-run.)`,
        );
      }
    }

    // 4) Verify final state
    console.log(`\nFinal price ladder (cheapest first):`);
    const all = await c.query<{
      name: string; address: string; current_price_per_gallon: string; consensus_confidence: string | null;
    }>(
      `SELECT name, address, current_price_per_gallon, consensus_confidence
         FROM stations WHERE current_price_per_gallon IS NOT NULL
         ORDER BY current_price_per_gallon ASC LIMIT 6`,
    );
    for (const r of all.rows) {
      const tag = r.address === BARGAIN.address ? "  ← BARGAIN" : "";
      console.log(
        `  $${Number(r.current_price_per_gallon).toFixed(2)}  ${r.name.padEnd(8)}  ${r.address.padEnd(36)}  ${r.consensus_confidence}${tag}`,
      );
    }
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
