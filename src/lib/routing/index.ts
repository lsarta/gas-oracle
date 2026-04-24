import { mapboxProvider } from "./providers/mapbox";
import { googleProvider } from "./providers/google";
import type { Route, RouteRequest, RoutingProvider } from "./types";

export type { Route, RouteRequest, LatLng, DetourRequest, DetourResult } from "./types";
export { RoutingError } from "./types";

const METERS_PER_MILE = 1609.344;

const CACHE_TTL_MS = 5 * 60 * 1000;
type CacheEntry = { route: Route; expiresAt: number };
const routeCache = new Map<string, CacheEntry>();

let cacheHits = 0;
let cacheMisses = 0;

function cacheKey(req: RouteRequest): string {
  // Keys are coarse — round to ~11m (5dp) so jittery coords reuse cache.
  const round = (n: number) => Math.round(n * 1e5) / 1e5;
  const fmt = (p: { lat: number; lng: number }) =>
    `${round(p.lat)},${round(p.lng)}`;
  const wp = (req.waypoints ?? []).map(fmt).join("|");
  return `${fmt(req.origin)}->${fmt(req.destination)}@${wp}`;
}

function pickProvider(): RoutingProvider {
  const choice = (process.env.ROUTING_PROVIDER ?? "mapbox").toLowerCase();
  if (choice === "google") return googleProvider;
  return mapboxProvider;
}

export async function getRoute(req: RouteRequest): Promise<Route> {
  const key = cacheKey(req);
  const now = Date.now();
  const hit = routeCache.get(key);
  if (hit && hit.expiresAt > now) {
    cacheHits++;
    if ((cacheHits + cacheMisses) % 10 === 0) {
      console.log(
        `[routing] cache: ${cacheHits} hits / ${cacheMisses} misses (size=${routeCache.size})`,
      );
    }
    return hit.route;
  }

  const route = await pickProvider().getRoute(req);
  routeCache.set(key, { route, expiresAt: now + CACHE_TTL_MS });
  cacheMisses++;
  if ((cacheHits + cacheMisses) % 10 === 0) {
    console.log(
      `[routing] cache: ${cacheHits} hits / ${cacheMisses} misses (size=${routeCache.size})`,
    );
  }
  return route;
}

export function getRoutingCacheStats() {
  return { hits: cacheHits, misses: cacheMisses, size: routeCache.size };
}

// Compute the extra distance/time required to detour through a waypoint
// relative to the baseline origin → destination route. Both underlying
// getRoute calls are memoized by the 5-minute cache.
import type { DetourRequest, DetourResult } from "./types";
export async function computeDetour(req: DetourRequest): Promise<DetourResult> {
  const baseline = await getRoute({
    origin: req.baseline.origin,
    destination: req.baseline.destination,
  });
  const detour = await getRoute({
    origin: req.baseline.origin,
    destination: req.baseline.destination,
    waypoints: [req.waypoint],
  });
  const extraMeters = Math.max(0, detour.distanceMeters - baseline.distanceMeters);
  const extraSecs = Math.max(0, detour.durationSeconds - baseline.durationSeconds);
  return {
    baselineDistanceMeters: baseline.distanceMeters,
    baselineDurationSeconds: baseline.durationSeconds,
    detourDistanceMeters: detour.distanceMeters,
    detourDurationSeconds: detour.durationSeconds,
    extraMiles: extraMeters / METERS_PER_MILE,
    extraMinutes: extraSecs / 60,
    detourGeometry: detour.geometry,
  };
}
