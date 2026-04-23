"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  cubicBezier,
} from "framer-motion";
import { ConnectButton } from "@/components/ConnectButton";
import { Wordmark } from "@/components/Wordmark";
import { UserSync } from "@/components/UserSync";
import { OpportunityCard } from "@/components/OpportunityCard";
import { ActivitySection } from "@/components/ActivitySection";
import { OnboardingModal } from "@/components/OnboardingModal";

const easeOutQuart = cubicBezier(0.22, 1, 0.36, 1);

function Header({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/95 px-6 backdrop-blur-[1px]">
      <Link href="/" className="text-zinc-900">
        <Wordmark size="sm" withMark />
      </Link>
      {signedIn ? (
        <nav className="flex items-center gap-6 text-[14px] text-zinc-700">
          <Link href="/map" className="hover:text-zinc-900">
            Map
          </Link>
          <Link href="/verticals" className="hover:text-zinc-900">
            Verticals
          </Link>
          <ConnectButton />
        </nav>
      ) : (
        <ConnectButton />
      )}
    </header>
  );
}

function HeroExampleCard() {
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => `$${v.toFixed(3)}`);
  useEffect(() => {
    const controls = animate(mv, 0.3, { duration: 1.2, ease: easeOutQuart });
    return () => controls.stop();
  }, [mv]);

  return (
    <div className="w-full max-w-[280px] rounded-xl border border-zinc-200 bg-zinc-50 p-5">
      <p className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        Last report
      </p>
      <p className="mt-2 text-[18px] font-medium text-zinc-900">
        $4.97/gal at Arco Mission
      </p>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-[13px] text-zinc-500">Paid</span>
        <motion.span className="font-mono text-[32px] font-medium leading-none tracking-tight text-emerald-600">
          {display}
        </motion.span>
        <span className="font-mono text-[12px] font-medium text-emerald-700">USDC</span>
      </div>
      <p className="mt-4 font-inter text-[11px] text-zinc-400">
        Real transaction on Arc Testnet
      </p>
    </div>
  );
}

function SignedOutLanding({ onLogin }: { onLogin: () => void }) {
  return (
    <main className="flex flex-1 flex-col">
      {/* HERO */}
      <section className="relative mx-auto w-full max-w-[1200px] px-6 py-20 sm:py-28 md:py-32">
        <div className="grid items-center gap-12 md:grid-cols-3">
          <div className="md:col-span-2">
            <h1 className="text-[40px] font-medium leading-[1.05] tracking-tight text-zinc-900 sm:text-[56px] md:text-[80px]">
              Get paid to confirm gas prices.
            </h1>
            <p className="mt-6 max-w-[640px] text-[18px] leading-relaxed text-zinc-600 sm:text-[24px]">
              Gyasss is a transaction-verified pricing oracle. Report a price, earn USDC.
              Fresher data pays more.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-6">
              <button
                onClick={onLogin}
                className="inline-flex h-10 items-center rounded-lg bg-emerald-600 px-5 text-[16px] font-medium text-white transition-colors hover:bg-emerald-700"
              >
                Sign in with email
              </button>
              <a
                href="#how-it-works"
                className="text-[14px] font-medium text-zinc-700 underline-offset-4 hover:text-zinc-900 hover:underline"
              >
                See how it works →
              </a>
            </div>
          </div>
          <div className="hidden md:flex md:justify-end">
            <HeroExampleCard />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section
        id="how-it-works"
        className="border-t border-zinc-200 bg-[#FAFAF8] py-20 sm:py-28"
      >
        <div className="mx-auto w-full max-w-[1200px] px-6">
          <p className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            How it works
          </p>
          <h2 className="mt-2 max-w-[720px] text-[32px] font-medium tracking-tight text-zinc-900 sm:text-[40px]">
            Three steps. One tap each.
          </h2>
          <div className="mt-12 grid gap-12 md:grid-cols-3">
            {[
              {
                num: "01",
                title: "Pay for gas",
                body: "Tap to pay at the pump through our app. We capture the transaction details automatically.",
              },
              {
                num: "02",
                title: "Confirm the price",
                body: "One tap to verify gallons pumped. The oracle cross-checks against other reports within minutes.",
              },
              {
                num: "03",
                title: "Get paid",
                body: "USDC cashback lands in your wallet instantly. Reports on stale stations pay more — up to $0.50.",
              },
            ].map((s) => (
              <div key={s.num}>
                <p className="font-inter text-[14px] font-medium tracking-wider text-zinc-400">
                  {s.num}
                </p>
                <h3 className="mt-3 text-[24px] font-medium text-zinc-900">
                  {s.title}
                </h3>
                <p className="mt-3 text-[16px] leading-relaxed text-zinc-600">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY IT WORKS */}
      <section className="border-t border-zinc-200 py-24 sm:py-32">
        <div className="mx-auto w-full max-w-[720px] px-6 text-center">
          <p className="text-[24px] font-medium leading-[1.15] tracking-tight text-zinc-900 sm:text-[36px]">
            Americans spend $560 billion a year on gas. In San Francisco alone, drivers
            leave $200–$400 on the table annually by not routing to the cheapest nearby
            station.
          </p>
          <p className="mt-6 text-[18px] italic text-zinc-600">
            We built an oracle that pays you to keep it accurate.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3 font-inter text-[14px] text-zinc-500">
            <span>8 SF stations live</span>
            <span aria-hidden>•</span>
            <span>real USDC on Arc</span>
            <span aria-hidden>•</span>
            <span>built on Circle Nanopayments</span>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-zinc-200 py-12">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-start justify-between gap-4 px-6 text-[14px] text-zinc-500 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 text-zinc-700">
            <Wordmark size="sm" withMark />
            <span className="text-zinc-500">© 2026</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/lsarta/gas-oracle"
              target="_blank"
              rel="noreferrer"
              className="hover:text-zinc-900"
            >
              GitHub
            </a>
            <span>Built for the agentic economy on Arc</span>
          </div>
        </div>
      </footer>
    </main>
  );
}

function SignedInHome({ wallet }: { wallet?: string }) {
  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 px-4 pb-16 pt-20 sm:px-6">
      <OpportunityCard wallet={wallet} />
      {wallet && <ActivitySection wallet={wallet} />}
    </main>
  );
}

export default function Home() {
  const { ready, authenticated, user, login } = usePrivy();
  const wallet = user?.wallet?.address;
  const signedIn = !!(ready && authenticated);

  return (
    <div className="flex min-h-screen flex-col">
      <Header signedIn={signedIn} />

      {!ready ? (
        <main className="flex-1" />
      ) : signedIn ? (
        <SignedInHome wallet={wallet} />
      ) : (
        <SignedOutLanding onLogin={login} />
      )}

      {signedIn && (
        <>
          <UserSync />
          <OnboardingModal />
        </>
      )}
    </div>
  );
}
