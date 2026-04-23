"use client";

import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { ConnectButton } from "@/components/ConnectButton";
import { StationMap } from "@/components/StationMap";

export default function MapPage() {
  const { ready, authenticated } = usePrivy();
  const canReport = ready && authenticated;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Gyas
          </Link>
          <nav className="hidden gap-4 text-sm text-muted-foreground sm:flex">
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <Link href="/map" className="font-medium text-foreground">
              Map
            </Link>
            <Link href="/verticals" className="hover:text-foreground">
              Verticals
            </Link>
          </nav>
        </div>
        <ConnectButton />
      </header>

      <main className="relative flex-1 min-h-0">
        <StationMap canReport={canReport} />
      </main>
    </div>
  );
}
