"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ReportDialog } from "@/components/ReportDialog";
import { ChevronDown } from "lucide-react";

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

  return (
    <>
      <section className="mx-auto mt-8 w-full max-w-[600px]">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border bg-card p-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Lifetime savings
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
              ${(me?.totalSavedUsd ?? 0).toFixed(2)}
            </div>
            <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
              from following our recommendations
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Lifetime earnings
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold tracking-tight text-emerald-600 sm:text-3xl">
              ${(me?.totalEarnedUsdc ?? 0).toFixed(6)}
            </div>
            <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
              USDC for confirming gas prices
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Recent activity
            </div>
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPickerOpen((o) => !o)}
              >
                Report a price <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
              {pickerOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 max-h-72 w-72 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
                  {stations.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        setReporting(s.id);
                        setPickerOpen(false);
                      }}
                    >
                      <div className="font-medium">{s.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {s.address}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {reports.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              No reports yet — confirm your first gas price to start earning.
            </div>
          ) : (
            <ul className="divide-y">
              {reports.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{r.stationName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {timeAgo(r.createdAt)}
                      {r.pricePerGallon !== null
                        ? ` · $${r.pricePerGallon.toFixed(2)}/gal`
                        : ""}
                    </div>
                  </div>
                  <div className="font-mono text-sm font-semibold tabular-nums text-emerald-600">
                    +${(r.payoutAmountUsdc ?? 0).toFixed(3)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <ReportDialog stationId={reporting} onClose={() => setReporting(null)} />
    </>
  );
}
