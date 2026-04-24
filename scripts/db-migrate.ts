import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { createClient } from "@vercel/postgres";

const SCHEMA_PATH = resolve(process.cwd(), "src/lib/db/schema.sql");
const MIGRATIONS_DIR = resolve(process.cwd(), "scripts/migrations");

const stripLeadingComments = (s: string) =>
  s.replace(/^(?:\s*(?:--[^\n]*)?\n)+/g, "").trim();

function splitStatements(raw: string): string[] {
  return raw
    .split(/;\s*\n/)
    .map(stripLeadingComments)
    .filter((s) => s.length > 0);
}

async function ensureMigrationsTable(client: ReturnType<typeof createClient>) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function getApplied(client: ReturnType<typeof createClient>): Promise<Set<string>> {
  const r = await client.query<{ name: string }>(`SELECT name FROM _migrations`);
  return new Set(r.rows.map((x) => x.name));
}

async function applySchema(client: ReturnType<typeof createClient>) {
  if (!existsSync(SCHEMA_PATH)) {
    console.log("(no schema.sql found, skipping legacy schema apply)");
    return;
  }
  const raw = readFileSync(SCHEMA_PATH, "utf8");
  const statements = splitStatements(raw);
  console.log(`Applying base schema (${statements.length} statements, idempotent)...`);
  let i = 0;
  for (const stmt of statements) {
    i++;
    const preview = stmt.split("\n")[0].slice(0, 70);
    try {
      await client.query(stmt);
      console.log(`  ✓ [${i}/${statements.length}] ${preview}`);
    } catch (err) {
      console.error(`  ✗ [${i}/${statements.length}] ${preview}`);
      throw err;
    }
  }
}

async function applyMigrations(client: ReturnType<typeof createClient>) {
  if (!existsSync(MIGRATIONS_DIR)) {
    console.log("(no migrations dir, skipping)");
    return;
  }
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  if (files.length === 0) {
    console.log("(no migration files)");
    return;
  }

  const applied = await getApplied(client);
  console.log(`\nDiscovered ${files.length} migration file(s):`);
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  · skipped (already applied): ${file}`);
      continue;
    }
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    try {
      // Multi-statement queries work over simple-query protocol when no params are bound.
      await client.query(sql);
      await client.query(`INSERT INTO _migrations (name) VALUES ($1)`, [file]);
      console.log(`  ✓ applied: ${file}`);
    } catch (err) {
      console.error(`  ✗ failed: ${file}`);
      throw err;
    }
  }
}

async function main() {
  const client = createClient();
  await client.connect();
  try {
    console.log(`Connected to ${client.host}`);
    await applySchema(client);
    await ensureMigrationsTable(client);
    await applyMigrations(client);
    console.log("\nMigrate complete.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[db-migrate] failed:");
  console.error(err);
  process.exit(1);
});
