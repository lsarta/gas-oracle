import { createClient } from "@/lib/db/client";
import { freshnessLabel } from "@/lib/oracle/freshness";

export async function GET() {
  const client = createClient();
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, name, address, lat, lng, current_hourly_rate, last_priced_at
         FROM parking_locations
         ORDER BY current_hourly_rate ASC NULLS LAST`,
    );
    return Response.json({
      locations: rows.map((r) => ({
        id: r.id,
        name: r.name,
        address: r.address,
        lat: Number(r.lat),
        lng: Number(r.lng),
        currentHourlyRate: r.current_hourly_rate !== null ? Number(r.current_hourly_rate) : null,
        lastPricedAt:
          r.last_priced_at instanceof Date
            ? r.last_priced_at.toISOString()
            : r.last_priced_at,
        freshness: freshnessLabel(r.last_priced_at),
      })),
    });
  } finally {
    await client.end();
  }
}
