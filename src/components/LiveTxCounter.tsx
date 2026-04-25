"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

type Stats = {
  totalTxLast24h: number;
  oracleQueriesLast24h: number;
  cashbackTxLast24h: number;
  stakeResolutionsTx24h: number;
  totalUsdcVolume24h: number;
  totalUsdcVolumeAllTime: number;
  agentQueryRatePerMinute: number;
  uniqueWalletsLast24h: number;
};

const POLL_MS = 5000;

export function LiveTxCounter() {
  const { ready, authenticated } = usePrivy();
  const [stats, setStats] = useState<Stats | null>(null);
  const [hover, setHover] = useState(false);

  // Don't poll if the user isn't signed in — saves API calls and matches
  // the "hide on signed-out landing" requirement. The counter still renders
  // on all signed-in surfaces (home, /map, /verticals, /parking, /settings,
  // /route/[id]).
  const active = ready && authenticated;

  useEffect(() => {
    if (!active) return;
    let aborted = false;
    async function load() {
      try {
        const r = await fetch("/api/stats", { cache: "no-store" });
        const j = (await r.json()) as Stats;
        if (!aborted) setStats(j);
      } catch {
        /* keep last value */
      }
    }
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      aborted = true;
      clearInterval(id);
    };
  }, [active]);

  if (!active) return null;

  const total = stats?.totalTxLast24h ?? 0;
  const labelText =
    total === 0 ? "Live · waiting for traffic" : `${total} onchain · last 24h`;

  return (
    <div
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        aria-live="polite"
        className="inline-flex cursor-default items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1"
      >
        <span className="relative flex h-2 w-2">
          <span
            className="gyas-dot-pulse absolute inset-0 rounded-full bg-emerald-600"
            aria-hidden
          />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
        </span>
        <span className="font-mono text-[12px] tracking-tight text-zinc-700">
          {labelText}
        </span>
      </div>

      {hover && stats && (
        <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-lg border border-zinc-200 bg-white p-3 shadow-md">
          <div className="space-y-1.5 text-[12px]">
            <Row
              label="Agent queries"
              value={stats.oracleQueriesLast24h.toString()}
            />
            <Row
              label="Cashback payouts"
              value={stats.cashbackTxLast24h.toString()}
            />
            <Row
              label="Stake resolutions"
              value={stats.stakeResolutionsTx24h.toString()}
            />
            <div className="my-2 h-px bg-zinc-100" />
            <Row
              label="USDC volume (24h)"
              value={`$${stats.totalUsdcVolume24h.toFixed(3)}`}
              emerald
            />
            <Row
              label="USDC volume (all-time)"
              value={`$${stats.totalUsdcVolumeAllTime.toFixed(3)}`}
            />
            <Row
              label="Agent rate"
              value={`${stats.agentQueryRatePerMinute.toFixed(1)}/min`}
            />
            <Row
              label="Unique wallets (24h)"
              value={stats.uniqueWalletsLast24h.toString()}
            />
          </div>
          <a
            href="/stats"
            className="mt-3 block text-center font-mono text-[11px] uppercase tracking-wider text-emerald-700 hover:text-emerald-900"
          >
            View live activity →
          </a>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  emerald,
}: {
  label: string;
  value: string;
  emerald?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="font-inter text-zinc-500">{label}</span>
      <span
        className={`font-mono ${emerald ? "text-emerald-600" : "text-zinc-900"}`}
      >
        {value}
      </span>
    </div>
  );
}
