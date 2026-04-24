"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { ReportDialog } from "@/components/ReportDialog";

type Me = {
  totalEarnedUsdc: number;
  totalSavedUsd: number;
  reportsCount: number;
};

type RecentReport = {
  id: string;
  stationName: string;
  pricePerGallon: number | null;
  payoutAmountUsdc: number | null;
  createdAt: string;
};

type Station = { id: string; name: string; address: string };

const POLL_MS = 10_000;

function timeAgo(iso: string): string {
  const ageMs = Date.now() - new Date(iso).getTime();
  if (ageMs < 60_000) return "just now";
  const m = Math.floor(ageMs / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function ActivitySection({ wallet }: { wallet: string }) {
  const [me, setMe] = useState<Me | null>(null);
  const [reports, setReports] = useState<RecentReport[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    async function load() {
      try {
        const [meRes, repRes] = await Promise.all([
          fetch(`/api/users/me?wallet=${wallet}`, { cache: "no-store" }),
          fetch(`/api/reports/recent`, { cache: "no-store" }),
        ]);
        const meJson = await meRes.json();
        const repJson = await repRes.json();
        if (aborted) return;
        if (meJson.user) {
          setMe({
            totalEarnedUsdc: Number(meJson.user.totalEarnedUsdc),
            totalSavedUsd: Number(meJson.user.totalSavedUsd),
            reportsCount: Number(meJson.user.reportsCount),
          });
        }
        const all = (repJson.reports as RecentReport[]) ?? [];
        setReports(all.slice(0, 5));
      } catch {
        /* ignore */
      }
    }
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      aborted = true;
      clearInterval(id);
    };
  }, [wallet]);

  useEffect(() => {
    fetch("/api/stations")
      .then((r) => r.json())
      .then((j) =>
        setStations(
          (j.stations as Station[]).map((s) => ({
            id: s.id,
            name: s.name,
            address: s.address,
          })),
        ),
      )
      .catch(() => {});
  }, []);

  const earnings = me?.totalEarnedUsdc ?? 0;
  const savings = me?.totalSavedUsd ?? 0;

  return (
    <>
      <section className="mx-auto mt-12 w-full max-w-[560px]">
        <p className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Your activity
        </p>

        <div className="mt-3 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-1">
              <p className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Lifetime savings
              </p>
              <span
                className="group relative inline-flex"
                aria-label="Net savings after detour time and fuel cost."
              >
                <Info className="h-3 w-3 text-zinc-400" />
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 w-52 -translate-x-1/2 rounded-md border border-zinc-200 bg-white p-2 text-[11px] text-zinc-700 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                >
                  Net savings after detour time and fuel cost.
                </span>
              </span>
            </div>
            <p
              className={`mt-2 font-mono text-[28px] font-medium leading-none tracking-tight ${savings > 0 ? "text-emerald-600" : "text-zinc-900"}`}
            >
              {savings > 0 ? `$${savings.toFixed(2)}` : "—"}
            </p>
            {savings === 0 && (
              <p className="mt-2 text-[12px] leading-snug text-zinc-500">
                Activates when you take a recommended detour.
              </p>
            )}
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <p className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Lifetime earnings
            </p>
            <p
              className={`mt-2 font-mono text-[28px] font-medium leading-none tracking-tight ${earnings > 0 ? "text-emerald-600" : "text-zinc-900"}`}
            >
              ${earnings.toFixed(3)}
            </p>
          </div>
        </div>

        <p className="mt-8 font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Recent
        </p>

        {reports.length === 0 ? (
          <div className="mt-3">
            <p className="text-[14px] text-zinc-500">No reports yet.</p>
            <p className="mt-1 text-[12px] text-zinc-400">
              Tap the map to confirm a price.
            </p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100">
            {reports.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-[14px] text-zinc-900">{r.stationName}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-zinc-500">
                    {r.pricePerGallon !== null
                      ? `$${r.pricePerGallon.toFixed(2)}/gal`
                      : "no price"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[14px] text-emerald-600">
                    +${(r.payoutAmountUsdc ?? 0).toFixed(3)} USDC
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-400">
                    {timeAgo(r.createdAt)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="relative mt-6">
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            className="flex h-10 w-full items-center justify-center rounded-lg border border-zinc-200 bg-white text-[14px] text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900"
          >
            Report a price
          </button>
          {pickerOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-sm">
              {stations.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="block w-full rounded-md px-3 py-2 text-left text-[14px] hover:bg-zinc-50"
                  onClick={() => {
                    setReporting(s.id);
                    setPickerOpen(false);
                  }}
                >
                  <div className="font-medium text-zinc-900">{s.name}</div>
                  <div className="truncate text-[11px] text-zinc-500">{s.address}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <ReportDialog stationId={reporting} onClose={() => setReporting(null)} />
    </>
  );
}
