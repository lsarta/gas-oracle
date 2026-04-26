"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@/components/ConnectButton";
import { LiveTxCounter } from "@/components/LiveTxCounter";
import { Wordmark } from "@/components/Wordmark";

type Row = { name: string; sub: string; price: string };

type Vertical = {
  key: string;
  status: "live" | "preview";
  title: string;
  blurb: string;
  href?: string;
  rows: Row[];
  footer: string;
};

type ParkingLocation = {
  id: string;
  name: string;
  address: string;
  currentHourlyRate: number | null;
};

const STATIC_GAS: Vertical = {
  key: "gas",
  status: "live",
  title: "Gas",
  blurb: "Live real-time USDC cashback for gas price reports.",
  href: "/",
  rows: [
    { name: "Arco — Mission", sub: "1798 Mission St", price: "$4.97/gal" },
    { name: "Chevron — 26th St", sub: "1500 26th St", price: "$4.92/gal" },
    { name: "Shell — Bryant", sub: "390 Bryant St", price: "$5.39/gal" },
  ],
  footer: "Same x402 oracle. Same Arc settlement. Different commodity.",
};

const STATIC_EV: Vertical = {
  key: "ev",
  status: "preview",
  title: "EV charging",
  blurb: "Per-kWh charging rates across networks.",
  rows: [
    { name: "EVgo — Geary", sub: "3500 Geary Blvd", price: "$0.48/kWh" },
    { name: "ChargePoint — Embarcadero", sub: "1 Embarcadero", price: "$0.35/kWh" },
    { name: "Tesla Supercharger — Mission", sub: "1798 Mission St", price: "$0.42/kWh" },
  ],
  footer: "Same architecture. Different commodity.",
};

function StatusPill({ status }: { status: "live" | "preview" }) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 font-inter text-[10px] font-medium uppercase tracking-wider text-emerald-700">
        <span className="relative flex h-1.5 w-1.5">
          <span
            className="gyas-dot-pulse absolute inset-0 rounded-full bg-emerald-600"
            aria-hidden
          />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-600" />
        </span>
        Live
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 font-inter text-[10px] font-medium uppercase tracking-wider text-zinc-600">
      Coming soon
    </span>
  );
}

function VerticalCard({ v }: { v: Vertical }) {
  const inner = (
    <article className="group flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-300">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-medium text-zinc-900">{v.title}</h2>
        <StatusPill status={v.status} />
      </div>
      <p className="mt-2 text-[14px] leading-relaxed text-zinc-600">{v.blurb}</p>

      <div className="my-4 h-px bg-zinc-100" />

      <ul className="space-y-1">
        {v.rows.map((r) => (
          <li key={`${r.name}-${r.sub}`} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-[14px] text-zinc-900">{r.name}</div>
              <div className="text-[11px] text-zinc-500">{r.sub}</div>
            </div>
            <div className="font-mono text-[14px] text-zinc-900">{r.price}</div>
          </li>
        ))}
      </ul>

      <p className="mt-4 font-inter text-[11px] text-zinc-400">{v.footer}</p>
    </article>
  );
  return v.href ? (
    <Link href={v.href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function buildParkingVertical(locs: ParkingLocation[]): Vertical {
  const top3 = locs.slice(0, 3);
  return {
    key: "parking",
    status: "live",
    title: "Parking",
    blurb: "Real-time hourly rates across SF parking. Same oracle, fresh data.",
    href: "/parking",
    rows:
      top3.length > 0
        ? top3.map((l) => ({
            name: l.name,
            sub: l.address.replace(", SF", ""),
            price:
              l.currentHourlyRate !== null
                ? `$${l.currentHourlyRate.toFixed(2)}/hr`
                : "—",
          }))
        : [
            { name: "5th & Mission Garage", sub: "833 Mission St", price: "$12.00/hr" },
            { name: "SoMa Lot", sub: "475 5th St", price: "$8.00/hr" },
            { name: "Mission St Meter", sub: "2400 Mission St", price: "$5.50/hr" },
          ],
    footer: "Same x402 oracle. Same Arc settlement. Different commodity.",
  };
}

export default function VerticalsPage() {
  const [parking, setParking] = useState<ParkingLocation[]>([]);

  useEffect(() => {
    let aborted = false;
    fetch("/api/parking/locations", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (aborted) return;
        setParking(
          (j.locations as ParkingLocation[]).slice().sort((a, b) =>
            (a.currentHourlyRate ?? Infinity) - (b.currentHourlyRate ?? Infinity),
          ),
        );
      })
      .catch(() => {});
    return () => {
      aborted = true;
    };
  }, []);

  const verticals: Vertical[] = [STATIC_GAS, buildParkingVertical(parking), STATIC_EV];

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
          <Link href="/verticals" className="font-medium text-zinc-900">
            Verticals
          </Link>
          <Link href="/stats" className="hover:text-zinc-900">
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

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 py-16">
        <div className="mb-10">
          <p className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Future verticals
          </p>
          <h1 className="mt-2 text-[32px] font-medium tracking-tight text-zinc-900 sm:text-[40px]">
            One protocol, every priced asset.
          </h1>
          <p className="mt-3 max-w-[640px] text-[16px] leading-relaxed text-zinc-600">
            The same loop — agents pay for verified prices, humans earn for confirming
            them — works anywhere prices change faster than directories can keep up.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {verticals.map((v) => (
            <VerticalCard key={v.key} v={v} />
          ))}
        </div>
      </main>
    </div>
  );
}
