export type LatLng = { lat: number; lng: number };

export type Route = {
  distanceMeters: number;
  durationSeconds: number;
  geometry: { type: "LineString"; coordinates: [number, number][] };
};

export type RouteRequest = {
  origin: LatLng;
  destination: LatLng;
  waypoints?: LatLng[];
};

export interface RoutingProvider {
  getRoute(req: RouteRequest): Promise<Route>;
}

export class RoutingError extends Error {
  constructor(
    message: string,
    public readonly kind:
      | "no_route"
      | "rate_limited"
      | "auth"
      | "network"
      | "unknown",
  ) {
    super(message);
    this.name = "RoutingError";
  }
}
