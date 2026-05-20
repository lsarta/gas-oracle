import { createClient } from "@vercel/postgres";

export type SeedStation = {
  brand: string;
  address: string;
  lat: number;
  lng: number;
  price: number;
  hours_ago: number;
  neighborhood: string;
};

// 25 real SF gas stations. Prices anchored to mid-May 2026 SF metro
// average ($6.45/gal). See gyasss-demo-data-spec.md for calibration
// notes and the formula to re-anchor prices if SF average has shifted
// (e.g. Iran-related supply moves).
export const STATIONS: SeedStation[] = [
  // SoMa / FiDi
  { brand: "Shell",   address: "1340 Harrison St, San Francisco",  lat: 37.7720, lng: -122.4131, price: 6.79, hours_ago: 1.0, neighborhood: "SoMa" },
  { brand: "76",      address: "698 4th St, San Francisco",        lat: 37.7793, lng: -122.3974, price: 6.62, hours_ago: 0.5, neighborhood: "SoMa" },
  { brand: "Chevron", address: "333 8th St, San Francisco",        lat: 37.7745, lng: -122.4116, price: 6.69, hours_ago: 0.75, neighborhood: "SoMa" },
  { brand: "Shell",   address: "88 King St, San Francisco",        lat: 37.7782, lng: -122.3915, price: 6.85, hours_ago: 1.5, neighborhood: "South Beach" },

  // Mission / Castro / Noe Valley
  { brand: "ARCO",    address: "1798 Mission St, San Francisco",   lat: 37.7705, lng: -122.4196, price: 6.09, hours_ago: 0.5, neighborhood: "Mission" },
  { brand: "Shell",   address: "2501 Mission St, San Francisco",   lat: 37.7563, lng: -122.4189, price: 6.39, hours_ago: 1.0, neighborhood: "Mission" },
  { brand: "Chevron", address: "1298 Howard St, San Francisco",    lat: 37.7765, lng: -122.4116, price: 6.55, hours_ago: 0.75, neighborhood: "SoMa" },
  { brand: "76",      address: "4150 24th St, San Francisco",      lat: 37.7517, lng: -122.4286, price: 6.45, hours_ago: 1.25, neighborhood: "Noe Valley" },

  // Marina / Pacific Heights / Russian Hill
  { brand: "Chevron", address: "2399 Lombard St, San Francisco",   lat: 37.7990, lng: -122.4395, price: 6.69, hours_ago: 0.5, neighborhood: "Marina" },
  { brand: "Shell",   address: "2298 Lombard St, San Francisco",   lat: 37.7990, lng: -122.4378, price: 6.75, hours_ago: 0.75, neighborhood: "Marina" },
  { brand: "76",      address: "3001 Van Ness Ave, San Francisco", lat: 37.7995, lng: -122.4244, price: 6.59, hours_ago: 1.0, neighborhood: "Russian Hill" },
  { brand: "Valero",  address: "1798 Bush St, San Francisco",      lat: 37.7868, lng: -122.4267, price: 5.85, hours_ago: 0.5, neighborhood: "Pacific Heights" },

  // Western Addition / NoPa / Haight
  { brand: "Chevron", address: "1798 Divisadero St, San Francisco", lat: 37.7843, lng: -122.4396, price: 6.49, hours_ago: 0.75, neighborhood: "NoPa" },
  { brand: "76",      address: "1298 Fell St, San Francisco",       lat: 37.7727, lng: -122.4378, price: 6.42, hours_ago: 1.0, neighborhood: "Haight" },
  { brand: "Shell",   address: "1798 Geary Blvd, San Francisco",    lat: 37.7835, lng: -122.4344, price: 6.55, hours_ago: 0.5, neighborhood: "Western Addition" },

  // Richmond / Sunset
  { brand: "ARCO",    address: "1401 19th Ave, San Francisco",      lat: 37.7625, lng: -122.4760, price: 6.19, hours_ago: 1.0, neighborhood: "Inner Sunset" },
  { brand: "Chevron", address: "2895 Geary Blvd, San Francisco",    lat: 37.7826, lng: -122.4527, price: 6.45, hours_ago: 0.75, neighborhood: "Inner Richmond" },
  { brand: "Valero",  address: "4198 Geary Blvd, San Francisco",    lat: 37.7811, lng: -122.4642, price: 6.29, hours_ago: 1.25, neighborhood: "Central Richmond" },
  { brand: "76",      address: "4798 Geary Blvd, San Francisco",    lat: 37.7805, lng: -122.4750, price: 6.32, hours_ago: 0.5, neighborhood: "Outer Richmond" },
  { brand: "Shell",   address: "1798 Sloat Blvd, San Francisco",    lat: 37.7349, lng: -122.4844, price: 6.25, hours_ago: 1.0, neighborhood: "Outer Sunset" },

  // Bayview / Hunters Point / Excelsior
  { brand: "Valero",  address: "5298 3rd St, San Francisco",        lat: 37.7361, lng: -122.3905, price: 6.05, hours_ago: 0.75, neighborhood: "Bayview" },
  { brand: "ARCO",    address: "5499 Mission St, San Francisco",    lat: 37.7115, lng: -122.4422, price: 6.15, hours_ago: 1.0, neighborhood: "Excelsior" },
  { brand: "76",      address: "4798 Mission St, San Francisco",    lat: 37.7237, lng: -122.4359, price: 6.25, hours_ago: 0.5, neighborhood: "Outer Mission" },

  // Civic Center / Tenderloin / Hayes Valley
  { brand: "Chevron", address: "698 Fell St, San Francisco",        lat: 37.7745, lng: -122.4244, price: 6.52, hours_ago: 0.75, neighborhood: "Hayes Valley" },
  { brand: "Shell",   address: "798 Eddy St, San Francisco",        lat: 37.7818, lng: -122.4188, price: 6.59, hours_ago: 1.0, neighborhood: "Tenderloin" },
];

export async function seedStations(
  client: ReturnType<typeof createClient>,
): Promise<{ inserted: number; refreshed: number }> {
  let inserted = 0;
  let refreshed = 0;

  for (const s of STATIONS) {
    const res = await client.query<{ id: string; inserted: boolean }>(
      `INSERT INTO stations (name, address, lat, lng, current_price_per_gallon, last_priced_at)
       VALUES ($1, $2, $3, $4, $5, now() - ($6 || ' hours')::interval)
       ON CONFLICT ON CONSTRAINT stations_name_address_uniq DO UPDATE SET
         current_price_per_gallon = EXCLUDED.current_price_per_gallon,
         last_priced_at = EXCLUDED.last_priced_at
       RETURNING id, (xmax = 0) AS inserted`,
      [s.brand, s.address, s.lat, s.lng, s.price, String(s.hours_ago)],
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
    const { inserted, refreshed } = await seedStations(client);
    console.log(
      `Seed complete: ${inserted} inserted, ${refreshed} refreshed (of ${STATIONS.length}).`,
    );
  } finally {
    await client.end();
  }
}

const invokedDirectly = import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  main().catch((err) => {
    console.error("[db-seed] failed:");
    console.error(err);
    process.exit(1);
  });
}
