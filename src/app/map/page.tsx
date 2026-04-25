"use client";

import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { ConnectButton } from "@/components/ConnectButton";
import { LiveTxCounter } from "@/components/LiveTxCounter";
import { StationMap } from "@/components/StationMap";
import { Wordmark } from "@/components/Wordmark";

export default function MapPage() {
  const { ready, authenticated } = usePrivy();
  const canReport = ready && authenticated;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-6">
        <Link href="/">
          <Wordmark size="sm" withMark />
        </Link>
        <nav className="flex items-center gap-6 text-[14px] text-zinc-700">
          <Link href="/" className="hover:text-zinc-900">
            Home
          </Link>
          <Link href="/map" className="font-medium text-zinc-900">
            Map
          </Link>
          <Link href="/verticals" className="hover:text-zinc-900">
            Verticals
          </Link>
          <Link href="/stats" className="hover:text-zinc-900">
            Live
          </Link>
          <LiveTxCounter />
          <ConnectButton />
        </nav>
      </header>

      <main className="relative min-h-0 flex-1">
        <StationMap canReport={canReport} />
      </main>
    </div>
  );
}
