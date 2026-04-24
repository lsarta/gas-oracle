import { getRoute, RoutingError, type LatLng, type Route } from "@/lib/routing";
import { medianPrice } from "@/lib/oracle/savings";

export type Station = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  price: number;
};

export type UserProfile = {
  homeLat: number | null;
  homeLng: number | null;
  workLat: number | null;
  workLng: number | null;
  hourlyValueUsd: number;
  avgMpg: number;
  typicalFillupGallons: number;
};

export type Recommendation = {
  station: {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    price: number;
  };
  baselinePrice: number;
  rawSavings: number;
  detourMiles: number;
  detourMinutes: number;
  detourTimeCost: number;
  detourGasCost: number;
  netSavings: number;
  worthDetouring: boolean;
  routeGeometry: object | null;
};

const METERS_PER_MILE = 1609.344;
const MAX_DETOUR_MIN = 15;
const NEARBY_RADIUS_MILES = 5;
const CORRIDOR_RADIUS_MILES = 1;

function haversineMiles(a: LatLng, b: LatLng): number {
  const R = 3958.7613;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Distance from a point to a line segment in (rough) miles using equirectangular
// approximation around the segment's midpoint. Adequate for the corridor filter
// at SF scale where great-circle vs flat-earth difference is negligible.
function distanceToSegmentMiles(p: LatLng, a: LatLng, b: LatLng): number {
  const midLat = (a.lat + b.lat) / 2;
  const cosLat = Math.cos((midLat * Math.PI) / 180);
  const ax = a.lng * cosLat,
    ay = a.lat;
  const bx = b.lng * cosLat,
    by = b.lat;
  const px = p.lng * cosLat,
    py = p.lat;
  const dx = bx - ax,
    dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx,
    cy = ay + t * dy;
  const ddx = (px - cx) / cosLat;
  const ddy = py - cy;
  // Convert degrees to miles: 1 deg lat ≈ 69 mi.
  return Math.sqrt(ddx * ddx + ddy * ddy) * 69;
}

type DetourResult = {
  detourMiles: number;
  detourMinutes: number;
  routeGeometry: object | null;
  /** True when we fell back to Haversine because routing failed. */
  degraded: boolean;
};

async function detourViaStation(
  origin: LatLng,
  station: LatLng,
  destination: LatLng | null,
  baselineRoute: Route | null,
): Promise<DetourResult> {
  // Round-trip case (no work): home → station → home.
  if (destination === null) {
    try {
      const out = await getRoute({ origin, destination: station });
      // Symmetric round-trip: 2× one-way is close enough; saves a Mapbox call.
      const miles = (out.distanceMeters * 2) / METERS_PER_MILE;
      const minutes = (out.durationSeconds * 2) / 60;
      return {
        detourMiles: miles,
        detourMinutes: minutes,
        routeGeometry: out.geometry,
        degraded: false,
      };
    } catch (err) {
      console.warn("[recommend] routing failed, haversine fallback:", err);
      const miles = haversineMiles(origin, station) * 2;
      // Time cost set to 0 in the caller when degraded=true; report 4 min/mile
      // so the UI doesn't display zero time, just so the math comes out OK.
      return {
        detourMiles: miles,
        detourMinutes: miles * 4,
        routeGeometry: null,
        degraded: true,
      };
    }
  }

  // Commute case: detour = (home → station → work) − (home → work).
  if (!baselineRoute) {
    throw new Error("commute case requires baselineRoute");
  }
  try {
    const out = await getRoute({
      origin,
      destination,
      waypoints: [station],
    });
    const detourMeters = Math.max(0, out.distanceMeters - baselineRoute.distanceMeters);
    const detourSecs = Math.max(
      0,
      out.durationSeconds - baselineRoute.durationSeconds,
    );
    return {
      detourMiles: detourMeters / METERS_PER_MILE,
      detourMinutes: detourSecs / 60,
      routeGeometry: out.geometry,
      degraded: false,
    };
  } catch (err) {
    console.warn("[recommend] routing failed, haversine fallback:", err);
    const baseline = haversineMiles(origin, destination);
    const viaStation =
      haversineMiles(origin, station) + haversineMiles(station, destination);
    const detourMiles = Math.max(0, viaStation - baseline);
    return {
      detourMiles,
      detourMinutes: detourMiles * 4,
      routeGeometry: null,
      degraded: true,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function recommendStation(
  user: UserProfile,
  candidateStations: Station[],
): Promise<Recommendation | null> {
  if (user.homeLat === null || user.homeLng === null) return null;
  const home: LatLng = { lat: user.homeLat, lng: user.homeLng };
  const work: LatLng | null =
    user.workLat !== null && user.workLng !== null
      ? { lat: user.workLat, lng: user.workLng }
      : null;

  // ---- Pre-filter candidates by Haversine to keep Mapbox calls bounded.
  let prefiltered: Station[];
  let baselineSource: number[];

  if (work === null) {
    // Home-only: candidates within NEARBY_RADIUS_MILES of home.
    prefiltered = candidateStations.filter(
      (s) => haversineMiles(home, { lat: s.lat, lng: s.lng }) <= NEARBY_RADIUS_MILES,
    );
    baselineSource = prefiltered.map((s) => s.price);
  } else {
    // Commute: candidates within CORRIDOR_RADIUS_MILES of the home→work segment.
    const corridor = candidateStations.filter(
      (s) =>
        distanceToSegmentMiles({ lat: s.lat, lng: s.lng }, home, work) <=
        CORRIDOR_RADIUS_MILES,
    );
    if (corridor.length >= 3) {
      prefiltered = corridor;
      baselineSource = corridor.map((s) => s.price);
    } else {
      // Fallback: stations near either endpoint.
      prefiltered = candidateStations.filter(
        (s) =>
          haversineMiles(home, { lat: s.lat, lng: s.lng }) <= NEARBY_RADIUS_MILES ||
          haversineMiles(work, { lat: s.lat, lng: s.lng }) <= NEARBY_RADIUS_MILES,
      );
      baselineSource = prefiltered.map((s) => s.price);
    }
  }

  if (prefiltered.length === 0) return null;

  const baselinePrice = medianPrice(baselineSource);
  if (baselinePrice === null) return null;

  // ---- Get baseline route once for commute case (single Mapbox call shared
  // across all candidate evaluations).
  let baselineRoute: Route | null = null;
  if (work !== null) {
    try {
      baselineRoute = await getRoute({ origin: home, destination: work });
    } catch (err) {
      console.warn("[recommend] baseline route failed, falling back:", err);
      // Construct a synthetic baseline using Haversine so detour math works.
      const miles = haversineMiles(home, work);
      baselineRoute = {
        distanceMeters: miles * METERS_PER_MILE,
        durationSeconds: miles * 60 * 4, // 4 min/mile fallback
        geometry: {
          type: "LineString",
          coordinates: [
            [home.lng, home.lat],
            [work.lng, work.lat],
          ],
        },
      };
    }
  }

  // ---- Limit to the cheapest 5 prefiltered candidates to bound Mapbox calls.
  const topCheap = [...prefiltered]
    .sort((a, b) => a.price - b.price)
    .slice(0, 5);

  // ---- Score each candidate.
  type Scored = Recommendation & { _candidate: Station };
  const scored: Scored[] = [];
  for (const c of topCheap) {
    const detour = await detourViaStation(
      home,
      { lat: c.lat, lng: c.lng },
      work,
      baselineRoute,
    );
    if (detour.detourMinutes > MAX_DETOUR_MIN) continue;

    const rawSavings = (baselinePrice - c.price) * user.typicalFillupGallons;
    const detourTimeCost = detour.degraded
      ? 0
      : (detour.detourMinutes / 60) * user.hourlyValueUsd;
    const detourGasCost = (detour.detourMiles / user.avgMpg) * c.price;
    const netSavings = rawSavings - detourTimeCost - detourGasCost;

    scored.push({
      _candidate: c,
      station: {
        id: c.id,
        name: c.name,
        address: c.address,
        lat: c.lat,
        lng: c.lng,
        price: c.price,
      },
      baselinePrice: round2(baselinePrice),
      rawSavings: round2(rawSavings),
      detourMiles: Math.round(detour.detourMiles * 100) / 100,
      detourMinutes: Math.round(detour.detourMinutes * 10) / 10,
      detourTimeCost: round2(detourTimeCost),
      detourGasCost: round2(detourGasCost),
      netSavings: round2(netSavings),
      worthDetouring: netSavings > 0,
      routeGeometry: detour.routeGeometry,
    });
  }

  if (scored.length === 0) {
    // No candidate within MAX_DETOUR_MIN; surface the absolute cheapest with
    // worthDetouring=false so the UI can render the 'no_savings' state with
    // honest context.
    const cheapest = topCheap[0];
    return {
      station: {
        id: cheapest.id,
        name: cheapest.name,
        address: cheapest.address,
        lat: cheapest.lat,
        lng: cheapest.lng,
        price: cheapest.price,
      },
      baselinePrice: round2(baselinePrice),
      rawSavings: round2((baselinePrice - cheapest.price) * user.typicalFillupGallons),
      detourMiles: 0,
      detourMinutes: 0,
      detourTimeCost: 0,
      detourGasCost: 0,
      netSavings: 0,
      worthDetouring: false,
      routeGeometry: null,
    };
  }

  // Sort by netSavings desc; if none positive, return the closest-to-positive.
  scored.sort((a, b) => b.netSavings - a.netSavings);
  const winner = scored[0];
  // Strip the helper field.
  const { _candidate: _drop, ...rec } = winner;
  void _drop;
  return rec;
}
