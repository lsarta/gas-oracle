"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-center"
      toastOptions={{
        classNames: {
          toast:
            "rounded-lg border border-zinc-200 bg-white text-zinc-900 shadow-sm",
          description: "text-zinc-500",
          success:
            "rounded-lg border border-emerald-200 bg-white text-zinc-900",
        },
      }}
    />
  );
}
