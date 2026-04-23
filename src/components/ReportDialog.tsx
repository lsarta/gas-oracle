"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { usePrivy } from "@privy-io/react-auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Stage = "form" | "verifying" | "settling" | "delivered" | "error";

type StationLite = {
  id: string;
  name: string;
};

const ARC_EXPLORER_TX = "https://testnet.arcscan.app/tx";

function CashbackCounter({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => `$${v.toFixed(3)} USDC`);
  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.2, ease: "easeOut" });
    return () => controls.stop();
  }, [mv, value]);
  return (
    <motion.span className="text-3xl font-semibold tabular-nums text-emerald-600">
      {display}
    </motion.span>
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
    const id = setTimeout(onClose, 4000);
    return () => clearTimeout(id);
  }, [stage, onClose]);

  async function handleSubmit() {
    if (!stationId || !wallet || impliedPrice === null) return;
    setErrorMsg(null);
    setStage("verifying");

    setTimeout(() => {
      setStage((s) => (s === "verifying" ? "settling" : s));
    }, 600);

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

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{station?.name ?? "Report a fill-up"}</DialogTitle>
          <DialogDescription>
            We&apos;ll cross-check your price and pay cashback in USDC.
          </DialogDescription>
        </DialogHeader>

        {stage === "form" && (
          <div className="space-y-4 px-1">
            <div className="space-y-1.5">
              <Label htmlFor="amount">How much did you spend?</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-6"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gallons">How many gallons?</Label>
              <Input
                id="gallons"
                inputMode="decimal"
                value={gallons}
                onChange={(e) => setGallons(e.target.value)}
              />
            </div>

            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Implied price: </span>
              <span className="font-semibold tabular-nums text-foreground">
                {impliedPrice !== null ? `$${impliedPrice.toFixed(2)}/gal` : "—"}
              </span>
            </div>

            <Button
              className="w-full"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {!authenticated ? "Sign in to submit" : "Submit"}
            </Button>
          </div>
        )}

        {(stage === "verifying" || stage === "settling") && (
          <div className="flex flex-col items-center gap-2 py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
            <p className="text-sm text-muted-foreground">
              {stage === "verifying" ? "Verifying..." : "Settling on Arc..."}
            </p>
          </div>
        )}

        {stage === "delivered" && result && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">Cashback delivered</p>
            <CashbackCounter value={result.payoutAmountUsdc} />
            <a
              href={`${ARC_EXPLORER_TX}/${result.payoutTxHash}`}
              target="_blank"
              rel="noreferrer"
              className="break-all font-mono text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              {result.payoutTxHash}
            </a>
          </div>
        )}

        {stage === "error" && (
          <div className="space-y-3 py-4">
            <p className="text-sm text-destructive">
              {errorMsg ?? "Something went wrong."}
            </p>
            <Button variant="outline" className="w-full" onClick={() => setStage("form")}>
              Try again
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
