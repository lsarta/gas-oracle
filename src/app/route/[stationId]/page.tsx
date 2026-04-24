import Link from "next/link";
import { ConnectButton } from "@/components/ConnectButton";
import { Wordmark } from "@/components/Wordmark";
import { RouteView } from "./RouteView";

export default async function RoutePage({
  params,
}: {
  params: Promise<{ stationId: string }>;
}) {
  const { stationId } = await params;
  // Mirror /map's layout exactly: server-rendered header + flex-1 main wrap
  // the client map component. RouteView renders a fragment whose top-level
  // element is the map container with h-full w-full, inheriting main's size.
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
          <Link href="/map" className="hover:text-zinc-900">
            Map
          </Link>
          <ConnectButton />
        </nav>
      </header>
      <main className="relative min-h-0 flex-1">
        <RouteView stationId={stationId} />
      </main>
    </div>
  );
}
