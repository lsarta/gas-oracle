import { createClient } from "@vercel/postgres";

type Seed = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  rate: number;
  hours_ago: number;
};

const LOCATIONS: Seed[] = [
  { name: "5th & Mission Garage",   address: "833 Mission St, SF",          lat: 37.7849, lng: -122.4055, rate: 12.0, hours_ago: 1 },
  { name: "SoMa Lot",               address: "475 5th St, SF",              lat: 37.7811, lng: -122.4015, rate:  8.0, hours_ago: 3 },
  { name: "Union Square Garage",    address: "333 Post St, SF",             lat: 37.7886, lng: -122.4076, rate: 15.0, hours_ago: 0.5 },
  { name: "Embarcadero Center",     address: "1 Embarcadero Center, SF",    lat: 37.7949, lng: -122.3994, rate: 14.0, hours_ago: 6 },
  { name: "Civic Center Plaza",     address: "355 McAllister St, SF",       lat: 37.7805, lng: -122.4180, rate: 10.0, hours_ago: 12 },
  { name: "Mission St Meter",       address: "2400 Mission St, SF",         lat: 37.7592, lng: -122.4187, rate:  5.5, hours_ago: 8 },
];

async function main() {
  const client = createClient();
  await client.connect();
  let inserted = 0;
  let skipped = 0;
  try {
    for (const p of LOCATIONS) {
      const res = await client.query(
        `INSERT INTO parking_locations
           (name, address, lat, lng, current_hourly_rate, last_priced_at)
         VALUES ($1, $2, $3, $4, $5, now() - ($6 || ' hours')::interval)
         ON CONFLICT (name, address) DO NOTHING
         RETURNING id`,
        [p.name, p.address, p.lat, p.lng, p.rate, String(p.hours_ago)],
      );
      if (res.rowCount && res.rowCount > 0) {
        console.log(`  ✓ inserted: ${p.name} — $${p.rate}/hr (${p.hours_ago}h ago)`);
        inserted++;
      } else {
        console.log(`  · skipped (already exists): ${p.name}`);
        skipped++;
      }
    }
    console.log(`\nParking seed complete: ${inserted} inserted, ${skipped} skipped (of ${LOCATIONS.length}).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[db-seed-parking] failed:");
  console.error(err);
  process.exit(1);
});
