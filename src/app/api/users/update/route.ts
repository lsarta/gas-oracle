import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/db/client";

const BodySchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  homeLat: z.number().min(-90).max(90).optional(),
  homeLng: z.number().min(-180).max(180).optional(),
  homeAddress: z.string().max(500).optional(),
  workLat: z.number().min(-90).max(90).nullable().optional(),
  workLng: z.number().min(-180).max(180).nullable().optional(),
  workAddress: z.string().max(500).nullable().optional(),
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
    homeAddress,
    workLat,
    workLng,
    workAddress,
    hourlyValueUsd,
    avgMpg,
    typicalFillupGallons,
  } = parsed;

  const client = createClient();
  await client.connect();
  try {
    const res = await client.query(
      `UPDATE users
         SET home_lat = COALESCE($1, home_lat),
             home_lng = COALESCE($2, home_lng),
             home_address = COALESCE($3, home_address),
             work_lat = $4,
             work_lng = $5,
             work_address = $6,
             hourly_value_usd = COALESCE($7, hourly_value_usd),
             avg_mpg = COALESCE($8, avg_mpg),
             typical_fillup_gallons = COALESCE($9, typical_fillup_gallons)
       WHERE wallet_address = $10
       RETURNING id, home_lat, home_lng, home_address, work_lat, work_lng, work_address,
                 hourly_value_usd, avg_mpg, typical_fillup_gallons`,
      [
        homeLat ?? null,
        homeLng ?? null,
        homeAddress ?? null,
        workLat === undefined ? undefined : workLat,
        workLng === undefined ? undefined : workLng,
        workAddress === undefined ? undefined : workAddress,
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
