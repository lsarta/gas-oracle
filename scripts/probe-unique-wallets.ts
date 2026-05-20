import { createClient } from "@vercel/postgres";

async function main() {
  const c = createClient();
  await c.connect();
  try {
    for (const window of [
      ["24h", "24 hours"],
      ["7d", "7 days"],
      ["30d", "30 days"],
      ["all", null],
    ] as const) {
      const whereClause = window[1]
        ? `WHERE created_at >= NOW() - INTERVAL '${window[1]}'`
        : "";
      const { rows } = await c.query(
        `SELECT caller_address, COUNT(*) AS n, MAX(created_at) AS last_seen
           FROM oracle_queries
           ${whereClause}
           GROUP BY caller_address
           ORDER BY n DESC`,
      );
      console.log(`\n=== last ${window[0]}: ${rows.length} unique caller(s) ===`);
      for (const r of rows) {
        console.log(
          `  ${r.caller_address}  count=${r.n}  last=${r.last_seen?.toISOString()}`,
        );
      }
    }
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
