import { createClient } from "@vercel/postgres";

const TARGET_ADDRESS = "2401 Lombard St, San Francisco";
const WALLET_PREFIX = "0x0000000000000000000000000000000000";

const FAKES = [
  { price: 5.58, minutesAgo: 8 },
  { price: 5.6, minutesAgo: 22 },
  { price: 5.59, minutesAgo: 40 },
];

async function main() {
  const c = createClient();
  await c.connect();
  try {
    const s = await c.query<{ id: string; name: string }>(
      `SELECT id, name FROM stations WHERE address = $1`,
      [TARGET_ADDRESS],
    );
    if (s.rows.length === 0) {
      console.error(`Station not found: ${TARGET_ADDRESS}`);
      process.exit(1);
    }
    const station = s.rows[0];
    console.log(`Seeding 3 consensus-demo reports on ${station.name}.`);

    for (let i = 0; i < FAKES.length; i++) {
      const f = FAKES[i];
      const wallet = `${WALLET_PREFIX}${String(i + 100).padStart(6, "0")}`;
      await c.query(
        `INSERT INTO reports
           (station_id, user_wallet, transaction_amount_usd, gallons,
            computed_price_per_gallon, payout_amount_usdc, created_at,
            was_outlier)
         VALUES ($1, $2, $3, $4, $5, $6, now() - ($7 || ' minutes')::interval, false)
         ON CONFLICT DO NOTHING`,
        [
          station.id,
          wallet,
          (f.price * 12).toFixed(2),
          "12.0",
          f.price,
          0,
          String(f.minutesAgo),
        ],
      );
    }

    // Set station's price + consensus metadata so the map reflects it.
    await c.query(
      `UPDATE stations
         SET current_price_per_gallon = 5.59,
             last_priced_at = now() - interval '8 minutes',
             consensus_confidence = 'high',
             consensus_report_count = 3
       WHERE id = $1`,
      [station.id],
    );

    console.log(`Demo ready. Submit an outlier report on ${station.name} (try $3.00/gal).`);
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
