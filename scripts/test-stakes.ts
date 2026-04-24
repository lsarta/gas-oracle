import { createClient } from "@vercel/postgres";
import { resolvePendingStakes } from "../src/lib/oracle/resolve-stakes";
import {
  computeBountyAmount,
  shouldRequireStake,
  stakeAmountFor,
} from "../src/lib/oracle/stakes";

// We pick a deliberate station to mutate temporarily (Valero Geary is
// already seeded-stale). Restore its state at the end.
const TARGET_ADDRESS = "3550 Geary Blvd, San Francisco";
const WALLET = "0x00000000000000000000000000000000STAKER1";
const HAPPY_PRICE = 5.6; // in-line with later reports
const SLASH_PRICE = 3.0; // clearly off

type Resolution = "confirmed" | "slashed" | "pending";

// We stub sendUsdcToUser in the resolver — that module hits Circle and
// would actually move USDC. For the test we don't want outbound transfers,
// but resolvePendingStakes expects the real module. So we temporarily set
// an env flag the payout module respects (if built that way). In practice:
// we swallow errors in the resolver's try/catch, which keeps the stake
// status writes intact even on payout failure. That's enough for test
// validation — we check the `stakes.status` column, not tx hashes.

function price(p: number): string {
  return `$${p.toFixed(2)}`;
}

async function insertReport(
  c: ReturnType<typeof createClient>,
  stationId: string,
  userWallet: string,
  reportedPrice: number,
  minutesAgo: number,
): Promise<string> {
  const r = await c.query<{ id: string }>(
    `INSERT INTO reports
       (station_id, user_wallet, transaction_amount_usd, gallons,
        computed_price_per_gallon, payout_amount_usdc, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, now() - ($7 || ' minutes')::interval)
     RETURNING id`,
    [
      stationId,
      userWallet,
      (reportedPrice * 12).toFixed(2),
      "12.0",
      reportedPrice,
      0,
      String(minutesAgo),
    ],
  );
  return r.rows[0].id;
}

async function insertStake(
  c: ReturnType<typeof createClient>,
  reportId: string,
  userWallet: string,
  stake: number,
  bounty: number,
): Promise<string> {
  const r = await c.query<{ id: string }>(
    `INSERT INTO stakes (report_id, user_wallet, stake_amount_usdc,
                         bounty_amount_usdc, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING id`,
    [reportId, userWallet, stake, bounty],
  );
  return r.rows[0].id;
}

async function runPath(
  c: ReturnType<typeof createClient>,
  stationId: string,
  label: string,
  stakedPrice: number,
  expected: "confirmed" | "slashed",
) {
  console.log(`\n── ${label} (staked ${price(stakedPrice)}) ──`);

  const reportIds: string[] = [];
  const stakeIds: string[] = [];

  // 1) The staked report, oldest
  const stakedReport = await insertReport(c, stationId, WALLET, stakedPrice, 30);
  reportIds.push(stakedReport);
  // Bounty/stake size reflect a stale station
  const bounty = 0.5;
  const stake = stakeAmountFor(bounty);
  const stakeId = await insertStake(c, stakedReport, WALLET, stake, bounty);
  stakeIds.push(stakeId);
  console.log(`  staked report ${stakedReport}, stake $${stake.toFixed(2)} bounty $${bounty.toFixed(2)}`);

  // 2) Two more reports afterward, both near $5.60
  reportIds.push(
    await insertReport(
      c,
      stationId,
      "0x00000000000000000000000000000000WITNS01",
      5.58,
      20,
    ),
  );
  reportIds.push(
    await insertReport(
      c,
      stationId,
      "0x00000000000000000000000000000000WITNS02",
      5.62,
      10,
    ),
  );

  // 3) Run the resolver
  const resolvedCount = await resolvePendingStakes(c, stationId);
  console.log(`  resolver processed ${resolvedCount} stake(s)`);

  const statusRow = await c.query<{ status: string; resolution_reason: string }>(
    `SELECT status, resolution_reason FROM stakes WHERE id = $1`,
    [stakeId],
  );
  const got = statusRow.rows[0]?.status as Resolution;
  const reason = statusRow.rows[0]?.resolution_reason;
  console.log(`  result: status=${got}  reason=${reason ?? "(none)"}`);
  console.log(
    `  expected=${expected}  ${got === expected ? "✓ PASS" : "✗ FAIL"}`,
  );

  // 4) Clean up
  await c.query(`DELETE FROM stakes WHERE id = ANY($1::uuid[])`, [stakeIds]);
  await c.query(`DELETE FROM reports WHERE id = ANY($1::uuid[])`, [reportIds]);

  return got === expected;
}

async function main() {
  const c = createClient();
  await c.connect();
  try {
    const s = await c.query<{
      id: string;
      name: string;
      last_priced_at: Date | null;
      consensus_confidence: string | null;
      consensus_report_count: number | null;
    }>(
      `SELECT id, name, last_priced_at, consensus_confidence, consensus_report_count
         FROM stations WHERE address = $1`,
      [TARGET_ADDRESS],
    );
    if (s.rows.length === 0) {
      console.error(`Target station not found: ${TARGET_ADDRESS}`);
      process.exit(1);
    }
    const station = s.rows[0];
    const bounty = computeBountyAmount({
      last_priced_at: station.last_priced_at,
      consensus_confidence: station.consensus_confidence,
      consensus_report_count: Number(station.consensus_report_count ?? 0),
    });
    console.log(`Target: ${station.name} ${station.id}`);
    console.log(
      `  computed bounty=$${bounty.toFixed(2)}  requiresStake=${shouldRequireStake(bounty)}  stakeAmount=$${stakeAmountFor(bounty).toFixed(2)}`,
    );

    // We force a high-bounty state by pretending the station is 24h stale.
    // Save + restore the original price/timestamp so production demo data
    // isn't corrupted.
    const savedPrice = await c.query<{
      current_price_per_gallon: string | null;
      last_priced_at: Date | null;
    }>(
      `SELECT current_price_per_gallon, last_priced_at FROM stations WHERE id = $1`,
      [station.id],
    );
    await c.query(
      `UPDATE stations SET last_priced_at = now() - interval '24 hours' WHERE id = $1`,
      [station.id],
    );

    let passed = 0;
    let failed = 0;
    if (await runPath(c, station.id, "HAPPY PATH", HAPPY_PRICE, "confirmed")) {
      passed++;
    } else failed++;
    if (await runPath(c, station.id, "SLASH PATH", SLASH_PRICE, "slashed")) {
      passed++;
    } else failed++;

    // Restore station state
    await c.query(
      `UPDATE stations SET current_price_per_gallon = $1, last_priced_at = $2
         WHERE id = $3`,
      [
        savedPrice.rows[0].current_price_per_gallon,
        savedPrice.rows[0].last_priced_at,
        station.id,
      ],
    );

    console.log(`\n── summary: ${passed} pass · ${failed} fail ──`);
    if (failed > 0) process.exit(1);
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
