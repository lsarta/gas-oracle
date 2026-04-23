"use client";

import Link from "next/link";
import { ConnectButton } from "@/components/ConnectButton";
import { Wordmark } from "@/components/Wordmark";

type Row = { name: string; sub: string; price: string };

type Vertical = {
  key: string;
  status: "live" | "preview";
  title: string;
  blurb: string;
  href?: string;
  rows: Row[];
};

const VERTICALS: Vertical[] = [
  {
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
  },
  {
    key: "parking",
    status: "preview",
    title: "Parking",
    blurb: "Dynamic street and lot pricing for urban parking.",
    rows: [
      { name: "5th & Mission Garage", sub: "833 Mission St", price: "$12/hr" },
      { name: "SoMa Lot", sub: "888 Brannan St", price: "$8/hr" },
      { name: "Union Square Meter", sub: "Stockton & Geary", price: "$5.50/hr" },
    ],
  },
  {
    key: "ev",
    status: "preview",
    title: "EV charging",
    blurb: "Per-kWh charging rates across networks.",
    rows: [
      { name: "EVgo — Geary", sub: "3500 Geary Blvd", price: "$0.48/kWh" },
      { name: "ChargePoint — Embarcadero", sub: "1 Embarcadero", price: "$0.35/kWh" },
      { name: "Tesla Supercharger — Mission", sub: "1798 Mission St", price: "$0.42/kWh" },
    ],
  },
];

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
    <article className="group flex flex-col rounded-xl border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-300">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-medium text-zinc-900">{v.title}</h2>
        <StatusPill status={v.status} />
      </div>
      <p className="mt-2 text-[14px] leading-relaxed text-zinc-600">{v.blurb}</p>

      <div className="my-4 h-px bg-zinc-100" />

      <ul className="space-y-1">
        {v.rows.map((r) => (
          <li
            key={r.name}
            className="flex items-center justify-between gap-3 py-2"
          >
            <div className="min-w-0">
              <div className="truncate text-[14px] text-zinc-900">{r.name}</div>
              <div className="text-[11px] text-zinc-500">{r.sub}</div>
            </div>
            <div className="font-mono text-[14px] text-zinc-900">{r.price}</div>
          </li>
        ))}
      </ul>

      <p className="mt-4 font-inter text-[11px] text-zinc-400">
        Same architecture. Different commodity.
      </p>
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

export default function VerticalsPage() {
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
          {VERTICALS.map((v) => (
            <VerticalCard key={v.key} v={v} />
          ))}
        </div>
      </main>
    </div>
  );
}
