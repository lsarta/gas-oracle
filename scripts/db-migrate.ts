import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@vercel/postgres";

async function main() {
  const sqlPath = resolve(process.cwd(), "src/lib/db/schema.sql");
  const raw = readFileSync(sqlPath, "utf8");

  // Split on semicolons that end a line. Our schema has no strings containing ';'.
  // Strip leading comment lines + blanks per chunk; keep the rest.
  const stripLeadingComments = (s: string) =>
    s.replace(/^(?:\s*(?:--[^\n]*)?\n)+/g, "").trim();

  const statements = raw
    .split(/;\s*\n/)
    .map(stripLeadingComments)
    .filter((s) => s.length > 0);

  const client = createClient();
  await client.connect();

  console.log(`Running ${statements.length} statements against ${client.host}...`);

  let i = 0;
  try {
    for (const stmt of statements) {
      i++;
      const preview = stmt.split("\n")[0].slice(0, 70);
      try {
        await client.query(stmt);
        console.log(`  ✓ [${i}/${statements.length}] ${preview}`);
      } catch (err) {
        console.error(`  ✗ [${i}/${statements.length}] ${preview}`);
        console.error(`    SQL:\n${stmt}`);
        throw err;
      }
    }
    console.log("\nAll statements applied.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[db-migrate] failed:");
  console.error(err);
  process.exit(1);
});
