"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ReportDialog } from "@/components/ReportDialog";

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

function staticMapUrl(opportunity: Opportunity, origin: Origin | null): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return "";
  const stationPin = `pin-l-fuel+059669(${opportunity.lng},${opportunity.lat})`;
  const homePin = origin
    ? `,pin-s+737373(${origin.lng},${origin.lat})`
    : "";
  // Auto-fit by giving two coords; use [lng,lat,zoom,bearing] form when no auto.
  // For two-point auto-bounds use the `auto` keyword.
  const path =
    origin && (origin.lat !== opportunity.lat || origin.lng !== opportunity.lng)
      ? `path-3+9ca3af-0.5(${encodePath([
          [origin.lng, origin.lat],
          [opportunity.lng, opportunity.lat],
        ])})`
      : "";
  const overlays = [stationPin + homePin, path].filter(Boolean).join(",");
  return `https://api.mapbox.com/styles/v1/mapbox/navigation-day-v1/static/${overlays}/auto/600x200@2x?access_token=${token}&padding=40`;
}

// Simple polyline encoder (Google polyline algorithm) for two-point overlays.
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
  const [loaded, setLoaded] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null);

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
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      aborted = true;
    };
  }, [wallet]);

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${opp.lat},${opp.lng}`;
  const mapUrl = staticMapUrl(opp, origin);
  const showSavings = opp.savingsPerGallon >= 0.05;

  return (
    <>
      <section className="mx-auto w-full max-w-[600px]">
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Opportunity near you
          </div>

          {showSavings ? (
            <>
              <div className="font-mono text-4xl font-semibold tracking-tight text-emerald-600 sm:text-5xl">
                ${opp.savingsPerGallon.toFixed(2)}/gal cheaper
              </div>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                at <span className="text-foreground">{opp.name}</span>, {opp.detourMinutes} min off
                your route
              </p>
            </>
          ) : (
            <>
              <div className="font-mono text-4xl font-semibold tracking-tight sm:text-5xl">
                ${opp.price.toFixed(2)}/gal
              </div>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                cheapest near you · <span className="text-foreground">{opp.name}</span>,{" "}
                {opp.detourMinutes} min away
              </p>
            </>
          )}

          {mapUrl && (
            <div className="mt-5 overflow-hidden rounded-xl border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mapUrl}
                alt={`Map preview for ${opp.name}`}
                width={600}
                height={200}
                className="h-[200px] w-full object-cover"
                loading="lazy"
              />
            </div>
          )}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button
              size="lg"
              className="h-11 flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
              render={
                <a href={directionsUrl} target="_blank" rel="noreferrer" />
              }
            >
              Get directions
            </Button>
            <Button size="lg" variant="ghost" className="h-11 flex-1">
              Not now
            </Button>
          </div>

          {wallet && opp.stationId && (
            <button
              type="button"
              className="mt-3 w-full text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              onClick={() => setReporting(opp.stationId)}
            >
              I just bought gas here — log it
            </button>
          )}

          <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
            {origin?.usedHome
              ? "Auto-detected from your home address."
              : "Auto-detected from your usual stations."}{" "}
            We&apos;ll notify you when it&apos;s worth detouring.
          </p>

          {!loaded && (
            <div className="mt-3 text-[11px] text-muted-foreground">Loading…</div>
          )}
        </div>
      </section>

      <ReportDialog stationId={reporting} onClose={() => setReporting(null)} />
    </>
  );
}
