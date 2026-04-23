"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Coins, LogOut, Wallet } from "lucide-react";

function truncate(addr?: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ConnectButton() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const [copied, setCopied] = useState(false);

  if (!ready) {
    return (
      <div
        className="h-5 w-24 animate-pulse rounded-md bg-zinc-100"
        aria-label="loading"
      />
    );
  }

  if (!authenticated) {
    return (
      <button
        onClick={login}
        className="text-[14px] font-medium text-zinc-700 transition-colors hover:text-zinc-900"
      >
        Sign in
      </button>
    );
  }

  const address = user?.wallet?.address;

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="relative inline-flex items-center">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button className="group inline-flex items-center gap-1 font-mono text-[13px] text-zinc-700 transition-colors hover:text-zinc-900" />
          }
        >
          {truncate(address) || "Connected"}
          <ChevronDown className="h-3.5 w-3.5 text-zinc-500 transition-colors group-hover:text-zinc-600" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-[200px] rounded-lg border border-zinc-200 bg-white p-1 text-zinc-900 shadow-sm ring-0"
        >
          <DropdownMenuItem
            onClick={copyAddress}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-[14px] text-zinc-900 hover:bg-zinc-50 focus:bg-zinc-50"
          >
            <Wallet className="h-3.5 w-3.5 text-zinc-500" />
            {copied ? "Copied!" : "Wallet address"}
          </DropdownMenuItem>
          <DropdownMenuItem className="flex items-center gap-2 rounded-md px-3 py-2 text-[14px] text-zinc-900 hover:bg-zinc-50 focus:bg-zinc-50">
            <Coins className="h-3.5 w-3.5 text-zinc-500" />
            Earnings
          </DropdownMenuItem>
          <div className="my-1 h-px bg-zinc-100" />
          <DropdownMenuItem
            onClick={logout}
            className="group flex items-center gap-2 rounded-md px-3 py-2 text-[14px] text-zinc-700 hover:bg-zinc-50 hover:text-red-600 focus:bg-zinc-50 focus:text-red-600"
          >
            <LogOut className="h-3.5 w-3.5 text-zinc-500 group-hover:text-red-600" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
