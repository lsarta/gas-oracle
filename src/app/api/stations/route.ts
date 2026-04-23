import { createClient } from "@/lib/db/client";
import { freshnessLabel } from "@/lib/oracle/freshness";

export async function GET() {
  const client = createClient();
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, name, address, lat, lng, current_price_per_gallon, last_priced_at
         FROM stations
         ORDER BY current_price_per_gallon ASC NULLS LAST, name ASC`,
    );
    const stations = rows.map((r) => {
      const lastPricedAt: Date | null = r.last_priced_at;
      return {
        id: r.id as string,
        name: r.name as string,
        address: r.address as string,
        lat: Number(r.lat),
        lng: Number(r.lng),
        currentPricePerGallon:
          r.current_price_per_gallon === null ? null : Number(r.current_price_per_gallon),
        lastPricedAt: lastPricedAt ? lastPricedAt.toISOString() : null,
        freshness: freshnessLabel(lastPricedAt),
      };
    });
    return Response.json({ stations });
  } finally {
    await client.end();
  }
}
