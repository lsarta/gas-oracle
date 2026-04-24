import { createClient } from "@vercel/postgres";
import { recommendStation, type Station, type UserProfile } from "../src/lib/oracle/recommend";
import { computeDetour } from "../src/lib/routing";
import { medianPrice, estimateSavings } from "../src/lib/oracle/savings";

// Test user: 235 Valencia St (home) → 645 Mission St (work), realistic SF commute.
const TEST_USER: UserProfile = {
  homeLat: 37.7649,
  homeLng: -122.4220,
  workLat: 37.7875,
  workLng: -122.4012,
  hourlyValueUsd: 30,
  avgMpg: 25,
  typicalFillupGallons: 12,
};

function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 3958.7613;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function loadStations(): Promise<Station[]> {
  const client = createClient();
  await client.connect();
  try {
    const { rows } = await client.query<{
      id: string;
      name: string;
      address: string;
      lat: number;
      lng: number;
      current_price_per_gallon: string;
    }>(
      `SELECT id, name, address, lat, lng, current_price_per_gallon
         FROM stations WHERE current_price_per_gallon IS NOT NULL`,
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      address: r.address,
      lat: Number(r.lat),
      lng: Number(r.lng),
      price: Number(r.current_price_per_gallon),
    }));
  } finally {
    await client.end();
  }
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

async function main() {
  const stations = await loadStations();
  const home = { lat: TEST_USER.homeLat!, lng: TEST_USER.homeLng! };
  const work = { lat: TEST_USER.workLat!, lng: TEST_USER.workLng! };

  // Same corridor prefilter the engine uses (home or work endpoint within 5mi).
  const prefiltered = stations.filter(
    (s) =>
      haversineMiles(home, { lat: s.lat, lng: s.lng }) <= 5 ||
      haversineMiles(work, { lat: s.lat, lng: s.lng }) <= 5,
  );
  const baselinePrice = medianPrice(prefiltered.map((s) => s.price))!;
  const topCheap = [...prefiltered].sort((a, b) => a.price - b.price).slice(0, 5);

  console.log(
    `Loaded ${stations.length} stations; ${prefiltered.length} within corridor; ` +
      `median baseline price = $${baselinePrice.toFixed(2)}\n`,
  );
  console.log(
    `Home: (${home.lat}, ${home.lng})   Work: (${work.lat}, ${work.lng})`,
  );
  console.log(`User prefs: $${TEST_USER.hourlyValueUsd}/hr, ${TEST_USER.avgMpg} MPG, ${TEST_USER.typicalFillupGallons}gal fillup\n`);

  console.log(
    pad("STATION", 20),
    pad("$/gal", 7),
    pad("hav mi", 7),
    pad("mbx mi", 7),
    pad("mbx min", 8),
    pad("raw$", 7),
    pad("time$", 7),
    pad("gas$", 7),
    pad("net$", 8),
    "source",
  );
  console.log("─".repeat(100));

  const baselineHav = haversineMiles(home, work);

  for (const c of topCheap) {
    // Haversine estimate of what the old engine would have computed.
    const hav =
      haversineMiles(home, { lat: c.lat, lng: c.lng }) +
      haversineMiles({ lat: c.lat, lng: c.lng }, work);
    const havExtra = Math.max(0, hav - baselineHav);

    // Mapbox real detour.
    let mbxMiles = NaN;
    let mbxMinutes = NaN;
    let source: "mapbox" | "haversine_fallback" = "mapbox";
    try {
      const det = await computeDetour({
        baseline: { origin: home, destination: work },
        waypoint: { lat: c.lat, lng: c.lng },
      });
      mbxMiles = det.extraMiles;
      mbxMinutes = det.extraMinutes;
    } catch (err) {
      console.warn(`  (mapbox failed for ${c.name}: ${err}), falling back`);
      mbxMiles = havExtra;
      mbxMinutes = havExtra * 4;
      source = "haversine_fallback";
    }

    const rawSavings = estimateSavings({
      recommendedPrice: c.price,
      baselinePrice,
      gallonsAssumed: TEST_USER.typicalFillupGallons,
    });
    const timeCost =
      source === "haversine_fallback"
        ? 0
        : (mbxMinutes / 60) * TEST_USER.hourlyValueUsd;
    const gasCost = (mbxMiles / TEST_USER.avgMpg) * c.price;
    const net = rawSavings - timeCost - gasCost;

    console.log(
      pad(c.name.slice(0, 18), 20),
      pad(`$${c.price.toFixed(2)}`, 7),
      pad(havExtra.toFixed(2), 7),
      pad(mbxMiles.toFixed(2), 7),
      pad(mbxMinutes.toFixed(1), 8),
      pad(`$${rawSavings.toFixed(2)}`, 7),
      pad(`$${timeCost.toFixed(2)}`, 7),
      pad(`$${gasCost.toFixed(2)}`, 7),
      pad(`$${net.toFixed(2)}`, 8),
      source,
    );
  }

  console.log();
  const rec = await recommendStation(TEST_USER, stations);
  if (rec) {
    console.log(
      `Engine winner: ${rec.station.name} @ $${rec.station.price.toFixed(2)} — ` +
        `${rec.detourMiles.toFixed(2)}mi / ${rec.detourMinutes.toFixed(1)}min, ` +
        `net $${rec.netSavings.toFixed(2)}, worth=${rec.worthDetouring}, via ${rec.routingSource}`,
    );
  } else {
    console.log("Engine returned null.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
