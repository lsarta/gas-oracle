"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { arcTestnet } from "@/lib/chains";

export function PrivyProviders({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) {
    throw new Error("NEXT_PUBLIC_PRIVY_APP_ID is not set");
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "google"],
        embeddedWallets: {
          ethereum: { createOnLogin: "all-users" },
        },
        defaultChain: arcTestnet,
        supportedChains: [arcTestnet],
        appearance: {
          theme: "light",
          accentColor: "#10b981",
          logo: undefined,
          showWalletLoginFirst: false,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
