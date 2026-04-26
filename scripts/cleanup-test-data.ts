import { createClient } from "@vercel/postgres";
import { computeConsensusPrice, type ReportRow } from "../src/lib/oracle/consensus";

// A real Privy/EVM wallet is exactly 0x + 40 hex chars. Synthetic test
// wallets used in scripts/test-stakes.ts, scripts/test-consensus.ts, and
// scripts/seed-consensus-demo.ts have non-hex characters (STAKER, WITNS)
// or are nearly-all-zero (00...00000001).
//
// Identification rule: any wallet that doesn't match ^0x[0-9a-fA-F]{40}$
// OR has 30+ leading zeros after 0x (no real wallet looks like this).
const TEST_WALLET_PREDICATE = `(
  user_wallet !~ '^0x[0-9a-fA-F]{40}$'
  OR user_wallet ~ '^0x0{30,}'
)`;

async function main() {
  const c = createClient();
  await c.connect();
  try {
    // ---- 1. Identify
    const ids = await c.query<{ user_wallet: string; n: string }>(
      `SELECT user_wallet, COUNT(*)::text AS n
         FROM reports
        WHERE ${TEST_WALLET_PREDICATE}
        GROUP BY user_wallet
        ORDER BY n DESC`,
    );
    console.log(`Synthetic wallets found in reports: ${ids.rows.length}`);
    for (const r of ids.rows) console.log(`  · ${r.user_wallet}  (${r.n} reports)`);

    if (ids.rows.length === 0) {
      console.log("Nothing to clean.");
      return;
    }

    // ---- 2. Capture affected stations BEFORE deletion (for recompute later)
    const affectedStations = await c.query<{ station_id: string; name: string }>(
      `SELECT DISTINCT s.id AS station_id, s.name
         FROM reports r JOIN stations s ON s.id = r.station_id
        WHERE ${TEST_WALLET_PREDICATE.replace(/user_wallet/g, "r.user_wallet")}`,
    );
    console.log(`\nAffected stations: ${affectedStations.rows.length}`);

    // ---- 3. Delete (stakes are FK-on-delete-cascade from reports, so the
    //         reports DELETE removes their stakes; we also explicitly clear
    //         any orphaned stakes that match the test-wallet pattern.)
    const delSavings = await c.query(
      `DELETE FROM savings_events WHERE ${TEST_WALLET_PREDICATE}`,
    );
    console.log(`\nDeleted ${delSavings.rowCount ?? 0} savings_events`);

    const delStakes = await c.query(
      `DELETE FROM stakes WHERE ${TEST_WALLET_PREDICATE}`,
    );
    console.log(`Deleted ${delStakes.rowCount ?? 0} stakes (test-wallet match)`);

    const delReports = await c.query(
      `DELETE FROM reports WHERE ${TEST_WALLET_PREDICATE}`,
    );
    console.log(`Deleted ${delReports.rowCount ?? 0} reports`);

    // ---- 4. Recompute consensus + update station price for each affected
    console.log(`\nRecomputing consensus for ${affectedStations.rows.length} station(s)…`);
    for (const s of affectedStations.rows) {
      const rep = await c.query<{
        id: string;
        user_wallet: string;
        computed_price_per_gallon: string;
        created_at: Date;
      }>(
        `SELECT id, user_wallet, computed_price_per_gallon, created_at
           FROM reports
          WHERE station_id = $1 AND computed_price_per_gallon IS NOT NULL
          ORDER BY created_at DESC LIMIT 30`,
        [s.station_id],
      );
      const rows: ReportRow[] = rep.rows.map((r) => ({
        id: r.id,
        user_wallet: r.user_wallet,
        computed_price_per_gallon: Number(r.computed_price_per_gallon),
        created_at: r.created_at instanceof Date ? r.created_at : new Date(r.created_at),
      }));
      const cons = computeConsensusPrice(rows);

      if (cons.consensusPrice === null) {
        // No real reports left — leave the station's current_price_per_gallon
        // alone (whatever the seed set), but reset the consensus metadata
        // so the UI doesn't claim confidence we don't have.
        await c.query(
          `UPDATE stations SET consensus_confidence = NULL, consensus_report_count = 0
             WHERE id = $1`,
          [s.station_id],
        );
        console.log(`  · ${s.name}: no real reports left, kept seed price, cleared metadata`);
      } else {
        await c.query(
          `UPDATE stations
             SET current_price_per_gallon = $1,
                 consensus_confidence = $2,
                 consensus_report_count = $3
           WHERE id = $4`,
          [cons.consensusPrice, cons.confidence, cons.reportCount, s.station_id],
        );
        console.log(
          `  · ${s.name}: → $${cons.consensusPrice.toFixed(2)}/gal, ${cons.confidence}, n=${cons.reportCount}`,
        );
      }
    }

    // ---- 5. Verify visible price ranges
    console.log(`\nVerification — gas station prices (should be $4–6/gal):`);
    const gasCheck = await c.query<{
      name: string;
      address: string;
      current_price_per_gallon: string | null;
    }>(
      `SELECT name, address, current_price_per_gallon FROM stations
         ORDER BY current_price_per_gallon ASC NULLS LAST`,
    );
    let outOfRange = 0;
    for (const r of gasCheck.rows) {
      const p = r.current_price_per_gallon === null ? null : Number(r.current_price_per_gallon);
      const flag = p === null ? "(null)" : p < 4 || p > 6 ? "  OUT-OF-RANGE" : "";
      console.log(`  ${r.name.padEnd(10)} ${r.address.slice(0, 32).padEnd(32)} ${p === null ? "—" : `$${p.toFixed(2)}`}${flag}`);
      if (p !== null && (p < 4 || p > 6)) outOfRange++;
    }
    console.log(`\n${outOfRange} station(s) outside $4–6/gal range.`);

    const parkCheck = await c.query<{
      name: string;
      current_hourly_rate: string | null;
    }>(`SELECT name, current_hourly_rate FROM parking_locations ORDER BY current_hourly_rate ASC`);
    console.log(`\nParking rates (should be $5–15/hr):`);
    for (const r of parkCheck.rows) {
      const p = r.current_hourly_rate === null ? null : Number(r.current_hourly_rate);
      console.log(`  ${r.name.padEnd(28)} ${p === null ? "—" : `$${p.toFixed(2)}/hr`}`);
    }
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
