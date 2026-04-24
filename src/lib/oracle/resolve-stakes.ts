import type { createClient } from "@vercel/postgres";
import { isWithinTolerance } from "@/lib/oracle/stakes";
import { sendUsdcToUser } from "@/lib/circle/payout";

type DbClient = ReturnType<typeof createClient>;

const REPORTS_AFTER_REQUIRED = 2;

/** Resolve pending stakes for a given station. Called after each new report
 *  hits POST /api/reports. A pending stake resolves once 2 more reports have
 *  landed after the staked one.
 *
 *  Confirmation: the staked report's price is within 5% of the average of
 *  the 3 most recent reports (staked + 2 after).
 *  Slash: outside 5%. No stake return; user gets nothing beyond the
 *  already-halved cashback that landed when the outlier was detected. */
export async function resolvePendingStakes(
  client: DbClient,
  stationId: string,
): Promise<number> {
  // Find all pending stakes whose staked report has at least 2 newer reports
  // on the same station.
  const pending = await client.query<{
    stake_id: string;
    user_wallet: string;
    stake_amount: string;
    bounty_amount: string;
    staked_report_id: string;
    staked_price: string;
    staked_created_at: Date;
    newer_reports: string; // count, as text (pg returns bigints as text)
  }>(
    `SELECT
       s.id AS stake_id,
       s.user_wallet,
       s.stake_amount_usdc AS stake_amount,
       s.bounty_amount_usdc AS bounty_amount,
       s.report_id AS staked_report_id,
       r.computed_price_per_gallon AS staked_price,
       r.created_at AS staked_created_at,
       (SELECT COUNT(*) FROM reports r2
          WHERE r2.station_id = r.station_id
            AND r2.created_at > r.created_at
            AND r2.id != r.id) AS newer_reports
     FROM stakes s
     JOIN reports r ON r.id = s.report_id
     WHERE s.status = 'pending'
       AND r.station_id = $1`,
    [stationId],
  );

  let resolved = 0;

  for (const row of pending.rows) {
    if (Number(row.newer_reports) < REPORTS_AFTER_REQUIRED) continue;

    // Fetch the staked report + the 2 newer ones (oldest→newest of the newers).
    const three = await client.query<{ computed_price_per_gallon: string }>(
      `(SELECT computed_price_per_gallon FROM reports WHERE id = $1)
       UNION ALL
       (SELECT computed_price_per_gallon FROM reports
          WHERE station_id = (SELECT station_id FROM reports WHERE id = $1)
            AND created_at > $2
          ORDER BY created_at ASC
          LIMIT ${REPORTS_AFTER_REQUIRED})`,
      [row.staked_report_id, row.staked_created_at],
    );
    if (three.rows.length < REPORTS_AFTER_REQUIRED + 1) continue;

    const prices = three.rows.map((r) => Number(r.computed_price_per_gallon));
    const miniConsensus = prices.reduce((a, b) => a + b, 0) / prices.length;
    const stakedPrice = Number(row.staked_price);
    const confirmed = isWithinTolerance(stakedPrice, miniConsensus);

    const stakeAmount = Number(row.stake_amount);
    const bountyAmount = Number(row.bounty_amount);

    if (confirmed) {
      const payout = Math.round((stakeAmount + bountyAmount) * 1_000_000) / 1_000_000;
      let txHash: string | null = null;
      let txError: string | null = null;
      try {
        const r = await sendUsdcToUser(row.user_wallet as `0x${string}`, payout);
        txHash = r.txHash;
      } catch (err) {
        txError = err instanceof Error ? err.message : String(err);
        console.warn(
          `[resolve-stakes] confirm payout failed for stake ${row.stake_id}:`,
          txError,
        );
      }
      await client.query(
        `UPDATE stakes
           SET status = 'confirmed',
               resolved_at = now(),
               resolution_reason = $1
         WHERE id = $2`,
        [
          txError
            ? `confirmed, payout pending: ${txError}`
            : `confirmed via mini-consensus $${miniConsensus.toFixed(3)}; tx ${txHash}`,
          row.stake_id,
        ],
      );
      // Credit the confirmation payout to the user's lifetime earnings.
      if (!txError) {
        await client.query(
          `UPDATE users SET total_earned_usdc = total_earned_usdc + $1
             WHERE wallet_address = $2`,
          [payout, row.user_wallet],
        );
      }
    } else {
      // Slashed — stake stays with master wallet; no outbound transfer.
      await client.query(
        `UPDATE stakes
           SET status = 'slashed',
               resolved_at = now(),
               resolution_reason = $1
         WHERE id = $2`,
        [
          `slashed: staked $${stakedPrice.toFixed(3)} vs mini-consensus $${miniConsensus.toFixed(3)}`,
          row.stake_id,
        ],
      );
    }
    resolved++;
  }

  return resolved;
}
