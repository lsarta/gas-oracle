"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { arcTestnet } from "@/lib/chains";

export function PrivyProviders({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) {
    // Don't throw at render — that breaks `next build` SSG/prerender when
    // the env var isn't supplied at build time. At runtime, downstream
    // `usePrivy()` callers will still surface a clear "no provider" error;
    // this warning helps the developer notice the config gap.
    if (typeof window !== "undefined") {
      console.warn(
        "[PrivyProviders] NEXT_PUBLIC_PRIVY_APP_ID is not set; auth is disabled.",
      );
    }
    return <>{children}</>;
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
