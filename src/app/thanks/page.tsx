import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Thank you — Gyasss",
  robots: { index: false, follow: false },
};

export default function ThanksPage() {
  return (
    <div className="fixed inset-0 bg-[#0A0A0A] flex flex-col items-center justify-center px-8">
      <div className="text-center max-w-2xl">
        <div className="font-mono text-[18px] md:text-[22px] uppercase tracking-[0.24em] text-zinc-400 mb-12">
          Thank you
        </div>

        <h1 className="text-[120px] md:text-[160px] font-medium text-emerald-400 tracking-[-0.045em] leading-[0.9] mb-8">
          gyasss
        </h1>

        <p className="text-2xl md:text-3xl font-normal text-white tracking-tight leading-snug mb-3">
          Try it yourself.
        </p>

        <p className="text-lg md:text-xl text-zinc-400 mb-16">
          gyasss.com — connect your wallet, find cheap gas, earn USDC.
        </p>

        <div className="inline-block bg-white p-6 rounded-2xl">
          <Image
            src="/qr-gyasss.png"
            alt="Scan to visit gyasss.com"
            width={200}
            height={200}
            priority
          />
        </div>

        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-600 mt-8">
          gyasss.com
        </p>
      </div>
    </div>
  );
}
