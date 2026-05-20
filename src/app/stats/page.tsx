"use client";

{/*
DEMO PREP:
1. Run 'npm run agent:run' at least 8 minutes before going on stage
2. Verify /stats shows >50 tx_last_24h
3. Keep agent terminal visible during pitch as supplementary proof
4. Reference /stats during pitch for the "look at the live data" moment
*/}

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, Cpu, ExternalLink, Lock } from "lucide-react";
import { ConnectButton } from "@/components/ConnectButton";
import { LiveTxCounter } from "@/components/LiveTxCounter";
import { Wordmark } from "@/components/Wordmark";

type Stats = {
  totalTxLast24h: number;
  oracleQueriesLast24h: number;
  cashbackTxLast24h: number;
  stakeResolutionsTx24h: number;
  totalUsdcVolume24h: number;
  totalUsdcVolumeAllTime: number;
  agentQueryRatePerMinute: number;
  uniqueWalletsLast24h: number;
  masterWallet: string | null;
};

type ActivityKind = "agent_query" | "cashback" | "stake_resolution";

type ActivityRow = {
  id: string;
  kind: ActivityKind;
  description: string;
  amountUsdc: number;
  txHash: string | null;
  createdAt: string;
};

const POLL_MS = 5000;
const ARC_EXPLORER_TX = "https://testnet.arcscan.app/tx";
const ARC_EXPLORER_ADDR = "https://testnet.arcscan.app/address";

function timeAgo(iso: string): string {
  const ageMs = Date.now() - new Date(iso).getTime();
  if (ageMs < 60_000) return `${Math.max(1, Math.floor(ageMs / 1000))}s ago`;
  const m = Math.floor(ageMs / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Tile({
  label,
  value,
  emerald,
}: {
  label: string;
  value: string;
  emerald?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <p className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p
        className={`mt-3 font-mono text-[36px] font-medium leading-none tracking-tight sm:text-[48px] ${emerald ? "text-emerald-600" : "text-zinc-900"}`}
      >
        {value}
      </p>
    </div>
  );
}

function ActivityIcon({ kind }: { kind: ActivityKind }) {
  if (kind === "cashback") {
    return <Coins className="h-3.5 w-3.5 text-emerald-700" />;
  }
  if (kind === "stake_resolution") {
    return <Lock className="h-3.5 w-3.5 text-amber-700" />;
  }
  return <Cpu className="h-3.5 w-3.5 text-zinc-700" />;
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  // IDs we've ever observed — informational, written from `load`, never read
  // during render. The fade-in trigger comes from `newIds` (state) instead.
  const seenIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);
  // IDs that appeared in the most recent poll. Drives motion.li's `initial`
  // animation. Reading state (not ref) during render keeps the React 19
  // compiler happy and ensures the animation actually fires — the previous
  // implementation marked every fetched id "seen" inside `load` before
  // React re-rendered, so the ref check at render time was always false.
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([
        fetch("/api/stats", { cache: "no-store" }),
        fetch("/api/stats/activity", { cache: "no-store" }),
      ]);
      const sj = (await s.json()) as Stats;
      const aj = (await a.json()) as { activity: ActivityRow[] };

      // Compute new ids BEFORE merging into the seen set. Skip on the very
      // first load so the initial batch doesn't all animate in at once
      // (mirrors the AnimatePresence `initial={false}` intent below).
      const fresh = new Set<string>();
      if (!firstLoadRef.current) {
        for (const r of aj.activity) {
          if (!seenIdsRef.current.has(r.id)) fresh.add(r.id);
        }
      }
      for (const r of aj.activity) seenIdsRef.current.add(r.id);
      firstLoadRef.current = false;

      setStats(sj);
      setActivity(aj.activity);
      setNewIds(fresh);
    } catch {
      /* keep last */
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/95 px-6 backdrop-blur-[1px]">
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
          <Link href="/stats" className="font-medium text-zinc-900">
            Stats
          </Link>
          <Link href="/developers" className="hover:text-zinc-900">
            Developers
          </Link>
          <Link href="/pitch" className="hover:text-zinc-900">
            Pitch
          </Link>
          <LiveTxCounter />
          <ConnectButton />
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-12">
        <h1 className="text-[32px] font-medium tracking-tight text-zinc-900">
          Live activity
        </h1>
        <p className="mt-2 text-[14px] text-zinc-500">
          Instant x402 authorization on Arc Testnet, settled in gasless USDC
          batches via Circle Gateway. Updated every 5 seconds.
        </p>

        <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Tile
            label="Tx last 24h"
            value={stats ? stats.totalTxLast24h.toString() : "—"}
          />
          <Tile
            label="USDC volume 24h"
            value={
              stats ? `$${stats.totalUsdcVolume24h.toFixed(3)}` : "—"
            }
            emerald
          />
          <Tile
            label="Agent query rate"
            value={
              stats ? `${stats.agentQueryRatePerMinute.toFixed(1)}/min` : "—"
            }
          />
          <Tile
            label="Unique wallets"
            value={stats ? stats.uniqueWalletsLast24h.toString() : "—"}
          />
        </section>

        <section className="mt-12">
          <p className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Recent events
          </p>
          {activity.length === 0 ? (
            <p className="mt-4 text-[14px] text-zinc-500">No events yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-100">
              <AnimatePresence initial={false}>
                {activity.map((e) => {
                  const isNew = newIds.has(e.id);
                  return (
                    <motion.li
                      key={e.id}
                      initial={isNew ? { opacity: 0, y: -4 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white">
                          <ActivityIcon kind={e.kind} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[14px] text-zinc-900">
                            {e.description}
                          </p>
                          <p className="mt-0.5 text-[11px] text-zinc-400">
                            {timeAgo(e.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span
                          className={`font-mono text-[13px] ${e.kind === "stake_resolution" && e.description.includes("Slashed") ? "text-red-500" : "text-zinc-900"}`}
                        >
                          ${e.amountUsdc.toFixed(3)}
                        </span>
                        {/* arcscan only resolves real on-chain hashes (0x + 64 hex).
                            Agent-query rows store Circle Gateway batch UUIDs
                            instead, which arcscan can't look up — render those
                            as plain mono text so the link isn't broken. */}
                        {e.txHash && /^0x[0-9a-fA-F]{64}$/.test(e.txHash) ? (
                          <a
                            href={`${ARC_EXPLORER_TX}/${e.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-zinc-400 hover:text-zinc-700"
                            title="View on Arc explorer"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : e.txHash ? (
                          <span
                            className="font-mono text-[10px] text-zinc-400"
                            title={`Settled in a Circle Gateway batch (≈ every 2 min on Arc Testnet). Batch ID: ${e.txHash}`}
                          >
                            batch
                          </span>
                        ) : null}
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </section>

        {stats?.masterWallet && (
          <p className="mt-12 text-[12px] text-zinc-400">
            All transactions verifiable at{" "}
            <a
              href={`${ARC_EXPLORER_ADDR}/${stats.masterWallet}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-emerald-700 underline-offset-4 hover:underline"
            >
              testnet.arcscan.app/address/{stats.masterWallet.slice(0, 8)}…
              {stats.masterWallet.slice(-6)}
            </a>
          </p>
        )}
      </main>
    </div>
  );
}
