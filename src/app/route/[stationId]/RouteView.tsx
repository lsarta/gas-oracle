"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  cubicBezier,
} from "framer-motion";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { ConnectButton } from "@/components/ConnectButton";
import { Wordmark } from "@/components/Wordmark";
import { ReportDialog } from "@/components/ReportDialog";

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

type Me = {
  homeLat: number | null;
  homeLng: number | null;
  workLat: number | null;
  workLng: number | null;
};

const ROUTE_DRAW_MS = 1000;
const easeOutQuart = cubicBezier(0.22, 1, 0.36, 1);

function CountUp({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => `$${v.toFixed(2)}`);
  useEffect(() => {
    const ctl = animate(mv, value, { duration: 0.8, ease: easeOutQuart });
    return () => ctl.stop();
  }, [mv, value]);
  return (
    <motion.span className="font-mono text-[40px] font-medium leading-none tracking-tight text-emerald-600 sm:text-[48px]">
      {display}
    </motion.span>
  );
}

function buildStationMarker(): HTMLElement {
  const el = document.createElement("div");
  el.style.position = "relative";
  el.style.width = "32px";
  el.style.height = "32px";
  el.style.cursor = "pointer";

  const pulse = document.createElement("span");
  pulse.style.position = "absolute";
  pulse.style.inset = "0";
  pulse.style.borderRadius = "9999px";
  pulse.style.background = "#10b981";
  pulse.className = "gyas-stale-pulse";
  el.appendChild(pulse);

  const dot = document.createElement("span");
  dot.style.position = "absolute";
  dot.style.inset = "6px";
  dot.style.borderRadius = "9999px";
  dot.style.background = "#059669";
  dot.style.boxShadow = "0 0 0 2px #ffffff, 0 2px 6px rgba(0,0,0,0.2)";
  dot.style.display = "flex";
  dot.style.alignItems = "center";
  dot.style.justifyContent = "center";
  dot.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="22" x2="15" y2="22"/><line x1="4" y1="9" x2="14" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/></svg>`;
  el.appendChild(dot);
  return el;
}

function buildEndpointMarker(color: string): HTMLElement {
  const el = document.createElement("div");
  el.style.width = "12px";
  el.style.height = "12px";
  el.style.borderRadius = "9999px";
  el.style.background = color;
  el.style.boxShadow = "0 0 0 2px #ffffff, 0 1px 3px rgba(0,0,0,0.2)";
  return el;
}

export function RouteView({ stationId }: { stationId: string }) {
  const router = useRouter();
  const { user } = usePrivy();
  const wallet = user?.wallet?.address;

  const [rec, setRec] = useState<Recommendation | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null);
  const [panelIn, setPanelIn] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const oppUrl = wallet ? `/api/opportunity?wallet=${wallet}` : "/api/opportunity";
      const [oppRes, meRes] = await Promise.all([
        fetch(oppUrl, { cache: "no-store" }),
        wallet ? fetch(`/api/users/me?wallet=${wallet}`, { cache: "no-store" }) : null,
      ]);
      const oppJson = await oppRes.json();
      setRec(oppJson.recommendation ?? null);
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
    } finally {
      setLoaded(true);
    }
  }, [wallet]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Slide the panel in on mount.
  useEffect(() => {
    const id = setTimeout(() => setPanelIn(true), 50);
    return () => clearTimeout(id);
  }, []);

  // Initialize Mapbox GL once.
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
      zoom: 11,
      attributionControl: false,
    });
    mapRef.current.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      "bottom-left",
    );

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Render route + markers + animation when data is available.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !rec || !me) return;

    const onReady = () => {
      const coords = rec.routeGeometry?.coordinates ?? [];

      // ---- Route line source + layer (drawn empty initially)
      if (coords.length >= 2) {
        if (!map.getSource("route")) {
          map.addSource("route", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: coords.slice(0, 2) },
            },
          });
          map.addLayer({
            id: "route",
            type: "line",
            source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": "#059669",
              "line-width": 4,
              "line-opacity": 0.9,
            },
          });
        }

        // Animate the polyline drawing in.
        const start = performance.now();
        const animateDraw = () => {
          const elapsed = performance.now() - start;
          const t = Math.min(1, elapsed / ROUTE_DRAW_MS);
          const eased = 1 - Math.pow(1 - t, 3);
          const endIdx = Math.max(2, Math.floor(coords.length * eased));
          const partial = coords.slice(0, endIdx);
          const src = map.getSource("route") as mapboxgl.GeoJSONSource | undefined;
          if (src) {
            src.setData({
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: partial },
            });
          }
          if (t < 1) requestAnimationFrame(animateDraw);
        };
        requestAnimationFrame(animateDraw);
      }

      // ---- Markers
      const stationMarker = new mapboxgl.Marker({ element: buildStationMarker() })
        .setLngLat([rec.station.lng, rec.station.lat])
        .addTo(map);

      const homeMarker =
        me.homeLat !== null && me.homeLng !== null
          ? new mapboxgl.Marker({ element: buildEndpointMarker("#3b82f6") })
              .setLngLat([me.homeLng, me.homeLat])
              .addTo(map)
          : null;

      const workMarker =
        me.workLat !== null && me.workLng !== null
          ? new mapboxgl.Marker({ element: buildEndpointMarker("#71717a") })
              .setLngLat([me.workLng, me.workLat])
              .addTo(map)
          : null;

      // ---- Bounds: fit to all markers + route
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([rec.station.lng, rec.station.lat]);
      if (me.homeLat !== null && me.homeLng !== null) {
        bounds.extend([me.homeLng, me.homeLat]);
      }
      if (me.workLat !== null && me.workLng !== null) {
        bounds.extend([me.workLng, me.workLat]);
      }
      coords.forEach((c) => bounds.extend(c));
      map.fitBounds(bounds, {
        padding: { top: 80, right: 60, bottom: 60, left: 60 },
        duration: 0,
      });

      // Cleanup capture
      cleanupRef.current = () => {
        stationMarker.remove();
        homeMarker?.remove();
        workMarker?.remove();
        if (map.getLayer("route")) map.removeLayer("route");
        if (map.getSource("route")) map.removeSource("route");
      };
    };

    if (map.loaded()) onReady();
    else map.once("load", onReady);

    const cleanupRef = { current: () => {} };
    return () => cleanupRef.current();
  }, [rec, me]);

  const stationName = rec?.station.name ?? "";
  const noticeText = useMemo(() => {
    if (!loaded) return "Loading route…";
    if (!rec) return "No active recommendation. Head back home.";
    if (rec.station.id !== stationId) {
      return `Showing current best recommendation (${rec.station.name}). The station you came from is no longer the top opportunity.`;
    }
    return null;
  }, [loaded, rec, stationId]);

  return (
    <div className="flex h-screen flex-col">
      <header className="z-30 flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6">
        <Link href="/">
          <Wordmark size="sm" withMark />
        </Link>
        <nav className="flex items-center gap-6 text-[14px] text-zinc-700">
          <Link href="/" className="hover:text-zinc-900">
            Home
          </Link>
          <Link href="/map" className="hover:text-zinc-900">
            Map
          </Link>
          <ConnectButton />
        </nav>
      </header>

      <main className="relative min-h-0 flex-1">
        <div ref={containerRef} className="absolute inset-0" />

        {noticeText && !rec && (
          <div className="absolute left-1/2 top-6 z-10 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-[13px] text-zinc-700 shadow-sm">
            {noticeText}
          </div>
        )}

        {/* Side panel — slides in from right on desktop, up from bottom on mobile */}
        {rec && (
          <aside
            className={`absolute z-20 transform border-zinc-200 bg-white shadow-lg transition-transform duration-300 ease-out
              left-0 right-0 bottom-0 max-h-[60vh] overflow-y-auto rounded-t-2xl border-t
              ${panelIn ? "translate-y-0" : "translate-y-full"}
              md:left-auto md:right-0 md:top-0 md:bottom-0 md:max-h-none md:w-[400px] md:rounded-none md:border-l md:border-t-0
              ${panelIn ? "md:translate-x-0" : "md:translate-x-full"}`}
          >
            <div className="md:sticky md:top-0 px-6 pt-5">
              <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-zinc-300 md:hidden" />
              <p className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Recommended detour
              </p>
              <h1 className="mt-2 text-[22px] font-medium tracking-tight text-zinc-900">
                {stationName}
              </h1>
              <p className="text-[13px] text-zinc-500">{rec.station.address}</p>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    Detour
                  </span>
                  <span className="font-mono text-[14px] text-zinc-900">
                    {rec.detourMiles.toFixed(1)} mi · {rec.detourMinutes.toFixed(0)} min
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    Pump price
                  </span>
                  <span className="font-mono text-[14px] text-zinc-900">
                    ${rec.station.price.toFixed(2)}/gal
                  </span>
                </div>
              </div>

              <div>
                <p className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Save on your next fillup
                </p>
                <div className="mt-2">
                  <CountUp value={rec.netSavings} />
                </div>
                <p className="mt-3 font-mono text-[12px] leading-relaxed text-zinc-500">
                  ${rec.rawSavings.toFixed(2)} save − ${rec.detourTimeCost.toFixed(2)} time
                  − ${rec.detourGasCost.toFixed(2)} gas = ${rec.netSavings.toFixed(2)} net
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReporting(rec.station.id)}
                  className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-emerald-600 text-[15px] font-medium text-white transition-colors hover:bg-emerald-700"
                >
                  I filled up here
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="text-center text-[14px] text-zinc-500 hover:text-zinc-900"
                >
                  Cancel
                </button>
              </div>

              {noticeText && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
                  {noticeText}
                </p>
              )}
            </div>
          </aside>
        )}
      </main>

      <ReportDialog
        stationId={reporting}
        onClose={() => {
          setReporting(null);
          // After successful report, return home so the user sees their
          // updated activity numbers.
          router.push("/");
        }}
      />
    </div>
  );
}
