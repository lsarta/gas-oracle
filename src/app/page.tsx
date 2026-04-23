"use client";

import { usePrivy } from "@privy-io/react-auth";
import { ConnectButton } from "@/components/ConnectButton";
import { UserSync } from "@/components/UserSync";
import { StationMap } from "@/components/StationMap";
import { EarningsPanel } from "@/components/EarningsPanel";

export default function Home() {
  const { ready, authenticated } = usePrivy();
  const canReport = ready && authenticated;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <span className="text-xl font-semibold tracking-tight">Gyas</span>
        <ConnectButton />
      </header>

      <main className="relative flex-1 min-h-0">
        <StationMap canReport={canReport} />
      </main>

      <EarningsPanel />
      {canReport && <UserSync />}
    </div>
  );
}
