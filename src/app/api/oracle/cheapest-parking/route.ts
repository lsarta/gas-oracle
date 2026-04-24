import { createOracleHandler, type CheapestRow } from "@/lib/oracle/oracle-handler";

export const GET = createOracleHandler({
  table: "parking_locations",
  priceColumn: "current_hourly_rate",
  vertical: "parking",
  description: "Cheapest parking location within radius",
  formatResponse: (row: CheapestRow, distanceMiles: number) => ({
    location: {
      name: row.name,
      address: row.address,
      lat: row.lat,
      lng: row.lng,
      hourlyRate: row.price,
      lastUpdated: row.lastPricedAt ? row.lastPricedAt.toISOString() : null,
    },
    distanceMiles,
  }),
});
