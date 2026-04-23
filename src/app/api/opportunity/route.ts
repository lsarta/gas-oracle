import { NextRequest } from "next/server";
import { createClient } from "@/lib/db/client";
import { freshnessLabel } from "@/lib/oracle/freshness";

const RADIUS_MILES = 5;
const MIN_PER_MILE = 1.6; // ~city traffic minutes per mile

function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3958.7613;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const wallet = sp.get("wallet");

  const client = createClient();
  await client.connect();

  try {
    let originLat: number | null = null;
    let originLng: number | null = null;
    let usedHome = false;

    if (wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      const u = await client.query(
        `SELECT home_lat, home_lng FROM users WHERE wallet_address = $1`,
        [wallet],
      );
      if (u.rows.length && u.rows[0].home_lat !== null && u.rows[0].home_lng !== null) {
        originLat = Number(u.rows[0].home_lat);
        originLng = Number(u.rows[0].home_lng);
        usedHome = true;
      }
    }
    if (originLat === null || originLng === null) {
      // SF fallback (Mission district-ish — close to the demo seed cluster).
      originLat = 37.7693;
      originLng = -122.4198;
    }

    const { rows } = await client.query(
      `SELECT id, name, address, lat, lng, current_price_per_gallon, last_priced_at
         FROM stations WHERE current_price_per_gallon IS NOT NULL`,
    );
    type Row = {
      id: string;
      name: string;
      address: string;
      lat: number;
      lng: number;
      current_price_per_gallon: string | number;
      last_priced_at: Date | null;
    };
    const candidates = (rows as Row[])
      .map((r) => ({
        ...r,
        distanceMiles: haversineMiles(originLat!, originLng!, Number(r.lat), Number(r.lng)),
      }))
      .filter((r) => r.distanceMiles <= RADIUS_MILES);

    if (candidates.length === 0) {
      return Response.json({ opportunity: null, usedHome });
    }

    const prices = candidates.map((c) => Number(c.current_price_per_gallon));
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const cheapest = candidates.sort(
      (a, b) => Number(a.current_price_per_gallon) - Number(b.current_price_per_gallon),
    )[0];
    const cheapestPrice = Number(cheapest.current_price_per_gallon);
    const savingsPerGallon = Math.max(0, avg - cheapestPrice);
    const detourMinutes = Math.round(cheapest.distanceMiles * MIN_PER_MILE);

    return Response.json({
      opportunity: {
        stationId: cheapest.id,
        name: cheapest.name,
        address: cheapest.address,
        lat: Number(cheapest.lat),
        lng: Number(cheapest.lng),
        price: cheapestPrice,
        avgNearby: Math.round(avg * 100) / 100,
        savingsPerGallon: Math.round(savingsPerGallon * 100) / 100,
        distanceMiles: Math.round(cheapest.distanceMiles * 10) / 10,
        detourMinutes,
        freshness: freshnessLabel(cheapest.last_priced_at),
        lastPricedAt: cheapest.last_priced_at?.toISOString() ?? null,
      },
      origin: { lat: originLat, lng: originLng, usedHome },
    });
  } finally {
    await client.end();
  }
}
