import { createClient } from "@vercel/postgres";

// Companion to seed-demo-state.ts. Removes synthetic demo rows
// (wallet matching `^0x0{30,}`) without touching real-user data,
// and resets parking timestamps so nothing reads as deliberately-stale.
//
// Useful when you want the DB back to "just-the-catalog" state without
// the demo-flavored noise — e.g. before pushing real-traffic changes.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/reset-demo-state.ts

const SYNTHETIC_PATTERN = "^0x0{30,}";

async function main() {
  const c = createClient();
  await c.connect();
  try {
    const stakes = await c.query(
      `DELETE FROM stakes WHERE user_wallet ~ $1`,
      [SYNTHETIC_PATTERN],
    );
    const reports = await c.query(
      `DELETE FROM reports WHERE user_wallet ~ $1`,
      [SYNTHETIC_PATTERN],
    );

    console.log(`Removed ${reports.rowCount} synthetic reports.`);
    console.log(`Removed ${stakes.rowCount} synthetic stakes.`);
    console.log(
      `\nNote: stations and parking_locations rows are preserved (they're the catalog).`,
    );
    console.log(
      `      To re-seed demo state, run: npm run db:seed:demo <DEMO_WALLET>`,
    );
  } finally {
    await c.end();
  }
}

main().catch((err) => {
  console.error("[reset-demo-state] failed:", err);
  process.exit(1);
});
