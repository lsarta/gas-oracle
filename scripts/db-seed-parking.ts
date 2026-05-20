import { createClient } from "@vercel/postgres";

export type SeedParking = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  hourly_rate: number;
  hours_ago: number;
  neighborhood: string;
};

// 12 real SF parking facilities. See gyasss-demo-data-spec.md.
// Daily-max rates are documented in the spec but the schema only
// stores hourly_rate, so they are not seeded here.
export const PARKING: SeedParking[] = [
  // SoMa / South Beach
  { name: "Soma Square Garage",     address: "333 3rd St, San Francisco",     lat: 37.7849, lng: -122.3998, hourly_rate: 8,  hours_ago: 0.5, neighborhood: "SoMa" },
  { name: "Moscone Center Garage",  address: "255 3rd St, San Francisco",     lat: 37.7843, lng: -122.4014, hourly_rate: 7,  hours_ago: 0.75, neighborhood: "SoMa" },
  { name: "5th & Mission Garage",   address: "833 Mission St, San Francisco", lat: 37.7843, lng: -122.4076, hourly_rate: 5,  hours_ago: 0.5, neighborhood: "SoMa" },
  { name: "Yerba Buena Garage",     address: "750 Howard St, San Francisco",  lat: 37.7842, lng: -122.4035, hourly_rate: 5,  hours_ago: 1.0, neighborhood: "SoMa" },

  // Union Square / FiDi / Tenderloin
  { name: "Union Square Garage",    address: "333 Post St, San Francisco",    lat: 37.7878, lng: -122.4078, hourly_rate: 6,  hours_ago: 0.75, neighborhood: "Union Square" },
  { name: "Sutter-Stockton Garage", address: "444 Stockton St, San Francisco", lat: 37.7896, lng: -122.4079, hourly_rate: 5,  hours_ago: 0.5, neighborhood: "Union Square" },
  { name: "Hilton SF Union Square", address: "333 O'Farrell St, San Francisco", lat: 37.7858, lng: -122.4112, hourly_rate: 14, hours_ago: 1.25, neighborhood: "Union Square" },

  // Civic Center
  { name: "Civic Center Garage",    address: "355 McAllister St, San Francisco", lat: 37.7800, lng: -122.4156, hourly_rate: 4, hours_ago: 18, neighborhood: "Civic Center" },
  { name: "Performing Arts Garage", address: "360 Grove St, San Francisco",      lat: 37.7780, lng: -122.4204, hourly_rate: 5, hours_ago: 1.0, neighborhood: "Civic Center" },

  // Fisherman's Wharf / North Beach
  { name: "Pier 39 Garage",         address: "2550 Powell St, San Francisco",    lat: 37.8090, lng: -122.4106, hourly_rate: 10, hours_ago: 0.5, neighborhood: "Fisherman's Wharf" },
  { name: "Lombard Garage",         address: "2055 Lombard St, San Francisco",   lat: 37.7997, lng: -122.4351, hourly_rate: 4,  hours_ago: 16, neighborhood: "Marina" },

  // Mission / Castro
  { name: "Mission-Bartlett Garage", address: "3255 21st St, San Francisco",     lat: 37.7574, lng: -122.4196, hourly_rate: 3, hours_ago: 1.0, neighborhood: "Mission" },
];

export async function seedParking(
  client: ReturnType<typeof createClient>,
): Promise<{ inserted: number; refreshed: number }> {
  let inserted = 0;
  let refreshed = 0;
  for (const p of PARKING) {
    const res = await client.query<{ id: string; inserted: boolean }>(
      `INSERT INTO parking_locations
         (name, address, lat, lng, current_hourly_rate, last_priced_at)
       VALUES ($1, $2, $3, $4, $5, now() - ($6 || ' hours')::interval)
       ON CONFLICT (name, address) DO UPDATE SET
         current_hourly_rate = EXCLUDED.current_hourly_rate,
         last_priced_at = EXCLUDED.last_priced_at
       RETURNING id, (xmax = 0) AS inserted`,
      [p.name, p.address, p.lat, p.lng, p.hourly_rate, String(p.hours_ago)],
    );
    if (res.rows[0]?.inserted) inserted++;
    else refreshed++;
  }
  return { inserted, refreshed };
}

async function main() {
  const client = createClient();
  await client.connect();
  try {
    const { inserted, refreshed } = await seedParking(client);
    console.log(
      `Parking seed complete: ${inserted} inserted, ${refreshed} refreshed (of ${PARKING.length}).`,
    );
  } finally {
    await client.end();
  }
}

const invokedDirectly = import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  main().catch((err) => {
    console.error("[db-seed-parking] failed:");
    console.error(err);
    process.exit(1);
  });
}
