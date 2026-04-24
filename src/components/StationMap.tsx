"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ReportDialog } from "@/components/ReportDialog";

export type Station = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  currentPricePerGallon: number | null;
  lastPricedAt: string | null;
  freshness: string;
  consensusConfidence: "high" | "medium" | "low" | null;
  consensusReportCount: number;
  activeBounty: number;
  requiresStake: boolean;
  stakeAmount: number;
};

const POLL_MS = 5000;

type Tier = "fresh" | "aging" | "stale" | "none";

function tierFor(lastPricedAt: string | null): Tier {
  if (!lastPricedAt) return "none";
  const ageMs = Date.now() - new Date(lastPricedAt).getTime();
  if (ageMs < 60 * 60 * 1000) return "fresh";
  if (ageMs < 6 * 60 * 60 * 1000) return "aging";
  return "stale";
}

const TIER_FILL: Record<Tier, string> = {
  fresh: "#10b981",
  aging: "#f59e0b",
  stale: "#f87171",
  none: "#f87171",
};

function buildMarkerEl(
  tier: Tier,
  lowConfidence: boolean,
  hasBounty: boolean,
): HTMLElement {
  const el = document.createElement("div");
  el.style.position = "relative";
  el.style.width = "20px";
  el.style.height = "20px";
  el.style.cursor = "pointer";

  const isStale = tier === "stale" || tier === "none";

  const pulse = document.createElement("span");
  pulse.style.position = "absolute";
  pulse.style.inset = "0";
  pulse.style.borderRadius = "9999px";
  pulse.style.background = TIER_FILL[tier];
  if (isStale) {
    pulse.className = "gyas-stale-pulse";
  } else {
    pulse.style.display = "none";
  }
  el.appendChild(pulse);

  const dot = document.createElement("span");
  dot.style.position = "absolute";
  dot.style.inset = "0";
  dot.style.borderRadius = "9999px";
  dot.style.background = TIER_FILL[tier];
  dot.style.boxShadow =
    "0 0 0 1.5px #ffffff, 0 1px 3px rgba(0,0,0,0.15)";
  dot.style.display = "flex";
  dot.style.alignItems = "center";
  dot.style.justifyContent = "center";
  dot.style.transition = "transform 200ms ease-out, box-shadow 200ms ease-out";
  if (lowConfidence) {
    dot.innerHTML = `<span style="color:white;font-family:system-ui,sans-serif;font-size:12px;font-weight:600;line-height:1;">?</span>`;
  } else {
    dot.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="22" x2="15" y2="22"/><line x1="4" y1="9" x2="14" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/></svg>`;
  }

  if (hasBounty) {
    const bountyDot = document.createElement("span");
    bountyDot.style.position = "absolute";
    bountyDot.style.top = "-2px";
    bountyDot.style.right = "-2px";
    bountyDot.style.width = "8px";
    bountyDot.style.height = "8px";
    bountyDot.style.borderRadius = "9999px";
    bountyDot.style.background = "#059669";
    bountyDot.style.boxShadow = "0 0 0 1.5px #ffffff";
    el.appendChild(bountyDot);
  }
  el.appendChild(dot);

  el.addEventListener("mouseenter", () => {
    dot.style.transform = "scale(1.15)";
    dot.style.boxShadow =
      "0 0 0 1.5px #059669, 0 1px 4px rgba(0,0,0,0.18)";
  });
  el.addEventListener("mouseleave", () => {
    dot.style.transform = "scale(1)";
    dot.style.boxShadow =
      "0 0 0 1.5px #ffffff, 0 1px 3px rgba(0,0,0,0.15)";
  });

  return el;
}

function freshnessBadgeClasses(tier: Tier): string {
  if (tier === "fresh") return "bg-emerald-50 text-emerald-700";
  if (tier === "aging") return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

export function StationMap({ canReport }: { canReport: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<
    Map<
      string,
      {
        marker: mapboxgl.Marker;
        tier: Tier;
        lowConfidence: boolean;
        hasBounty: boolean;
      }
    >
  >(new Map());
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error("NEXT_PUBLIC_MAPBOX_TOKEN missing");
      return;
    }
    mapboxgl.accessToken = token;
    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-122.4194, 37.7749],
      zoom: 12,
    });
    mapRef.current.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "top-right",
    );

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    let aborted = false;
    async function fetchStations() {
      try {
        const res = await fetch("/api/stations", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!aborted) setStations(json.stations as Station[]);
      } catch (err) {
        console.error("[StationMap] fetch failed:", err);
      }
    }
    fetchStations();
    const id = setInterval(fetchStations, POLL_MS);
    return () => {
      aborted = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const seen = new Set<string>();
    for (const s of stations) {
      seen.add(s.id);
      const freshTier = tierFor(s.lastPricedAt);
      // Consensus override: if the price exists but confidence is low, show
      // amber + "?" glyph so the user knows the data is thinly supported.
      // Null-price + any confidence stays red per freshTier (none).
      const lowConfidence =
        s.consensusConfidence === "low" && s.currentPricePerGallon !== null;
      const tier: Tier =
        lowConfidence && freshTier === "fresh" ? "aging" : freshTier;
      const hasBounty = s.activeBounty > 0;
      const existing = markersRef.current.get(s.id);
      if (existing) {
        if (
          existing.tier !== tier ||
          existing.lowConfidence !== lowConfidence ||
          existing.hasBounty !== hasBounty
        ) {
          existing.marker.remove();
          const el = buildMarkerEl(tier, lowConfidence, hasBounty);
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            setSelectedId(s.id);
          });
          const marker = new mapboxgl.Marker({ element: el })
            .setLngLat([s.lng, s.lat])
            .addTo(map);
          markersRef.current.set(s.id, { marker, tier, lowConfidence, hasBounty });
        } else {
          existing.marker.setLngLat([s.lng, s.lat]);
        }
      } else {
        const el = buildMarkerEl(tier, lowConfidence, hasBounty);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          setSelectedId(s.id);
        });
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([s.lng, s.lat])
          .addTo(map);
        markersRef.current.set(s.id, { marker, tier, lowConfidence, hasBounty });
      }
    }
    for (const [id, { marker }] of markersRef.current) {
      if (!seen.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }
  }, [stations]);

  const selected = stations.find((s) => s.id === selectedId) ?? null;
  const selectedTier = selected ? tierFor(selected.lastPricedAt) : "none";

  return (
    <>
      <div ref={containerRef} className="h-full w-full" />

      <Sheet open={selectedId !== null} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent
          side="bottom"
          className="max-h-[60vh] rounded-t-2xl border-zinc-200 bg-[#FAFAF8] pb-6 pt-2"
        >
          <div className="mx-auto mt-3 mb-2 h-1 w-9 rounded-full bg-zinc-300" />
          {selected && (
            <>
              <SheetHeader className="px-5 pb-3">
                <SheetTitle className="text-[20px] font-medium text-zinc-900">
                  {selected.name}
                </SheetTitle>
                <SheetDescription className="text-[13px] text-zinc-500">
                  {selected.address}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-5 px-5">
                <div className="flex items-end justify-between gap-3">
                  <div className="font-mono text-[40px] font-medium leading-none tracking-tight text-zinc-900">
                    {selected.currentPricePerGallon !== null
                      ? `$${selected.currentPricePerGallon.toFixed(2)}`
                      : "—"}
                    <span className="ml-1 text-[14px] font-normal text-zinc-500">/gal</span>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 font-inter text-[11px] font-medium uppercase tracking-wider ${freshnessBadgeClasses(selectedTier)}`}
                  >
                    {selected.freshness}
                  </span>
                </div>
                {(() => {
                  const n = selected.consensusReportCount;
                  const c = selected.consensusConfidence;
                  if (n === 0 || c === null) return null;
                  const label =
                    n === 1
                      ? `Based on ${n} report · low confidence`
                      : `${n} reports in last 2 hours · ${c} confidence`;
                  const cls =
                    c === "low"
                      ? "text-[12px] text-amber-700"
                      : "text-[12px] text-zinc-500";
                  return <p className={cls}>{label}</p>;
                })()}
                {selected.activeBounty > 0 && (
                  <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <span className="inline-flex rounded-full bg-emerald-600 px-2 py-0.5 font-inter text-[10px] font-medium uppercase tracking-wider text-white">
                      Bounty ${selected.activeBounty.toFixed(2)} — stale price
                    </span>
                    <p className="text-[12px] leading-snug text-emerald-900">
                      {selected.requiresStake
                        ? `Report this station's current price to claim. Stake $${selected.stakeAmount.toFixed(2)} required.`
                        : `Report this station's current price to claim $${selected.activeBounty.toFixed(2)} bounty.`}
                    </p>
                  </div>
                )}
                {canReport ? (
                  <button
                    onClick={() => {
                      setReportingId(selected.id);
                      setSelectedId(null);
                    }}
                    className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-emerald-600 text-[15px] font-medium text-white transition-colors hover:bg-emerald-700"
                  >
                    I bought gas here
                  </button>
                ) : (
                  <button
                    disabled
                    className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-zinc-200 bg-white text-[15px] font-medium text-zinc-700 disabled:opacity-70"
                  >
                    Sign in to report
                  </button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ReportDialog
        stationId={reportingId}
        onClose={() => setReportingId(null)}
      />
    </>
  );
}
