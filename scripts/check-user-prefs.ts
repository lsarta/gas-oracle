import { createClient } from "@vercel/postgres";
async function main() {
  const c = createClient();
  await c.connect();
  const u = await c.query(
    `SELECT wallet_address, home_lat, home_lng, work_lat, work_lng,
            hourly_value_usd, avg_mpg, typical_fillup_gallons, created_at
       FROM users ORDER BY created_at DESC LIMIT 5`
  );
  console.log(JSON.stringify(u.rows, null, 2));
  await c.end();
}
main().catch((e)=>{console.error(e); process.exit(1);});
