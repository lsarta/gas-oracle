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
    return <div className="h-9 w-28 animate-pulse rounded-md bg-muted" aria-label="loading" />;
  }

  if (!authenticated) {
    return (
      <Button onClick={login} size="sm">
        <Wallet className="mr-2 h-4 w-4" />
        Sign in
      </Button>
    );
  }

  const address = user?.wallet?.address;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="font-mono" />}>
        <Wallet className="mr-2 h-4 w-4" />
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
