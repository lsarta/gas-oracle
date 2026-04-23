import { createClient } from "@vercel/postgres";

type SeedStation = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  price: number;
  hours_ago: number;
};

const STATIONS: SeedStation[] = [
  { name: "Arco",    address: "1798 Mission St, San Francisco",      lat: 37.7693, lng: -122.4198, price: 4.97, hours_ago: 4 },
  { name: "Arco",    address: "2198 Carroll Ave, San Francisco",     lat: 37.7322, lng: -122.3961, price: 5.05, hours_ago: 6 },
  { name: "Chevron", address: "3299 26th St, San Francisco",         lat: 37.7491, lng: -122.4148, price: 5.45, hours_ago: 12 },
  { name: "Shell",   address: "1395 Bryant St, San Francisco",       lat: 37.7716, lng: -122.4099, price: 5.39, hours_ago: 2 },
  { name: "76",      address: "1500 Cesar Chavez St, San Francisco", lat: 37.7484, lng: -122.4128, price: 5.29, hours_ago: 0.5 },
  { name: "Chevron", address: "2401 Lombard St, San Francisco",      lat: 37.7991, lng: -122.4378, price: 5.59, hours_ago: 8 },
  { name: "Valero",  address: "3550 Geary Blvd, San Francisco",      lat: 37.7811, lng: -122.4541, price: 5.19, hours_ago: 24 },
  { name: "Arco",    address: "1500 Sloat Blvd, San Francisco",      lat: 37.7349, lng: -122.4926, price: 5.09, hours_ago: 1 },
  // Stale-priced opportunities (>12h) — seed the demo with high-bounty stations.
  { name: "76",      address: "699 Battery St, San Francisco",        lat: 37.7964, lng: -122.4007, price: 5.79, hours_ago: 18 },
  { name: "Shell",   address: "2300 16th St, San Francisco",          lat: 37.7654, lng: -122.4099, price: 5.49, hours_ago: 30 },
  { name: "Chevron", address: "598 Bay St, San Francisco",            lat: 37.8053, lng: -122.4135, price: 5.69, hours_ago: 14 },
  { name: "Valero",  address: "699 Divisadero St, San Francisco",     lat: 37.7762, lng: -122.4377, price: 5.35, hours_ago: 26 },
  { name: "Arco",    address: "850 Bryant St, San Francisco",         lat: 37.7752, lng: -122.4035, price: 5.15, hours_ago: 36 },
];

async function main() {
  const client = createClient();
  await client.connect();

  let inserted = 0;
  let skipped = 0;

  try {
    for (const s of STATIONS) {
      const res = await client.query(
        `INSERT INTO stations (name, address, lat, lng, current_price_per_gallon, last_priced_at)
         VALUES ($1, $2, $3, $4, $5, now() - ($6 || ' hours')::interval)
         ON CONFLICT ON CONSTRAINT stations_name_address_uniq DO NOTHING
         RETURNING id`,
        [s.name, s.address, s.lat, s.lng, s.price, String(s.hours_ago)],
      );
      if (res.rowCount && res.rowCount > 0) {
        console.log(`  ✓ inserted: ${s.name} — ${s.address}  ($${s.price}, ${s.hours_ago}h ago)`);
        inserted++;
      } else {
        console.log(`  · skipped (already exists): ${s.name} — ${s.address}`);
        skipped++;
      }
    }
    console.log(`\nSeed complete: ${inserted} inserted, ${skipped} skipped (of ${STATIONS.length}).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[db-seed] failed:");
  console.error(err);
  process.exit(1);
});
