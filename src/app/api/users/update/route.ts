import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/db/client";

// Per-field validation rules. All updatable user fields accept `null` as
// the "clear this column" value; the route distinguishes "field absent in
// the request" (preserve) from "field present and null" (clear) via
// hasOwnProperty on the raw body, NOT via the parsed Zod result.
const BodySchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  homeLat: z.number().min(-90).max(90).nullable().optional(),
  homeLng: z.number().min(-180).max(180).nullable().optional(),
  homeAddress: z.string().max(500).nullable().optional(),
  workLat: z.number().min(-90).max(90).nullable().optional(),
  workLng: z.number().min(-180).max(180).nullable().optional(),
  workAddress: z.string().max(500).nullable().optional(),
  hourlyValueUsd: z.number().positive().nullable().optional(),
  avgMpg: z.number().positive().nullable().optional(),
  typicalFillupGallons: z.number().positive().nullable().optional(),
});

// Maps the JSON body key (camelCase) → DB column name (snake_case). Order
// here is the order columns appear in SET clauses; not semantically
// significant since SET is a set, but kept stable for log readability.
const COLUMN_MAP = {
  homeLat: "home_lat",
  homeLng: "home_lng",
  homeAddress: "home_address",
  workLat: "work_lat",
  workLng: "work_lng",
  workAddress: "work_address",
  hourlyValueUsd: "hourly_value_usd",
  avgMpg: "avg_mpg",
  typicalFillupGallons: "typical_fillup_gallons",
} as const;

type FieldKey = keyof typeof COLUMN_MAP;
const FIELD_KEYS = Object.keys(COLUMN_MAP) as FieldKey[];

const RETURNING_COLS =
  "id, home_lat, home_lng, home_address, work_lat, work_lng, work_address, " +
  "hourly_value_usd, avg_mpg, typical_fillup_gallons";

export async function POST(request: NextRequest) {
  let rawBody: Record<string, unknown>;
  try {
    const json = await request.json();
    if (typeof json !== "object" || json === null || Array.isArray(json)) {
      return Response.json(
        { error: "Body must be a JSON object" },
        { status: 400 },
      );
    }
    rawBody = json as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = BodySchema.parse(rawBody);
  } catch (err) {
    return Response.json(
      {
        error: "Invalid body",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 400 },
    );
  }

  const { walletAddress } = parsed;

  // Build the SET clause from fields that are actually present in the raw
  // body. The previous implementation had two opposite bugs in one query:
  // - home_* used COALESCE($n, home_*), so explicit nulls from clearLocations
  //   couldn't clear those columns.
  // - work_* used direct assignment, so partial saves that omitted them
  //   (e.g. savePrefs sending only hourlyValueUsd/etc.) silently wiped work
  //   coordinates because the unsent params became null in pg.
  // Driving SET off hasOwnProperty fixes both: absent = preserve, null =
  // clear, value = set.
  const sets: string[] = [];
  const values: unknown[] = [];
  let placeholder = 1;
  const parsedRecord = parsed as Record<string, unknown>;
  for (const key of FIELD_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(rawBody, key)) continue;
    sets.push(`${COLUMN_MAP[key]} = $${placeholder++}`);
    // Zod resolves `null` and the actual value identically here; coerce
    // undefined → null defensively even though hasOwnProperty should have
    // excluded that case.
    values.push(parsedRecord[key] ?? null);
  }

  const client = createClient();
  await client.connect();
  try {
    if (sets.length === 0) {
      // No updatable fields in the body — match the prior behaviour where
      // a body of just { walletAddress } collapsed to a no-op under
      // COALESCE. Return the current row so clients can still refresh state.
      const noopRes = await client.query(
        `SELECT ${RETURNING_COLS} FROM users WHERE wallet_address = $1`,
        [walletAddress],
      );
      if (noopRes.rows.length === 0) {
        return Response.json({ error: "user not found" }, { status: 404 });
      }
      return Response.json({ user: noopRes.rows[0] });
    }

    values.push(walletAddress);
    const res = await client.query(
      `UPDATE users SET ${sets.join(", ")}
         WHERE wallet_address = $${placeholder}
       RETURNING ${RETURNING_COLS}`,
      values,
    );
    if (res.rows.length === 0) {
      return Response.json({ error: "user not found" }, { status: 404 });
    }
    return Response.json({ user: res.rows[0] });
  } finally {
    await client.end();
  }
}
