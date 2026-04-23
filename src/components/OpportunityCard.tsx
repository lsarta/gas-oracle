"use client";

import { useEffect, useState } from "react";

type Opportunity = {
  stationId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  price: number;
  avgNearby: number;
  savingsPerGallon: number;
  distanceMiles: number;
  detourMinutes: number;
  freshness: string;
};

type Origin = { lat: number; lng: number; usedHome: boolean };

const FALLBACK: Opportunity = {
  stationId: "",
  name: "Arco Mission",
  address: "1798 Mission St, San Francisco",
  lat: 37.7693,
  lng: -122.4198,
  price: 4.97,
  avgNearby: 5.4,
  savingsPerGallon: 0.43,
  distanceMiles: 1.5,
  detourMinutes: 4,
  freshness: "demo",
};

function staticMapUrl(opp: Opportunity, origin: Origin | null): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return "";
  const overlays: string[] = [];
  if (origin && (origin.lat !== opp.lat || origin.lng !== opp.lng)) {
    overlays.push(`pin-s+a1a1aa(${origin.lng},${origin.lat})`);
    overlays.push(
      `path-3+059669-0.55(${encodePath([
        [origin.lng, origin.lat],
        [opp.lng, opp.lat],
      ])})`,
    );
  }
  const overlayStr = overlays.length ? `${overlays.join(",")}/` : "";
  // Center on destination at fixed zoom; we overlay our own pulsing pin via DOM.
  return `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${overlayStr}${opp.lng},${opp.lat},13,0/600x180@2x?access_token=${token}&attribution=false&logo=false`;
}

function encodePath(points: [number, number][]): string {
  let lastLat = 0;
  let lastLng = 0;
  let result = "";
  for (const [lng, lat] of points) {
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

export function OpportunityCard({ wallet }: { wallet?: string }) {
  const [opp, setOpp] = useState<Opportunity>(FALLBACK);
  const [origin, setOrigin] = useState<Origin | null>(null);

  useEffect(() => {
    let aborted = false;
    const url = wallet ? `/api/opportunity?wallet=${wallet}` : "/api/opportunity";
    fetch(url, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (aborted) return;
        if (j.opportunity) {
          setOpp(j.opportunity as Opportunity);
          setOrigin(j.origin as Origin);
        }
      })
      .catch(() => {});
    return () => {
      aborted = true;
    };
  }, [wallet]);

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${opp.lat},${opp.lng}`;
  const showMap = !!(origin?.usedHome && process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
  const mapUrl = showMap ? staticMapUrl(opp, origin) : "";
  const showSavings = opp.savingsPerGallon >= 0.05;

  return (
    <section className="mx-auto w-full max-w-[560px]">
      <div className="rounded-xl border border-zinc-200 bg-[#FAFAF8] p-8 sm:p-10">
        <p className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Opportunity near you
        </p>

        {showSavings ? (
          <p className="mt-3 font-mono text-[40px] font-medium leading-none tracking-tight text-emerald-600 sm:text-[48px]">
            ${opp.savingsPerGallon.toFixed(2)}/gal cheaper
          </p>
        ) : (
          <p className="mt-3 font-mono text-[40px] font-medium leading-none tracking-tight text-zinc-900 sm:text-[48px]">
            ${opp.price.toFixed(2)}/gal
          </p>
        )}

        <p className="mt-4 text-[20px] font-medium leading-snug text-zinc-900">
          at {opp.name}, {opp.detourMinutes} min off your route
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-zinc-500">
          Auto-detected from your commute. We notify you when it&apos;s worth detouring.
        </p>

        {showMap && mapUrl && (
          <div className="relative mt-6 h-[180px] w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mapUrl}
              alt={`Map preview for ${opp.name}`}
              width={600}
              height={180}
              className="h-full w-full object-cover"
              loading="lazy"
            />
            {/* Pulsing destination pin overlay, centered on map */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-3 w-3">
                <span
                  className="gyas-pin-pulse absolute inset-0 rounded-full bg-emerald-500"
                  aria-hidden
                />
                <span
                  className="absolute inset-0 rounded-full bg-emerald-600 ring-2 ring-white"
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
      </div>
    </section>
  );
}
