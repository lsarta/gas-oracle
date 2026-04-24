import { RoutingError, type Route, type RouteRequest, type RoutingProvider } from "../types";

export const googleProvider: RoutingProvider = {
  async getRoute(_req: RouteRequest): Promise<Route> {
    throw new RoutingError(
      "Google Directions provider not implemented — set ROUTING_PROVIDER=mapbox or implement google.",
      "unknown",
    );
  },
};
