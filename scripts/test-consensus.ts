import { createClient } from "@vercel/postgres";
import {
  computeConsensusPrice,
  isOutlier,
  type ReportRow,
} from "../src/lib/oracle/consensus";

const TARGET_ADDRESS = "3550 Geary Blvd, San Francisco";
const FAKE_USER_PREFIX = "0x0000000000000000000000000000000000";

type Fake = { price: number; minutesAgo: number };
const FAKES: Fake[] = [
  { price: 5.61, minutesAgo: 5 },
  { price: 5.58, minutesAgo: 12 },
  { price: 5.6, minutesAgo: 25 },
  { price: 5.63, minutesAgo: 55 },
  { price: 5.59, minutesAgo: 100 },
];

async function main() {
  const c = createClient();
  await c.connect();
  try {
    // 1) Find our target station.
    const s = await c.query<{ id: string; name: string; current_price_per_gallon: string | null }>(
      `SELECT id, name, current_price_per_gallon FROM stations WHERE address = $1`,
      [TARGET_ADDRESS],
    );
    if (s.rows.length === 0) {
      console.error(`Station not found: ${TARGET_ADDRESS}`);
      process.exit(1);
    }
    const station = s.rows[0];
    console.log(`Target station: ${station.name} (${station.id})`);
    console.log(`  current_price_per_gallon: ${station.current_price_per_gallon}\n`);

    // 2) Insert fake reports with controlled timestamps.
    const ids: string[] = [];
    for (let i = 0; i < FAKES.length; i++) {
      const f = FAKES[i];
      const wallet = `${FAKE_USER_PREFIX}${String(i + 1).padStart(6, "0")}`;
      const ins = await c.query<{ id: string }>(
        `INSERT INTO reports
           (station_id, user_wallet, transaction_amount_usd, gallons,
            computed_price_per_gallon, payout_amount_usdc, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, now() - ($7 || ' minutes')::interval)
         RETURNING id`,
        [
          station.id,
          wallet,
          (f.price * 12).toFixed(2),
          "12.0",
          f.price,
          0,
          String(f.minutesAgo),
        ],
      );
      ids.push(ins.rows[0].id);
      console.log(`  · inserted fake report #${i + 1}: $${f.price}/gal, ${f.minutesAgo}m ago`);
    }
    console.log();

    // 3) Load them back (mimics what the API does).
    const loaded = await c.query<{
      id: string;
      user_wallet: string;
      computed_price_per_gallon: string;
      created_at: Date;
    }>(
      `SELECT id, user_wallet, computed_price_per_gallon, created_at
         FROM reports WHERE id = ANY($1::uuid[]) ORDER BY created_at DESC`,
      [ids],
    );
    const rows: ReportRow[] = loaded.rows.map((r) => ({
      id: r.id,
      user_wallet: r.user_wallet,
      computed_price_per_gallon: Number(r.computed_price_per_gallon),
      created_at: r.created_at instanceof Date ? r.created_at : new Date(r.created_at),
    }));

    // 4) Compute consensus.
    const consensus = computeConsensusPrice(rows);
    console.log("Consensus (from fake reports):");
    console.log(`  consensusPrice: $${consensus.consensusPrice?.toFixed(3) ?? "null"}`);
    console.log(`  reportCount:    ${consensus.reportCount}`);
    console.log(`  confidence:     ${consensus.confidence}`);
    console.log(`  window:         ${consensus.windowMinutes}m\n`);

    // 5) Outlier checks.
    const near = 5.62;
    const far = 3.0;
    console.log("Outlier checks (threshold 15%):");
    console.log(
      `  $${near.toFixed(2)} → ${
        isOutlier(near, consensus) ? "OUTLIER" : "in-line"
      }`,
    );
    console.log(
      `  $${far.toFixed(2)} → ${
        isOutlier(far, consensus) ? "OUTLIER" : "in-line"
      }`,
    );

    // 6) Clean up.
    await c.query(`DELETE FROM reports WHERE id = ANY($1::uuid[])`, [ids]);
    console.log(`\nCleaned up ${ids.length} fake reports.`);
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
