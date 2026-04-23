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
  el.style.width = "28px";
  el.style.height = "28px";
  el.style.borderRadius = "50%";
  el.style.background = color;
  el.style.boxShadow = "0 0 0 3px white, 0 1px 4px rgba(0,0,0,0.25)";
  el.style.cursor = "pointer";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="22" x2="15" y2="22"/><line x1="4" y1="9" x2="14" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/></svg>`;
  return el;
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
      style: "mapbox://styles/mapbox/light-v11",
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
        <SheetContent side="bottom" className="max-h-[60vh]">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-lg">{selected.name}</SheetTitle>
                <SheetDescription>{selected.address}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tabular-nums">
                    {selected.currentPricePerGallon !== null
                      ? `$${selected.currentPricePerGallon.toFixed(3)}`
                      : "—"}
                  </span>
                  <span className="text-sm text-muted-foreground">/ gallon</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Last updated: {selected.freshness}
                </div>
                {canReport ? (
                  <Button
                    className="w-full"
                    onClick={() => {
                      setReportingId(selected.id);
                      setSelectedId(null);
                    }}
                  >
                    I bought gas here
                  </Button>
                ) : (
                  <Button className="w-full" disabled>
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
