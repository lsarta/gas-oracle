import { createClient } from "@vercel/postgres";

// Read-only DB snapshot. Prints row counts useful for pre/post diffs
// around seed scripts. Safe to run any time — performs no writes.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/db-snapshot.ts

const SYNTHETIC_PATTERN = "^0x0{30,}";

async function main() {
  const c = createClient();
  await c.connect();
  try {
    const results = await Promise.all([
      c.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM stations`),
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
      c.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM parking_locations`),
      c.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM parking_locations
          WHERE last_priced_at < now() - interval '12 hours'`,
      ),
      c.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM reports`),
      c.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM reports WHERE user_wallet ~ $1`,
        [SYNTHETIC_PATTERN],
      ),
      c.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM reports
          WHERE created_at > now() - interval '2 hours'`,
      ),
      c.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM oracle_queries`),
      c.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM oracle_queries
          WHERE created_at > now() - interval '24 hours'`,
      ),
      c.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM stakes`),
      c.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM stakes WHERE status = 'pending'`,
      ),
      c.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM users`),
    ]);

    const [
      stTotal,
      stWithPrice,
      stHighFresh,
      stWithBounty,
      pkTotal,
      pkStale,
      rpTotal,
      rpSynth,
      rpRecent2h,
      oqTotal,
      oqLast24h,
      stkTotal,
      stkPending,
      uTotal,
    ] = results.map((r) => Number(r.rows[0].n));

    const ts = new Date().toISOString();
    console.log(`\n--- DB snapshot @ ${ts} ---`);
    console.log(`stations:`);
    console.log(`  total                          ${stTotal}`);
    console.log(`  with price                     ${stWithPrice}`);
    console.log(`  'high' confidence + fresh<=6h  ${stHighFresh}`);
    console.log(`  active_bounty>0                ${stWithBounty}`);
    console.log(`parking_locations:`);
    console.log(`  total                          ${pkTotal}`);
    console.log(`  stale (>12h)                   ${pkStale}`);
    console.log(`reports:`);
    console.log(`  total                          ${rpTotal}`);
    console.log(`  synthetic (0x0...)             ${rpSynth}`);
    console.log(`  real-or-synth in last 2h       ${rpRecent2h}`);
    console.log(`oracle_queries:`);
    console.log(`  total                          ${oqTotal}`);
    console.log(`  last 24h                       ${oqLast24h}`);
    console.log(`stakes:`);
    console.log(`  total                          ${stkTotal}`);
    console.log(`  pending                        ${stkPending}`);
    console.log(`users:`);
    console.log(`  total                          ${uTotal}`);
    console.log(``);
  } finally {
    await c.end();
  }
}

main().catch((err) => {
  console.error("[db-snapshot] failed:", err);
  process.exit(1);
});
