import { NextRequest } from "next/server";
import { createClient } from "@/lib/db/client";
import {
  recommendStation,
  type Recommendation,
  type Station as RecStation,
  type UserProfile,
} from "@/lib/oracle/recommend";

type Reason = "set_locations" | "no_savings" | "no_candidates" | null;
type CachePayload = {
  recommendation: Recommendation | null;
  reason: Reason;
};

const PER_USER_TTL_MS = 60_000;
const userCache = new Map<string, { payload: CachePayload; expiresAt: number }>();

const FALLBACK_HOURLY = 30;
const FALLBACK_MPG = 25;
const FALLBACK_FILLUP = 12;

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");
  const cacheKey = wallet ?? "__anonymous__";
  const now = Date.now();
  const cached = userCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return Response.json(cached.payload);
  }

  const client = createClient();
  await client.connect();
  try {
    let user: UserProfile | null = null;
    if (wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      const u = await client.query<{
        home_lat: number | null;
        home_lng: number | null;
        work_lat: number | null;
        work_lng: number | null;
        hourly_value_usd: string | null;
        avg_mpg: string | null;
        typical_fillup_gallons: string | null;
      }>(
        `SELECT home_lat, home_lng, work_lat, work_lng,
                hourly_value_usd, avg_mpg, typical_fillup_gallons
           FROM users WHERE wallet_address = $1`,
        [wallet],
      );
      if (u.rows.length) {
        const r = u.rows[0];
        user = {
          homeLat: r.home_lat,
          homeLng: r.home_lng,
          workLat: r.work_lat,
          workLng: r.work_lng,
          hourlyValueUsd:
            r.hourly_value_usd !== null ? Number(r.hourly_value_usd) : FALLBACK_HOURLY,
          avgMpg: r.avg_mpg !== null ? Number(r.avg_mpg) : FALLBACK_MPG,
          typicalFillupGallons:
            r.typical_fillup_gallons !== null
              ? Number(r.typical_fillup_gallons)
              : FALLBACK_FILLUP,
        };
      }
    }

    if (!user || user.homeLat === null || user.homeLng === null) {
      const payload: CachePayload = { recommendation: null, reason: "set_locations" };
      userCache.set(cacheKey, { payload, expiresAt: now + PER_USER_TTL_MS });
      return Response.json(payload);
    }

    const stationsRes = await client.query<{
      id: string;
      name: string;
      address: string;
      lat: number;
      lng: number;
      current_price_per_gallon: string;
    }>(
      `SELECT id, name, address, lat, lng, current_price_per_gallon
         FROM stations
         WHERE current_price_per_gallon IS NOT NULL`,
    );
    const candidateStations: RecStation[] = stationsRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      address: r.address,
      lat: Number(r.lat),
      lng: Number(r.lng),
      price: Number(r.current_price_per_gallon),
    }));

    if (candidateStations.length === 0) {
      const payload: CachePayload = { recommendation: null, reason: "no_candidates" };
      userCache.set(cacheKey, { payload, expiresAt: now + PER_USER_TTL_MS });
      return Response.json(payload);
    }

    const rec = await recommendStation(user, candidateStations);
    const payload: CachePayload =
      rec === null
        ? { recommendation: null, reason: "no_candidates" }
        : rec.worthDetouring
          ? { recommendation: rec, reason: null }
          : { recommendation: rec, reason: "no_savings" };

    userCache.set(cacheKey, { payload, expiresAt: now + PER_USER_TTL_MS });
    return Response.json(payload);
  } finally {
    await client.end();
  }
}
