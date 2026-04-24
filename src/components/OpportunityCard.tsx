"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Recommendation = {
  station: {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    price: number;
  };
  baselinePrice: number;
  rawSavings: number;
  detourMiles: number;
  detourMinutes: number;
  detourTimeCost: number;
  detourGasCost: number;
  netSavings: number;
  worthDetouring: boolean;
  routeGeometry: { type: "LineString"; coordinates: [number, number][] } | null;
};

type Reason = "set_locations" | "no_savings" | "no_candidates" | null;

type ApiResponse = {
  recommendation: Recommendation | null;
  reason: Reason;
};

type Me = {
  homeLat: number | null;
  homeLng: number | null;
  workLat: number | null;
  workLng: number | null;
};

const POLL_MS = 60_000;

function encodePolyline(coords: [number, number][]): string {
  // Google polyline algorithm — coords are [lng, lat] in GeoJSON, convert.
  let lastLat = 0;
  let lastLng = 0;
  let result = "";
  for (const [lng, lat] of coords) {
    const latE5 = Math.round(lat * 1e5);
    const lngE5 = Math.round(lng * 1e5);
    result += encodeNum(latE5 - lastLat) + encodeNum(lngE5 - lastLng);
    lastLat = latE5;
    lastLng = lngE5;
  }
  return encodeURIComponent(result);
}

function encodeNum(num: number): string {
  let v = num < 0 ? ~(num << 1) : num << 1;
  let result = "";
  while (v >= 0x20) {
    result += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  result += String.fromCharCode(v + 63);
  return result;
}

function staticMapUrl(rec: Recommendation, me: Me): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return "";
  const overlays: string[] = [];
  if (rec.routeGeometry) {
    overlays.push(`path-3+059669-0.7(${encodePolyline(rec.routeGeometry.coordinates)})`);
  }
  if (me.homeLat !== null && me.homeLng !== null) {
    overlays.push(`pin-s+a1a1aa(${me.homeLng},${me.homeLat})`);
  }
  overlays.push(
    `pin-l-fuel+059669(${rec.station.lng},${rec.station.lat})`,
  );
  const overlayStr = overlays.join(",");
  return `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${overlayStr}/auto/600x180@2x?access_token=${token}&padding=40,40,40,40&attribution=false&logo=false`;
}

