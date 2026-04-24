"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@/components/ConnectButton";
import { Wordmark } from "@/components/Wordmark";

type Location = {
  id: string;
  name: string;
  address: string;
  currentHourlyRate: number | null;
  freshness: string;
};

const CURL_EXAMPLE = `curl -X GET "https://www.gyasss.com/api/oracle/cheapest-parking?lat=37.7749&lng=-122.4194&radiusMinutes=10" \\
  -H "payment-signature: <base64 x402 payload>"
# Returns 402 PAYMENT-REQUIRED on first call.
# Pay $0.001 USDC on Arc, then retry. Same protocol as cheapest-gas.`;

function freshnessClasses(label: string): string {
  if (label.endsWith("m ago") || label === "just now") return "bg-emerald-50 text-emerald-700";
  if (label.endsWith("h ago")) {
    const hours = parseInt(label, 10);
    if (Number.isFinite(hours) && hours < 6) return "bg-emerald-50 text-emerald-700";
    if (Number.isFinite(hours) && hours < 12) return "bg-amber-50 text-amber-700";
  }
  return "bg-red-50 text-red-700";
}

export default function ParkingPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let aborted = false;
    fetch("/api/parking/locations", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (aborted) return;
        setLocations(j.locations as Location[]);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      aborted = true;
    };
  }, []);

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
          <Link href="/verticals" className="hover:text-zinc-900">
            Verticals
          </Link>
          <ConnectButton />
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[720px] flex-1 px-6 py-12">
        <div className="mb-8">
          <p className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Parking
          </p>
          <h1 className="mt-2 text-[32px] font-medium tracking-tight text-zinc-900">
            Parking
          </h1>
          <p className="mt-2 text-[16px] leading-relaxed text-zinc-500">
            Real-time hourly rates across SF parking. Same oracle, different commodity.
          </p>
        </div>

        {!loaded ? (
          <p className="text-[14px] text-zinc-500">Loading…</p>
        ) : locations.length === 0 ? (
          <p className="text-[14px] text-zinc-500">No parking locations yet.</p>
        ) : (
          <ul className="space-y-3">
            {locations.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-5"
              >
                <div className="min-w-0">
                  <div className="text-[16px] font-medium text-zinc-900">{l.name}</div>
                  <div className="mt-0.5 text-[13px] text-zinc-500">{l.address}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="font-mono text-[24px] font-medium leading-none tracking-tight text-zinc-900">
                    {l.currentHourlyRate !== null ? `$${l.currentHourlyRate.toFixed(2)}` : "—"}
                    <span className="ml-1 font-inter text-[12px] font-normal text-zinc-500">
                      /hr
                    </span>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 font-inter text-[10px] font-medium uppercase tracking-wider ${freshnessClasses(l.freshness)}`}
                  >
                    {l.freshness}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        <section className="mt-12 rounded-xl border border-zinc-200 bg-[#FAFAF8] p-6">
          <p className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Build on this oracle
          </p>
          <h2 className="mt-2 text-[18px] font-medium text-zinc-900">
            Same x402 protocol as Gas. $0.001 per query.
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-zinc-600">
            Hit the endpoint with an x402 payment signature. We verify, settle on Arc,
            and return the cheapest in-radius parking.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 bg-white p-4 font-mono text-[12px] leading-relaxed text-zinc-700">
            <code>{CURL_EXAMPLE}</code>
          </pre>
        </section>
      </main>
    </div>
  );
}
