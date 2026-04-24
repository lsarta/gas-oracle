import { RoutingError, type Route, type RouteRequest, type RoutingProvider } from "../types";

// TODO(prod): switch to a server-only token (no URL restriction) via
// MAPBOX_SERVER_TOKEN env var. For the hackathon we reuse the public token.
const MAPBOX_BASE = "https://api.mapbox.com/directions/v5/mapbox/driving";

function token(): string {
  const t =
    process.env.MAPBOX_SERVER_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!t) throw new RoutingError("Mapbox token missing", "auth");
  return t;
}

function coordsParam(req: RouteRequest): string {
  const points = [req.origin, ...(req.waypoints ?? []), req.destination];
  return points.map((p) => `${p.lng},${p.lat}`).join(";");
}

type MapboxResponse = {
  code: string;
  message?: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: { type: "LineString"; coordinates: [number, number][] };
  }>;
};

export const mapboxProvider: RoutingProvider = {
  async getRoute(req: RouteRequest): Promise<Route> {
    const url = `${MAPBOX_BASE}/${coordsParam(req)}?access_token=${token()}&geometries=geojson&overview=full`;
    let res: Response;
    try {
      res = await fetch(url);
    } catch (err) {
      throw new RoutingError(`Mapbox network failure: ${String(err)}`, "network");
    }

    if (res.status === 429) {
      throw new RoutingError("Mapbox rate limited (429)", "rate_limited");
    }
    if (res.status === 401 || res.status === 403) {
      throw new RoutingError(`Mapbox auth failure (${res.status})`, "auth");
    }
    if (!res.ok) {
      throw new RoutingError(`Mapbox HTTP ${res.status}`, "unknown");
    }

    const json = (await res.json()) as MapboxResponse;
    if (json.code !== "Ok" || !json.routes || json.routes.length === 0) {
      throw new RoutingError(
        `Mapbox no route: ${json.code}${json.message ? ` — ${json.message}` : ""}`,
        "no_route",
      );
    }

    const r = json.routes[0];
    return {
      distanceMeters: r.distance,
      durationSeconds: r.duration,
      geometry: r.geometry,
    };
  },
};