function googleDirectionsUrl(rec: Recommendation, me: Me): string {
  const dest = `${rec.station.lat},${rec.station.lng}`;
  const params = new URLSearchParams({ api: "1", destination: dest });
  if (me.homeLat !== null && me.homeLng !== null) {
    params.set("origin", `${me.homeLat},${me.homeLng}`);
  }
  if (me.workLat !== null && me.workLng !== null) {
    // Google supports `waypoints` but a single waypoint is the station; the
    // final destination becomes work, station goes in waypoints.
    params.set("origin", `${me.homeLat},${me.homeLng}`);
    params.set("destination", `${me.workLat},${me.workLng}`);
    params.set("waypoints", dest);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function MathBreakdown({ rec }: { rec: Recommendation }) {
  return (
    <p className="mt-2 font-mono text-[12px] leading-relaxed text-zinc-500">
      ${rec.rawSavings.toFixed(2)} save − ${rec.detourTimeCost.toFixed(2)} time − $
      {rec.detourGasCost.toFixed(2)} gas = ${rec.netSavings.toFixed(2)} net
    </p>
  );
}

export function OpportunityCard({ wallet }: { wallet?: string }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [me, setMe] = useState<Me>({ homeLat: null, homeLng: null, workLat: null, workLng: null });
  const [loaded, setLoaded] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [oppRes, meRes] = await Promise.all([
        fetch(
          wallet ? `/api/opportunity?wallet=${wallet}` : "/api/opportunity",
          { cache: "no-store" },
        ),
        wallet ? fetch(`/api/users/me?wallet=${wallet}`, { cache: "no-store" }) : null,
      ]);
      const oppJson = (await oppRes.json()) as ApiResponse;
      setData(oppJson);
      if (meRes) {
        const meJson = await meRes.json();
        if (meJson.user) {
          setMe({
            homeLat: meJson.user.homeLat,
            homeLng: meJson.user.homeLng,
            workLat: meJson.user.workLat,
            workLng: meJson.user.workLng,
          });
        }
      }
      setLoaded(true);
    } catch {
      setLoaded(true);
    }
  }, [wallet]);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, POLL_MS);
    function onPrefsUpdated() {
      fetchAll();
    }
    window.addEventListener("gyas:prefs-updated", onPrefsUpdated);
    return () => {
      clearInterval(id);
      window.removeEventListener("gyas:prefs-updated", onPrefsUpdated);
    };
  }, [fetchAll]);

  if (!loaded) {
    return (
      <section className="mx-auto w-full max-w-[560px]">
        <div className="rounded-xl border border-zinc-200 bg-[#FAFAF8] p-8 sm:p-10">
          <p className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Opportunity near you
          </p>
          <p className="mt-3 text-[14px] text-zinc-500">Loading…</p>
        </div>
      </section>
    );
  }

  const rec = data?.recommendation ?? null;
  const reason = data?.reason ?? null;

  // STATE A — needs location
  if (reason === "set_locations") {
    return (
      <section className="mx-auto w-full max-w-[560px]">
        <div className="rounded-xl border border-zinc-200 bg-[#FAFAF8] p-8 sm:p-10">
          <p className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Opportunity near you
          </p>
          <h2 className="mt-3 text-[28px] font-medium tracking-tight text-zinc-900 sm:text-[32px]">
            Set your locations
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-zinc-500">
            We need your home (and optionally work) to find detours actually worth
            taking.
          </p>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                sessionStorage.removeItem("gyas:onboarding-dismissed");
                window.dispatchEvent(new CustomEvent("gyas:open-onboarding"));
                window.location.reload();
              }
            }}
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-emerald-600 text-[15px] font-medium text-white transition-colors hover:bg-emerald-700"
          >
            Set locations
          </button>
        </div>
      </section>
    );
  }

  // STATE B — no recommendation worth taking
  if (rec === null || !rec.worthDetouring) {
    return (
      <section className="mx-auto w-full max-w-[560px]">
        <div className="rounded-xl border border-zinc-200 bg-[#FAFAF8] p-8 sm:p-10">
          <p className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Opportunity near you
          </p>
          <h2 className="mt-3 text-[22px] font-medium leading-snug tracking-tight text-zinc-900 sm:text-[24px]">
            No detours worth taking right now
          </h2>
          {rec && (
            <>
              <p className="mt-3 text-[14px] leading-relaxed text-zinc-500">
                Cheapest nearby is{" "}
                <span className="text-zinc-900">{rec.station.name}</span> at{" "}
                <span className="font-mono text-zinc-900">
                  ${rec.station.price.toFixed(2)}/gal
                </span>
                , but the detour costs more than the savings.
              </p>
              <details className="mt-4">
                <summary className="cursor-pointer select-none font-inter text-[12px] uppercase tracking-wider text-zinc-500 hover:text-zinc-700">
                  Show the math
                </summary>
                <MathBreakdown rec={rec} />
              </details>
            </>
          )}
          {!rec && (
            <p className="mt-3 text-[14px] leading-relaxed text-zinc-500">
              No stations within range. Check back as more get reported.
            </p>
          )}
          <p className="mt-6 text-[13px] text-zinc-400">
            We&apos;ll notify you when an opportunity shows up.
          </p>
        </div>
      </section>
    );
  }

  // STATE C — worth detouring (happy path)
  const mapUrl = staticMapUrl(rec, me);
  const directionsUrl = googleDirectionsUrl(rec, me);

  async function handleGetDirections(_e: React.MouseEvent<HTMLAnchorElement>) {
    if (!wallet || !rec) return;
    try {
      const res = await fetch("/api/savings/take", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userWallet: wallet,
          stationId: rec.station.id,
          recommendedPrice: rec.station.price,
          baselinePrice: rec.baselinePrice,
          netSavingsUsd: rec.netSavings,
          detourMinutes: rec.detourMinutes,
          detourMiles: rec.detourMiles,
        }),
      });
      if (res.ok) {
        toast.success(`Saved $${rec.netSavings.toFixed(2)} — recorded to your earnings`);
      }
    } catch {
      /* best-effort */
    }
  }

  return (
    <section className="mx-auto w-full max-w-[560px]">
      <div className="rounded-xl border border-zinc-200 bg-[#FAFAF8] p-8 sm:p-10">
        <p className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Opportunity near you
        </p>

        <p className="mt-3 font-mono text-[40px] font-medium leading-none tracking-tight text-emerald-600 sm:text-[48px]">
          Save ${rec.netSavings.toFixed(2)}
        </p>
        <p className="mt-2 font-inter text-[13px] text-zinc-500">on your next fillup</p>

        <p className="mt-4 text-[20px] font-medium leading-snug text-zinc-900">
          at {rec.station.name}, +{rec.detourMinutes.toFixed(0)} min detour
        </p>

        <MathBreakdown rec={rec} />

        {mapUrl && (
          <div className="relative mt-6 h-[180px] w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mapUrl}
              alt={`Route preview to ${rec.station.name}`}
              width={600}
              height={180}
              className="h-full w-full object-cover"
              loading="lazy"
            />
            {/* Pulse overlay sits at image center; precise green destination
                pin is rendered by Mapbox's pin-l-fuel marker. The pulse is a
                visual cue, not a precise marker. */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-3 w-3">
                <span
                  className="gyas-pin-pulse absolute inset-0 rounded-full bg-emerald-500"
                  aria-hidden
                />
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            onClick={handleGetDirections}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-emerald-600 text-[15px] font-medium text-white transition-colors hover:bg-emerald-700"
          >
            Get directions
          </a>
          <button
            type="button"
            className="text-center text-[14px] text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline"
          >
            Not now
          </button>
        </div>

        <p className="mt-5 text-[12px] leading-relaxed text-zinc-400">
          Auto-detected from your commute. Updated every minute.
        </p>
      </div>
    </section>
  );
}
