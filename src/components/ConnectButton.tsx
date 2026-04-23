"use client";

import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Wallet } from "lucide-react";

function truncate(addr?: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ConnectButton() {
  const { ready, authenticated, user, login, logout } = usePrivy();

  if (!ready) {
    return <div className="h-8 w-28 animate-pulse rounded-md bg-muted" aria-label="loading" />;
  }

  if (!authenticated) {
    return (
      <Button
        onClick={login}
        size="sm"
        className="bg-emerald-600 font-medium text-white hover:bg-emerald-700"
      >
        Sign in
      </Button>
    );
  }

  const address = user?.wallet?.address;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="font-mono text-[12px] font-medium tracking-tight transition-colors"
          />
        }
      >
        <Wallet className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
        {truncate(address) || "Connected"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
