"use client";

import Link from "next/link";
import { ConnectButton } from "@/components/ConnectButton";
import { Fuel, ParkingCircle, Zap } from "lucide-react";

type SamplePoint = {
  name: string;
  detail: string;
  price: string;
  freshness: string;
};

type Vertical = {
  key: string;
  status: "live" | "preview";
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  blurb: string;
  href?: string;
  points: SamplePoint[];
};

const VERTICALS: Vertical[] = [
  {
    key: "gas",
    status: "live",
    Icon: Fuel,
    title: "Gas",
    blurb: "Drivers earn cashback for confirming pump prices in real time.",
    href: "/",
    points: [
      { name: "Arco — Mission", detail: "1798 Mission St", price: "$4.97/gal", freshness: "just now" },
      { name: "Arco — Sloat", detail: "1500 Sloat Blvd", price: "$5.09/gal", freshness: "1h ago" },
      { name: "Valero — Geary", detail: "3550 Geary Blvd", price: "$5.19/gal", freshness: "4h ago" },
    ],
  },
  {
    key: "parking",
    status: "preview",
    Icon: ParkingCircle,
    title: "Parking",
    blurb: "Garage operators publish per-hour rates; commuters confirm them on arrival.",
    points: [
      { name: "Sutter Stockton Garage", detail: "330 Sutter St", price: "$3.50/hr", freshness: "12m ago" },
      { name: "Mission Bay Lot 5", detail: "5th & Mission", price: "$4.00/hr", freshness: "3h ago" },
      { name: "Embarcadero Center", detail: "1 Embarcadero", price: "$5.00/hr", freshness: "8h ago" },
    ],
  },
  {
    key: "ev",
    status: "preview",
    Icon: Zap,
    title: "EV charging",
    blurb: "Real kWh prices, surge windows, and stall availability — confirmed by drivers.",
    points: [
      { name: "EVgo — SoMa", detail: "888 Brannan St", price: "$0.32/kWh", freshness: "just now" },
      { name: "Tesla Supercharger — Octavia", detail: "45 Page St", price: "$0.41/kWh", freshness: "30m ago" },
      { name: "ChargePoint — Marina", detail: "3850 Lyon St", price: "$0.39/kWh", freshness: "2h ago" },
    ],
  },
];

export default function VerticalsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Gyas
          </Link>
          <nav className="hidden gap-4 text-sm text-muted-foreground sm:flex">
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <Link href="/map" className="hover:text-foreground">
              Map
            </Link>
            <Link href="/verticals" className="font-medium text-foreground">
              Verticals
            </Link>
          </nav>
        </div>
        <ConnectButton />
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <div className="mb-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Future verticals
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            One protocol, every priced asset.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            The same loop — agents pay for verified prices, humans earn for confirming
            them — works anywhere prices change faster than directories can keep up.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VERTICALS.map((v) => (
            <article
              key={v.key}
              className="flex flex-col rounded-2xl border bg-card p-5 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <v.Icon className="h-4 w-4" />
                  </div>
                  <h2 className="text-lg font-semibold">{v.title}</h2>
                </div>
                <span
                  className={
                    v.status === "live"
                      ? "rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-700"
                      : "rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                  }
                >
                  {v.status === "live" ? "Live" : "Coming soon"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{v.blurb}</p>

              <ul className="mt-4 divide-y border-y">
                {v.points.map((p) => (
                  <li key={p.name} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {p.detail} · {p.freshness}
                      </div>
                    </div>
                    <div className="font-mono text-sm font-semibold tabular-nums">
                      {p.price}
                    </div>
                  </li>
                ))}
              </ul>

              {v.href ? (
                <Link
                  href={v.href}
                  className="mt-4 text-center text-xs font-medium text-emerald-700 underline-offset-4 hover:underline"
                >
                  Open live demo →
                </Link>
              ) : (
                <span className="mt-4 text-center text-xs text-muted-foreground">
                  Same primitives, different vertical.
                </span>
              )}
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
