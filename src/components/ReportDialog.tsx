"use client";

import { useEffect, useMemo, useState } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
  cubicBezier,
} from "framer-motion";
import { usePrivy } from "@privy-io/react-auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, ExternalLink, Loader2 } from "lucide-react";

type Stage = "form" | "verifying" | "settling" | "delivered" | "error";

type StationLite = {
  id: string;
  name: string;
};

const ARC_EXPLORER_TX = "https://testnet.arcscan.app/tx";
const AUTO_CLOSE_MS = 4000;
const easeOutQuart = cubicBezier(0.22, 1, 0.36, 1);

function CashbackCounter({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => `$${v.toFixed(3)}`);
  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.0, ease: easeOutQuart });
    return () => controls.stop();
  }, [mv, value]);
  return (
    <div className="flex items-baseline gap-2">
      <motion.span className="font-mono text-[56px] font-medium leading-none tracking-tight text-emerald-600">
        {display}
      </motion.span>
      <span className="font-mono text-[16px] font-medium text-emerald-700">USDC</span>
    </div>
  );
}

function AutoCloseBar({ durationMs }: { durationMs: number }) {
  return (
    <motion.div
      className="absolute bottom-0 left-0 h-0.5 bg-emerald-600"
      initial={{ width: "0%" }}
      animate={{ width: "100%" }}
      transition={{ duration: durationMs / 1000, ease: "linear" }}
    />
  );
}

function LoadingState({ stage }: { stage: "verifying" | "settling" }) {
  const text = stage === "verifying" ? "Verifying your price…" : "Settling on Arc…";
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-600" strokeWidth={1.75} />
      <AnimatePresence mode="wait">
        <motion.p
          key={text}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="text-[15px] text-zinc-900"
        >
          {text}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

export function ReportDialog({
  stationId,
  onClose,
}: {
  stationId: string | null;
  onClose: () => void;
}) {
  const { authenticated, user } = usePrivy();
  const wallet = user?.wallet?.address;

  const [station, setStation] = useState<StationLite | null>(null);
  const [amount, setAmount] = useState("42.18");
  const [gallons, setGallons] = useState("12.4");
  const [stage, setStage] = useState<Stage>("form");
  const [result, setResult] = useState<{
    payoutAmountUsdc: number;
    payoutTxHash: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isOpen = stationId !== null;

  useEffect(() => {
    if (!isOpen) return;
    setStage("form");
    setResult(null);
    setErrorMsg(null);
  }, [isOpen, stationId]);

  useEffect(() => {
    if (!stationId) return;
    let aborted = false;
    fetch("/api/stations")
      .then((r) => r.json())
      .then((j) => {
        if (aborted) return;
        const s = (j.stations as Array<{ id: string; name: string }>).find(
          (x) => x.id === stationId,
        );
        setStation(s ? { id: s.id, name: s.name } : null);
      })
      .catch(() => {});
    return () => {
      aborted = true;
    };
  }, [stationId]);

  const amountNum = Number(amount);
  const gallonsNum = Number(gallons);
  const impliedPrice = useMemo(() => {
    if (!(amountNum > 0) || !(gallonsNum > 0)) return null;
    const p = amountNum / gallonsNum;
    if (p < 1 || p > 20 || gallonsNum > 50) return null;
    return p;
  }, [amountNum, gallonsNum]);

  const canSubmit =
    authenticated && !!wallet && impliedPrice !== null && stage === "form";

  useEffect(() => {
    if (stage !== "delivered") return;
    const id = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(id);
  }, [stage, onClose]);

  async function handleSubmit() {
    if (!stationId || !wallet || impliedPrice === null) return;
    setErrorMsg(null);
    setStage("verifying");

    setTimeout(() => {
      setStage((s) => (s === "verifying" ? "settling" : s));
    }, 1000);

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stationId,
          userWallet: wallet,
          transactionAmountUsd: amountNum,
          gallons: gallonsNum,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.payoutTxHash) {
        setErrorMsg(json.error || json.warning || `HTTP ${res.status}`);
        setStage("error");
        return;
      }
      setResult({
        payoutAmountUsdc: Number(json.payoutAmountUsdc),
        payoutTxHash: json.payoutTxHash,
      });
      setStage("delivered");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStage("error");
    }
  }

  const isSuccess = stage === "delivered" && result;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={`relative max-h-[calc(100vh-2rem)] overflow-hidden border-zinc-200 p-0 sm:max-w-[420px] ${
          isSuccess ? "bg-gradient-to-b from-emerald-50/40 to-white" : "bg-white"
        }`}
        showCloseButton={false}
      >
        <div className="max-h-[calc(100vh-2rem)] overflow-y-auto p-4">
        {stage === "form" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-[18px] font-medium text-zinc-900">
                {station?.name ?? "Report a fill-up"}
              </DialogTitle>
              <DialogDescription className="text-[13px] text-zinc-500">
                We&apos;ll verify your price and pay cashback in USDC.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 px-1 pt-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="amount"
                  className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500"
                >
                  Amount spent
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[18px] text-zinc-400">
                    $
                  </span>
                  <input
                    id="amount"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-12 w-full rounded-lg border border-zinc-200 bg-white pl-8 pr-4 font-mono text-[18px] text-zinc-900 outline-none transition-colors focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="gallons"
                  className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500"
                >
                  Gallons
                </label>
                <input
                  id="gallons"
                  inputMode="decimal"
                  value={gallons}
                  onChange={(e) => setGallons(e.target.value)}
                  className="h-12 w-full rounded-lg border border-zinc-200 bg-white px-4 font-mono text-[18px] text-zinc-900 outline-none transition-colors focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <span className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Implied price
                </span>
                <span className="font-mono text-[20px] text-zinc-900">
                  {impliedPrice !== null ? `$${impliedPrice.toFixed(2)}/gal` : "—"}
                </span>
              </div>

              <button
                disabled={!canSubmit}
                onClick={handleSubmit}
                className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-emerald-600 text-[15px] font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                {!authenticated ? "Sign in to submit" : "Submit report"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="block w-full text-center text-[13px] text-zinc-500 hover:text-zinc-900"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {(stage === "verifying" || stage === "settling") && (
          <LoadingState stage={stage} />
        )}

        {isSuccess && (
          <>
            <div className="flex flex-col items-center px-4 pb-4 pt-2 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Check className="h-5 w-5" strokeWidth={2.5} />
              </div>
              <h2 className="mt-4 text-[20px] font-medium text-zinc-900">
                Cashback delivered
              </h2>
              <div className="mt-5">
                <CashbackCounter value={result.payoutAmountUsdc} />
              </div>
              <p className="mt-6 font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Transaction
              </p>
              <a
                href={`${ARC_EXPLORER_TX}/${result.payoutTxHash}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-[13px] text-zinc-700 hover:text-zinc-900"
              >
                {result.payoutTxHash.slice(0, 10)}…{result.payoutTxHash.slice(-8)}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </>
        )}

        {stage === "error" && (
          <div className="space-y-3 py-4">
            <p className="text-[14px] text-red-600">
              {errorMsg ?? "Something went wrong."}
            </p>
            <button
              onClick={() => setStage("form")}
              className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-zinc-200 bg-white text-[14px] font-medium text-zinc-700 hover:border-zinc-300 hover:text-zinc-900"
            >
              Try again
            </button>
          </div>
        )}
        </div>
        {isSuccess && <AutoCloseBar durationMs={AUTO_CLOSE_MS} />}
      </DialogContent>
    </Dialog>
  );
}
