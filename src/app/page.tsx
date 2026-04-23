"use client";

import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { ConnectButton } from "@/components/ConnectButton";
import { UserSync } from "@/components/UserSync";
import { OpportunityCard } from "@/components/OpportunityCard";
import { ActivitySection } from "@/components/ActivitySection";
import { OnboardingModal } from "@/components/OnboardingModal";
import { Button } from "@/components/ui/button";

function Header({ active }: { active?: "home" | "map" | "verticals" }) {
  const link = (label: string, href: string, key: typeof active) =>
    active === key ? (
      <Link href={href} className="font-medium text-foreground">
        {label}
      </Link>
    ) : (
      <Link href={href} className="hover:text-foreground">
        {label}
      </Link>
    );
  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Gyas
        </Link>
        <nav className="hidden gap-4 text-sm text-muted-foreground sm:flex">
          {link("Home", "/", "home")}
          {link("Map", "/map", "map")}
          {link("Verticals", "/verticals", "verticals")}
        </nav>
      </div>
      <ConnectButton />
    </header>
  );
}

function SignedOutLanding({ onLogin }: { onLogin: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        Verified gas prices, on demand
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
        Get paid in <span className="text-emerald-600">USDC</span> for confirming what you
        already paid at the pump.
      </h1>
      <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
        AI agents pay per query for verified prices. Drivers earn USDC for keeping the
        oracle fresh. Settled instantly on Arc.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button
          size="lg"
          className="h-11 bg-emerald-600 text-white hover:bg-emerald-700"
          onClick={onLogin}
        >
          Sign in to start earning
        </Button>
        <Button
          size="lg"
          variant="ghost"
          className="h-11"
          render={<Link href="/verticals" />}
        >
          See where this goes →
        </Button>
      </div>
    </main>
  );
}

export default function Home() {
  const { ready, authenticated, user, login } = usePrivy();
  const wallet = user?.wallet?.address;

  return (
    <div className="flex min-h-screen flex-col">
      <Header active="home" />

      {!ready ? (
        <main className="flex-1" />
      ) : !authenticated ? (
        <SignedOutLanding onLogin={login} />
      ) : (
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
          <OpportunityCard wallet={wallet} />
          {wallet && <ActivitySection wallet={wallet} />}
        </main>
      )}

      {ready && authenticated && (
        <>
          <UserSync />
          <OnboardingModal />
        </>
      )}
    </div>
  );
}
