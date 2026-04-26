import { createClient } from "@vercel/postgres";

// All form-test reports share the same fingerprint: $42.18 amount (the
// ReportDialog's default placeholder) and produce low ($/gal) numbers
// for the gas vertical. Real fillups would have varied amounts.
//
// Restoring affected stations to their seed prices (matching scripts/db-seed.ts).
const SEED_PRICES: Record<string, { price: number; hoursAgo: number }> = {
  "3299 26th St, San Francisco": { price: 5.45, hoursAgo: 12 },
  "598 Bay St, San Francisco": { price: 5.69, hoursAgo: 14 },
  "1798 Mission St, San Francisco": { price: 4.97, hoursAgo: 4 },
};

async function main() {
  const c = createClient();
  await c.connect();
  try {
    // Identify the form-test reports causing low prices.
    const candidates = await c.query<{
      id: string;
      station_id: string;
      address: string;
      computed_price_per_gallon: string;
    }>(
      `SELECT r.id, r.station_id, s.address, r.computed_price_per_gallon
         FROM reports r JOIN stations s ON s.id = r.station_id
        WHERE r.transaction_amount_usd = 42.18
          AND r.computed_price_per_gallon < 4`,
    );
    console.log(`Form-test reports to remove: ${candidates.rows.length}`);
    for (const r of candidates.rows) {
      console.log(`  · ${r.address}  $${Number(r.computed_price_per_gallon).toFixed(2)}/gal`);
    }
    if (candidates.rows.length === 0) {
      console.log("Nothing to clean.");
    } else {
      const ids = candidates.rows.map((r) => r.id);
      const del = await c.query(
        `DELETE FROM reports WHERE id = ANY($1::uuid[])`,
        [ids],
      );
      console.log(`Deleted ${del.rowCount} reports.\n`);
    }

    // Restore the affected stations to seed prices.
    for (const [address, seed] of Object.entries(SEED_PRICES)) {
      const upd = await c.query(
        `UPDATE stations
           SET current_price_per_gallon = $1,
               last_priced_at = now() - ($2 || ' hours')::interval,
               consensus_confidence = NULL,
               consensus_report_count = 0
         WHERE address = $3
         RETURNING name`,
        [seed.price, String(seed.hoursAgo), address],
      );
      if (upd.rowCount && upd.rowCount > 0) {
        console.log(
          `  ✓ ${upd.rows[0].name} — ${address} → $${seed.price}/gal (${seed.hoursAgo}h ago)`,
        );
      }
    }

    // Final verification
    console.log(`\nFinal gas-station prices:`);
    const gas = await c.query<{
      name: string;
      address: string;
      current_price_per_gallon: string | null;
    }>(`SELECT name, address, current_price_per_gallon FROM stations
         ORDER BY current_price_per_gallon ASC NULLS LAST`);
    let bad = 0;
    for (const r of gas.rows) {
      const p = r.current_price_per_gallon === null ? null : Number(r.current_price_per_gallon);
      const flag = p === null ? "(null)" : p < 4 || p > 6 ? "  OUT-OF-RANGE" : "";
      console.log(
        `  ${r.name.padEnd(10)} ${r.address.slice(0, 32).padEnd(32)} ${p === null ? "—" : `$${p.toFixed(2)}`}${flag}`,
      );
      if (p !== null && (p < 4 || p > 6)) bad++;
    }
    console.log(`\n${bad} station(s) out-of-range.`);
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
