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
import { Button } from "@/components/ui/button";
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
};

const POLL_MS = 5000;

function freshnessColor(lastPricedAt: string | null): string {
  if (!lastPricedAt) return "#ef4444";
  const ageMs = Date.now() - new Date(lastPricedAt).getTime();
  if (ageMs < 60 * 60 * 1000) return "#10b981";
  if (ageMs < 6 * 60 * 60 * 1000) return "#f59e0b";
  return "#ef4444";
}

function buildMarkerEl(color: string): HTMLElement {
  const el = document.createElement("div");
  el.style.width = "32px";
  el.style.height = "32px";
  el.style.borderRadius = "50%";
  el.style.background = color;
  el.style.boxShadow = "0 0 0 3px white, 0 2px 6px rgba(0,0,0,0.18)";
  el.style.cursor = "pointer";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.transition =
    "background-color 400ms ease, transform 200ms ease, box-shadow 200ms ease";
  el.addEventListener("mouseenter", () => {
    el.style.transform = "scale(1.08)";
  });
  el.addEventListener("mouseleave", () => {
    el.style.transform = "scale(1)";
  });
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="22" x2="15" y2="22"/><line x1="4" y1="9" x2="14" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/></svg>`;
  return el;
}

function freshnessBadgeClasses(lastPricedAt: string | null): string {
  if (!lastPricedAt) return "bg-red-100 text-red-700";
  const ageMs = Date.now() - new Date(lastPricedAt).getTime();
  if (ageMs < 60 * 60 * 1000) return "bg-emerald-100 text-emerald-700";
  if (ageMs < 6 * 60 * 60 * 1000) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

export function StationMap({ canReport }: { canReport: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, { marker: mapboxgl.Marker; color: string }>>(
    new Map(),
  );
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
      style: "mapbox://styles/mapbox/navigation-day-v1",
      center: [-122.4194, 37.7749],
      zoom: 12,
    });
    mapRef.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

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
      const color = freshnessColor(s.lastPricedAt);
      const existing = markersRef.current.get(s.id);
      if (existing) {
        if (existing.color !== color) {
          existing.marker.getElement().style.background = color;
          markersRef.current.set(s.id, { marker: existing.marker, color });
        }
        existing.marker.setLngLat([s.lng, s.lat]);
      } else {
        const el = buildMarkerEl(color);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          setSelectedId(s.id);
        });
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([s.lng, s.lat])
          .addTo(map);
        markersRef.current.set(s.id, { marker, color });
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

  return (
    <>
      <div ref={containerRef} className="h-full w-full" />

      <Sheet open={selectedId !== null} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent side="bottom" className="max-h-[60vh] rounded-t-2xl pb-6 pt-2">
          <div className="mx-auto mt-1 mb-1 h-1 w-10 rounded-full bg-muted-foreground/30" />
          {selected && (
            <>
              <SheetHeader className="pb-2">
                <SheetTitle className="text-xl font-semibold tracking-tight">
                  {selected.name}
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {selected.address}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-5 px-4">
                <div className="flex items-end justify-between gap-3">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-4xl font-semibold tracking-tight">
                      {selected.currentPricePerGallon !== null
                        ? `$${selected.currentPricePerGallon.toFixed(2)}`
                        : "—"}
                    </span>
                    <span className="text-xs text-muted-foreground">/gal</span>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${freshnessBadgeClasses(selected.lastPricedAt)}`}
                  >
                    {selected.freshness}
                  </span>
                </div>
                {canReport ? (
                  <Button
                    size="lg"
                    className="h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => {
                      setReportingId(selected.id);
                      setSelectedId(null);
                    }}
                  >
                    I bought gas here
                  </Button>
                ) : (
                  <Button size="lg" className="h-11 w-full" disabled>
                    Sign in to report
                  </Button>
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
