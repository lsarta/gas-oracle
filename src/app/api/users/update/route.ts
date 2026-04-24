import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/db/client";

const BodySchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  homeLat: z.number().min(-90).max(90).optional(),
  homeLng: z.number().min(-180).max(180).optional(),
  workLat: z.number().min(-90).max(90).nullable().optional(),
  workLng: z.number().min(-180).max(180).nullable().optional(),
  hourlyValueUsd: z.number().positive().optional(),
  avgMpg: z.number().positive().optional(),
  typicalFillupGallons: z.number().positive().optional(),
});

export async function POST(request: NextRequest) {
  let parsed;
  try {
    parsed = BodySchema.parse(await request.json());
  } catch (err) {
    return Response.json(
      { error: "Invalid body", detail: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  const {
    walletAddress,
    homeLat,
    homeLng,
    workLat,
    workLng,
    hourlyValueUsd,
    avgMpg,
    typicalFillupGallons,
  } = parsed;

  const client = createClient();
  await client.connect();
  try {
    // COALESCE leaves an existing value alone when the new value is undefined
    // (passed as NULL). For explicit clears (e.g. removing work address) the
    // client sends `null`, which COALESCE treats the same — so to allow
    // clearing we use a CASE form for the work fields below.
    const res = await client.query(
      `UPDATE users
         SET home_lat = COALESCE($1, home_lat),
             home_lng = COALESCE($2, home_lng),
             work_lat = $3,
             work_lng = $4,
             hourly_value_usd = COALESCE($5, hourly_value_usd),
             avg_mpg = COALESCE($6, avg_mpg),
             typical_fillup_gallons = COALESCE($7, typical_fillup_gallons)
       WHERE wallet_address = $8
       RETURNING id, home_lat, home_lng, work_lat, work_lng,
                 hourly_value_usd, avg_mpg, typical_fillup_gallons`,
      [
        homeLat ?? null,
        homeLng ?? null,
        workLat === undefined ? undefined : workLat,
        workLng === undefined ? undefined : workLng,
        hourlyValueUsd ?? null,
        avgMpg ?? null,
        typicalFillupGallons ?? null,
        walletAddress,
      ],
    );
    if (res.rows.length === 0) {
      return Response.json({ error: "user not found" }, { status: 404 });
    }
    return Response.json({ user: res.rows[0] });
  } finally {
    await client.end();
  }
}
