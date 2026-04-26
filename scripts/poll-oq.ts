import { createClient } from "@vercel/postgres";
async function main() {
  const c = createClient(); await c.connect();
  let last = -1;
  for (let i = 0; i < 30; i++) {
    const r = await c.query(`SELECT COUNT(*)::int n, MAX(created_at) latest FROM oracle_queries WHERE created_at > now() - interval '5 minutes'`);
    const n = r.rows[0].n;
    const latest = r.rows[0].latest;
    if (n !== last) {
      console.log(`[${new Date().toISOString().slice(11,19)}] oracle_queries(5min)=${n}  latest=${latest ? new Date(latest).toISOString().slice(11,19) : '—'}`);
      last = n;
    }
    await new Promise(r => setTimeout(r, 15000));
  }
  await c.end();
}
main().catch(e => { console.error(e); process.exit(1); });
