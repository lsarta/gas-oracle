"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

type Me = {
  totalEarnedUsdc: number;
  reportsCount: number;
};

const POLL_MS = 10_000;

export function EarningsPanel() {
  const { authenticated, user } = usePrivy();
  const wallet = user?.wallet?.address;
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (!authenticated || !wallet) {
      setMe(null);
      return;
    }
    let aborted = false;
    async function load() {
      try {
        const res = await fetch(`/api/users/me?wallet=${wallet}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (aborted) return;
        if (json.user) {
          setMe({
            totalEarnedUsdc: Number(json.user.totalEarnedUsdc),
            reportsCount: Number(json.user.reportsCount),
          });
        }
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
  }, [authenticated, wallet]);

  if (!authenticated || !me) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-30">
      <div className="pointer-events-auto rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Lifetime earnings
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-600">
          ${me.totalEarnedUsdc.toFixed(6)}{" "}
          <span className="text-xs font-medium text-muted-foreground">USDC</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {me.reportsCount} report{me.reportsCount === 1 ? "" : "s"} submitted
        </p>
      </div>
    </div>
  );
}
