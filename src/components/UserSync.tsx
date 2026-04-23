"use client";

import { useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";

export function UserSync() {
  const { ready, authenticated, user } = usePrivy();
  const syncedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !authenticated || !user) return;

    const wallet = user.wallet?.address;
    if (!wallet) return;

    const key = `${user.id}:${wallet}`;
    if (syncedKey.current === key) return;

    const email =
      typeof user.email === "string"
        ? user.email
        : (user.email as { address?: string } | null)?.address ?? null;

    syncedKey.current = key;

    fetch("/api/users/upsert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        privyUserId: user.id,
        email,
        walletAddress: wallet,
      }),
    }).catch((err) => {
      console.error("[UserSync] upsert failed:", err);
      syncedKey.current = null;
    });
  }, [ready, authenticated, user]);

  return null;
}
