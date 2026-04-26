"use client";

import { useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@/components/ConnectButton";
import { LiveTxCounter } from "@/components/LiveTxCounter";
import { Wordmark } from "@/components/Wordmark";

type EndpointSpec = {
  path: string;
  description: string;
  exampleResponse: string;
};

const ENDPOINTS: EndpointSpec[] = [
  {
    path: "/api/oracle/cheapest-gas",
    description:
      "Returns the cheapest gas station within a radius. Price data is transaction-verified and consensus-weighted across recent reports.",
    exampleResponse: `{
  "station": {
    "name": "Arco",
    "address": "1798 Mission St, San Francisco",
    "lat": 37.7693,
    "lng": -122.4198,
    "price": 4.97,
    "lastUpdated": "2026-04-25T18:42:11.000Z"
  },
  "distanceMiles": 1.5,
  "queriedAt": "2026-04-25T18:58:33.211Z"
}`,
  },
  {
    path: "/api/oracle/cheapest-parking",
    description:
      "Returns the cheapest parking location within a radius. Same architecture, different commodity.",
    exampleResponse: `{
  "location": {
    "name": "Mission St Meter",
    "address": "2400 Mission St, SF",
    "lat": 37.7592,
    "lng": -122.4187,
    "hourlyRate": 5.5,
    "lastUpdated": "2026-04-25T18:50:00.000Z"
  },
  "distanceMiles": 0.8,
  "queriedAt": "2026-04-25T18:58:33.211Z"
}`,
  },
];

const PARAMS: Array<{ name: string; type: string; required: boolean; desc: string }> = [
  { name: "lat", type: "number", required: true, desc: "Latitude of query origin" },
  { name: "lng", type: "number", required: true, desc: "Longitude of query origin" },
  {
    name: "radiusMinutes",
    type: "number",
    required: false,
    desc: "Search radius in driving minutes (default 5)",
  },
];

const CURL_EXAMPLE = `curl -i "https://gyasss.com/api/oracle/cheapest-gas?lat=37.7749&lng=-122.4194&radiusMinutes=5"

# Returns 402 Payment Required with a base64-encoded payment-required
# header. Sign the EIP-3009 authorization, attach as PAYMENT-SIGNATURE,
# retry — the server settles via Circle Gateway and returns the data.`;

const AISA_EXAMPLE = `git clone https://github.com/AIsa-team/nanopayment-x402
cd nanopayment-x402
npm install
# follow setup, then:
node scripts/x402_client.mjs GET \\
  "https://gyasss.com/api/oracle/cheapest-gas?lat=37.7749&lng=-122.4194"`;

const TS_EXAMPLE = `import { GatewayClient } from "@circle-fin/x402-batching/client";

const client = new GatewayClient({
  chain: "arcTestnet",
  privateKey: process.env.PRIVATE_KEY,
});

const { data } = await client.pay(
  "https://gyasss.com/api/oracle/cheapest-gas?lat=37.7749&lng=-122.4194"
);
console.log(data); // { station: {...}, distanceMiles, queriedAt }`;

function EndpointCard({ spec }: { spec: EndpointSpec }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="rounded-xl border border-zinc-200 bg-[#FAFAF8] p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-mono text-[12px] font-medium text-emerald-700">
          GET
        </span>
        <span className="font-mono text-[16px] text-zinc-900 break-all">
          {spec.path}
        </span>
        <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[12px] text-emerald-700">
          $0.001/call
        </span>
      </div>
      <p className="mt-3 text-[14px] leading-relaxed text-zinc-600">
        {spec.description}
      </p>
      <div className="mt-5">
        <p className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Parameters
        </p>
        <div className="mt-2 overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-[12px]">
            <tbody>
              {PARAMS.map((p) => (
                <tr key={p.name} className="border-b border-zinc-100 last:border-b-0">
                  <td className="px-3 py-2 align-top">
                    <span className="font-mono text-zinc-900">{p.name}</span>
                    <span className="ml-2 font-mono text-[11px] text-zinc-500">
                      {p.type}
                    </span>
                    {p.required && (
                      <span className="ml-2 font-mono text-[11px] uppercase tracking-wider text-red-600">
                        required
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-zinc-600">{p.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-4 font-inter text-[12px] font-medium text-emerald-700 hover:text-emerald-900"
      >
        {open ? "Hide example response" : "Show example response"}
      </button>
      {open && (
        <pre className="mt-2 overflow-x-auto rounded-lg border border-zinc-200 bg-white p-4 font-mono text-[12px] leading-relaxed text-zinc-900">
          <code>{spec.exampleResponse}</code>
        </pre>
      )}
    </article>
  );
}

const TABS = [
  { id: "curl", label: "curl", body: CURL_EXAMPLE },
  { id: "aisa", label: "AIsa x402 client", body: AISA_EXAMPLE },
  { id: "ts", label: "TypeScript (Circle SDK)", body: TS_EXAMPLE },
] as const;

function TryItTabs() {
  const [active, setActive] = useState<(typeof TABS)[number]["id"]>("curl");
  const body = TABS.find((t) => t.id === active)?.body ?? "";
  return (
    <div className="rounded-xl border border-zinc-200 bg-white">
      <div className="flex flex-wrap border-b border-zinc-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t.id)}
            className={`px-4 py-2.5 font-inter text-[13px] font-medium transition-colors ${
              active === t.id
                ? "border-b-2 border-emerald-600 text-zinc-900"
                : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed text-zinc-900">
        <code>{body}</code>
      </pre>
      {active === "aisa" && (
        <p className="border-t border-zinc-100 px-4 py-3 text-[12px] leading-relaxed text-zinc-600">
          AIsa&apos;s open-source x402 client handles wallet creation, Circle
          Gateway deposits, and payment signing automatically. Works with any
          x402-protected endpoint, including ours.
        </p>
      )}
    </div>
  );
}

export default function DevelopersPage() {
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
          <Link href="/stats" className="hover:text-zinc-900">
            Stats
          </Link>
          <Link href="/developers" className="font-medium text-zinc-900">
            Developers
          </Link>
          <Link href="/pitch" className="hover:text-zinc-900">
            Pitch
          </Link>
          <LiveTxCounter />
          <ConnectButton />
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[920px] flex-1 px-6 py-16">
        {/* Hero */}
        <section>
          <p className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            For developers and AI agents
          </p>
          <h1 className="mt-3 text-[32px] font-medium tracking-tight text-zinc-900 sm:text-[40px]">
            x402-priced APIs for physical-world prices
          </h1>
          <p className="mt-4 max-w-[680px] text-[16px] leading-relaxed text-zinc-600 sm:text-[18px]">
            Pay-per-call USDC oracles. Settled in batches on Arc via Circle
            Nanopayments. No API keys, no subscriptions, no rate limits — just sign
            and call.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 font-inter text-[10px] font-medium uppercase tracking-wider text-zinc-700">
              Built on Circle Nanopayments
            </span>
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 font-inter text-[10px] font-medium uppercase tracking-wider text-zinc-700">
              Arc Testnet
            </span>
          </div>
        </section>

        {/* Endpoints */}
        <section className="mt-16">
          <h2 className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Endpoints
          </h2>
          <div className="mt-4 space-y-4">
            {ENDPOINTS.map((e) => (
              <EndpointCard key={e.path} spec={e} />
            ))}
          </div>
        </section>

        {/* Try it */}
        <section className="mt-16">
          <h2 className="text-[24px] font-medium tracking-tight text-zinc-900">
            Try it
          </h2>
          <p className="mt-2 text-[14px] text-zinc-600">
            Three integration paths. Same endpoint either way.
          </p>
          <div className="mt-4">
            <TryItTabs />
          </div>
        </section>

        {/* How it works */}
        <section className="mt-16">
          <h2 className="text-[24px] font-medium tracking-tight text-zinc-900">
            How it works
          </h2>
          <ol className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-4">
            {[
              {
                num: "01",
                title: "Call",
                body: "Agent sends a normal HTTP GET to the endpoint.",
              },
              {
                num: "02",
                title: "402 returned",
                body:
                  "Server replies with HTTP 402 + payment requirements (network: Arc Testnet, asset: USDC, amount: 1000 atomic = $0.001, scheme: GatewayWalletBatched).",
              },
              {
                num: "03",
                title: "Sign off-chain",
                body: "Agent signs an EIP-3009 authorization. Zero gas.",
              },
              {
                num: "04",
                title: "Retry → settled",
                body:
                  "Agent retries with the PAYMENT-SIGNATURE header. Server settles via Circle Gateway and returns the data.",
              },
            ].map((s) => (
              <li key={s.num}>
                <p className="font-mono text-[14px] tracking-wider text-zinc-400">
                  {s.num}
                </p>
                <p className="mt-2 text-[16px] font-medium text-zinc-900">
                  {s.title}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-[12px] leading-relaxed text-zinc-500">
            Settlement happens in batches via Circle Gateway. Average latency:
            &lt; 1 second. No per-call gas overhead. Exact replication of the x402
            protocol with the Circle Nanopayments backend.
          </p>
        </section>

        {/* Economics */}
        <section className="mt-16">
          <h2 className="text-[24px] font-medium tracking-tight text-zinc-900">
            Economics
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-2">
            <div>
              <p className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Why $0.001 per query?
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-zinc-600">
                On Ethereum mainnet, a $0.001 query is economically impossible —
                gas alone is 1000× the payment. On most L2s, gas eats 10–30% of
                margin. On Arc with batched settlement, the per-call cost is
                effectively zero. This is the only price point where high-frequency
                agent queries are positive-margin.
              </p>
            </div>
            <div>
              <p className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                What you get for the price
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-zinc-600">
                Transaction-verified, consensus-weighted price data. Consensus is
                computed across recent reports with time-decay weighting and
                outlier detection. High-value reports require a USDC stake to
                prevent oracle pollution.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <section className="mt-20 border-t border-zinc-200 pt-8 text-[13px] text-zinc-500">
          <p>
            Same architecture, different commodities. Currently live: gas, parking.
            Coming: EV charging, grocery, prescription drugs, hotel rates.
          </p>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            <Link
              href="/stats"
              className="text-emerald-700 underline-offset-4 hover:underline"
            >
              View live activity at /stats →
            </Link>
            <a
              href="https://github.com/lsarta/gas-oracle"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-700 underline-offset-4 hover:underline"
            >
              Built for the Agentic Economy on Arc hackathon — view source on GitHub →
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}
