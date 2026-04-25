import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gyasss — One-pager",
  description:
    "The pricing oracle for the agentic economy. Bidirectional Circle Nanopayments on Arc.",
  robots: { index: false, follow: false },
};

export default function PitchPage() {
  return (
    <div className="min-h-screen bg-zinc-50 py-8 px-4">
      <article
        className="mx-auto bg-white shadow-sm border border-zinc-200 rounded-lg overflow-hidden relative"
        style={{
          width: "794px",
          maxWidth: "100%",
          height: "1123px",
          padding: "56px 64px 48px",
        }}
      >
        <div className="absolute top-9 left-16 font-mono text-[9.5px] font-medium uppercase tracking-[0.12em] text-zinc-500">
          One-pager · April 2026
        </div>
        <div className="absolute top-9 right-16 font-mono text-[9.5px] font-medium uppercase tracking-[0.12em] text-zinc-500">
          Built on Circle Nanopayments + Arc
        </div>

        <header className="text-center mb-7 pt-2">
          <h1 className="text-[80px] font-medium text-emerald-600 tracking-[-0.045em] leading-[0.95] mb-[18px]">
            gyasss
          </h1>
          <p className="text-[19px] font-normal text-zinc-900 tracking-tight leading-snug mb-2.5">
            The pricing oracle for the agentic economy.
          </p>
          <p className="text-[12.5px] font-normal text-zinc-600 max-w-[560px] mx-auto leading-relaxed">
            Transaction-verified gas prices. AI agents pay $0.001 per query. Users earn
            USDC for confirming prices. Same Circle Nanopayments primitive used in
            opposite roles, settled in batches on Arc.
          </p>
        </header>

        <section className="grid grid-cols-3 gap-7 mb-7">
          <div className="border-t border-zinc-900 pt-3">
            <div className="font-mono text-[9.5px] font-medium uppercase tracking-[0.12em] text-zinc-500 mb-2.5">
              01 — Problem
            </div>
            <p className="text-[11.5px] leading-relaxed text-zinc-900">
              Americans spend{" "}
              <span className="text-emerald-600 font-medium">$560B/yr</span> on gasoline.
              SF drivers leave $200–$400 annually on the table by not routing to the
              cheapest nearby station. GasBuddy is self-reported guesses with no
              economic incentive for accuracy.
            </p>
          </div>
          <div className="border-t border-zinc-900 pt-3">
            <div className="font-mono text-[9.5px] font-medium uppercase tracking-[0.12em] text-zinc-500 mb-2.5">
              02 — Architecture
            </div>
            <p className="text-[11.5px] leading-relaxed text-zinc-900">
              Bidirectional x402. Inbound: AI agents pay $0.001 per oracle query.
              Outbound: users earn $0.005–$0.50 per report. Consensus-weighted with
              time decay; high-value reports require a $0.10 USDC stake; outliers
              slashed.
            </p>
          </div>
          <div className="border-t border-zinc-900 pt-3">
            <div className="font-mono text-[9.5px] font-medium uppercase tracking-[0.12em] text-zinc-500 mb-2.5">
              03 — Why Arc
            </div>
            <p className="text-[11.5px] leading-relaxed text-zinc-900">
              On Ethereum mainnet, gas is{" "}
              <span className="text-emerald-600 font-medium">1000×</span> our query
              price. On L2s, gas eats 10–30% of margin. Only Arc&apos;s batched
              settlement makes both economic loops positive-margin. This category did
              not exist 60 days ago.
            </p>
          </div>
        </section>

        <section
          className="bg-[#FAFAF8] rounded-xl mb-6"
          style={{ padding: "22px 32px" }}
        >
          <div className="text-center mb-[18px]">
            <div className="font-mono text-[9.5px] font-medium uppercase tracking-[0.12em] text-zinc-500 mb-1">
              Bidirectional Nanopayments
            </div>
            <div className="text-[13px] text-zinc-600 leading-snug">
              Same Circle x402 primitive. Opposite roles. One protocol, two flows.
            </div>
          </div>

          <div
            className="grid items-center"
            style={{ gridTemplateColumns: "1fr 1.1fr 1fr", gap: "22px" }}
          >
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-[60px] h-[60px] rounded-full bg-white border-[1.5px] border-zinc-200 mb-2">
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#0A0A0A"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 9h6v6H9z" />
                  <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" />
                </svg>
              </div>
              <div className="text-[14px] font-medium text-zinc-900 mb-0.5">AI Agent</div>
              <div className="text-[10.5px] text-zinc-500 leading-snug">
                routing, fleet,
                <br />
                delivery, EV
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div
                className="bg-white border-[1.5px] border-emerald-600 rounded-lg"
                style={{ padding: "8px 14px" }}
              >
                <div className="flex items-center gap-3">
                  <svg
                    width="38"
                    height="14"
                    viewBox="0 0 38 14"
                    fill="none"
                    className="flex-shrink-0"
                  >
                    <path
                      d="M0 7h32"
                      stroke="#059669"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M27 1l8 6-8 6"
                      stroke="#059669"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div>
                    <div className="font-mono text-[9.5px] font-medium uppercase tracking-[0.1em] text-emerald-600">
                      Pay-per-query
                    </div>
                    <div className="text-[12px] text-zinc-900 leading-snug mt-px">
                      <span className="font-mono font-medium">$0.001</span> USDC per
                      oracle call
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="bg-white border-[1.5px] border-emerald-600 rounded-lg"
                style={{ padding: "8px 14px" }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="font-mono text-[9.5px] font-medium uppercase tracking-[0.1em] text-emerald-600 text-right">
                      Earn-per-report
                    </div>
                    <div className="text-[12px] text-zinc-900 leading-snug mt-px text-right">
                      <span className="font-mono font-medium">$0.005–$0.50</span> per
                      verified report
                    </div>
                  </div>
                  <svg
                    width="38"
                    height="14"
                    viewBox="0 0 38 14"
                    fill="none"
                    className="flex-shrink-0"
                  >
                    <path
                      d="M38 7H6"
                      stroke="#059669"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M11 1L3 7l8 6"
                      stroke="#059669"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-[60px] h-[60px] rounded-full bg-white border-[1.5px] border-zinc-200 mb-2">
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#0A0A0A"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="7" r="4" />
                  <path d="M3 21v-2a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v2" />
                </svg>
              </div>
              <div className="text-[14px] font-medium text-zinc-900 mb-0.5">User</div>
              <div className="text-[10.5px] text-zinc-500 leading-snug">
                drivers reporting
                <br />
                real prices at the pump
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-7 mb-6">
          <div>
            <div className="font-mono text-[9.5px] font-medium uppercase tracking-[0.12em] text-zinc-500 mb-2.5">
              Live today
            </div>
            <ul className="text-[11.5px] leading-[1.65] text-zinc-900">
              <li className="flex gap-2.5">
                <span className="text-emerald-600 font-medium">·</span>
                <span>Real USDC cashback on Arc Testnet</span>
              </li>
              <li className="flex gap-2.5">
                <span className="text-emerald-600 font-medium">·</span>
                <span>Route-aware via Mapbox Directions</span>
              </li>
              <li className="flex gap-2.5">
                <span className="text-emerald-600 font-medium">·</span>
                <span>Consensus oracle, stake-and-slash</span>
              </li>
              <li className="flex gap-2.5">
                <span className="text-emerald-600 font-medium">·</span>
                <span>Two queryable x402 endpoints</span>
              </li>
              <li className="flex gap-2.5">
                <span className="text-emerald-600 font-medium">·</span>
                <span>Live transaction counter on /stats</span>
              </li>
              <li className="flex gap-2.5">
                <span className="text-emerald-600 font-medium">·</span>
                <span>Public developer surface at /developers</span>
              </li>
            </ul>
          </div>
          <div>
            <div className="font-mono text-[9.5px] font-medium uppercase tracking-[0.12em] text-zinc-500 mb-2.5">
              Roadmap
            </div>
            <ul className="text-[11.5px] leading-[1.65] text-zinc-900">
              <li className="flex gap-2.5">
                <span className="text-zinc-500">·</span>
                <span>Stripe Issuing virtual card (tap-at-pump)</span>
              </li>
              <li className="flex gap-2.5">
                <span className="text-zinc-500">·</span>
                <span>Push notifications for opportunities</span>
              </li>
              <li className="flex gap-2.5">
                <span className="text-zinc-500">·</span>
                <span>Reputation-weighted payout multipliers</span>
              </li>
              <li className="flex gap-2.5">
                <span className="text-zinc-500">·</span>
                <span>EV charging, drug prices, hotel rates</span>
              </li>
              <li className="flex gap-2.5">
                <span className="text-zinc-500">·</span>
                <span>Oracle layer for any commodity with weak data</span>
              </li>
            </ul>
          </div>
        </section>

        <section
          className="bg-zinc-950 rounded-xl mb-4"
          style={{ padding: "18px 28px" }}
        >
          <div className="font-mono text-[9.5px] font-medium uppercase tracking-[0.12em] text-zinc-400 mb-2.5">
            Live links
          </div>
          <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
            <a href="https://gyasss.com" className="text-emerald-400 hover:underline">
              gyasss.com
            </a>
            <a
              href="https://github.com/lsarta/gas-oracle"
              className="text-emerald-400 hover:underline"
            >
              github.com/lsarta/gas-oracle
            </a>
            <a
              href="https://gyasss.com/stats"
              className="text-emerald-400 hover:underline"
            >
              gyasss.com/stats
            </a>
            <a
              href="https://testnet.arcscan.app/address/0xd4D8F2f8BdB323bc741AC2Eb6F6469506c38E808"
              className="text-zinc-500 text-[10px] hover:text-zinc-300"
            >
              verify on Arc: testnet.arcscan.app
            </a>
            <a
              href="https://gyasss.com/developers"
              className="text-emerald-400 hover:underline"
            >
              gyasss.com/developers
            </a>
            <span className="text-zinc-500 text-[10px]">
              master wallet: 0xd4D8F2…38E808
            </span>
          </div>
        </section>

        <footer className="text-center">
          <p className="text-[10.5px] text-zinc-400 leading-snug">
            Built solo by Laurie Sartain · Agentic Economy on Arc Hackathon 2026 ·
            Powered by Circle Nanopayments · Arc Testnet · Privy
          </p>
        </footer>
      </article>
    </div>
  );
}
