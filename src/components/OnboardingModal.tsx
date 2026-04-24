"use client";

import { useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MapPin } from "lucide-react";

const STORAGE_KEY = "gyas:onboarding-dismissed";
const DEBOUNCE_MS = 250;

type Suggestion = {
  placeName: string;
  lat: number;
  lng: number;
};

async function geocode(q: string): Promise<Suggestion[]> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || q.trim().length < 3) return [];
  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&proximity=-122.4194,37.7749&limit=5&access_token=${token}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const j = await r.json();
    type Feat = {
      properties?: { full_address?: string; name?: string };
      geometry?: { coordinates?: [number, number] };
    };
    return (j.features as Feat[])
      .filter((f) => f.geometry?.coordinates)
      .map((f) => ({
        placeName:
          f.properties?.full_address ?? f.properties?.name ?? "(unknown)",
        lng: f.geometry!.coordinates![0],
        lat: f.geometry!.coordinates![1],
      }));
  } catch {
    return [];
  }
}

function useGeocode(query: string) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const tref = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (tref.current) clearTimeout(tref.current);
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    tref.current = setTimeout(async () => {
      setSuggestions(await geocode(query));
    }, DEBOUNCE_MS);
    return () => {
      if (tref.current) clearTimeout(tref.current);
    };
  }, [query]);
  return suggestions;
}

function AddressField({
  label,
  optional,
  value,
  onChange,
  picked,
  onPick,
}: {
  label: string;
  optional?: boolean;
  value: string;
  onChange: (v: string) => void;
  picked: Suggestion | null;
  onPick: (s: Suggestion | null) => void;
}) {
  const suggestions = useGeocode(picked ? "" : value);
  return (
    <div className="space-y-1.5">
      <label className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
        {optional && <span className="ml-1 normal-case tracking-normal text-zinc-400">(optional)</span>}
      </label>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={picked ? picked.placeName : value}
          onChange={(e) => {
            onPick(null);
            onChange(e.target.value);
          }}
          placeholder="123 Market St, San Francisco"
          autoComplete="off"
          className="h-11 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-4 text-[14px] text-zinc-900 outline-none transition-colors focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
        />
      </div>
      {!picked && suggestions.length > 0 && (
        <div className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-sm">
          {suggestions.map((s, i) => (
            <button
              key={`${s.lat}-${s.lng}-${i}`}
              type="button"
              className="block w-full rounded-md px-3 py-2 text-left text-[13px] hover:bg-zinc-50"
              onClick={() => onPick(s)}
            >
              {s.placeName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NumberField({
  label,
  prefix,
  suffix,
  helper,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  prefix?: string;
  suffix?: string;
  helper: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const num = Number(value);
  const invalid = value !== "" && (!Number.isFinite(num) || num <= 0);
  return (
    <div className="space-y-1">
      <label className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </label>
      <div className="relative flex items-center">
        {prefix && (
          <span className="pointer-events-none absolute left-3 font-mono text-[14px] text-zinc-400">
            {prefix}
          </span>
        )}
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`h-10 w-full rounded-lg border bg-white text-[14px] text-zinc-900 outline-none transition-colors focus:ring-2 ${prefix ? "pl-7" : "pl-3"} ${suffix ? "pr-20" : "pr-3"} ${invalid ? "border-red-300 focus:border-red-500 focus:ring-red-500/20" : "border-zinc-200 focus:border-emerald-600 focus:ring-emerald-600/20"}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 text-[12px] text-zinc-500">
            {suffix}
          </span>
        )}
      </div>
      <p className="text-[11px] text-zinc-500">{helper}</p>
      {invalid && <p className="text-[11px] text-red-600">Must be a positive number.</p>}
    </div>
  );
}

export function OnboardingModal() {
  const { ready, authenticated, user } = usePrivy();
  const wallet = user?.wallet?.address;

  const [open, setOpen] = useState(false);
  const [homeQ, setHomeQ] = useState("");
  const [homePicked, setHomePicked] = useState<Suggestion | null>(null);
  const [workQ, setWorkQ] = useState("");
  const [workPicked, setWorkPicked] = useState<Suggestion | null>(null);
  const [hourly, setHourly] = useState("");
  const [mpg, setMpg] = useState("");
  const [fillup, setFillup] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!ready || !authenticated || !wallet) return;
    if (typeof window !== "undefined" && sessionStorage.getItem(STORAGE_KEY)) return;

    let aborted = false;
    fetch(`/api/users/me?wallet=${wallet}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (aborted) return;
        if (j.user && j.user.homeLat === null && j.user.homeLng === null) {
          setOpen(true);
        }
      })
      .catch(() => {});
    return () => {
      aborted = true;
    };
  }, [ready, authenticated, wallet]);

  function dismiss() {
    if (typeof window !== "undefined") sessionStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }

  function valid(): boolean {
    for (const v of [hourly, mpg, fillup]) {
      if (v === "") continue;
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) return false;
    }
    return true;
  }

  async function submit() {
    if (!wallet || !valid()) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { walletAddress: wallet };
      if (homePicked) {
        body.homeLat = homePicked.lat;
        body.homeLng = homePicked.lng;
      }
      if (workPicked) {
        body.workLat = workPicked.lat;
        body.workLng = workPicked.lng;
      }
      if (hourly !== "") body.hourlyValueUsd = Number(hourly);
      if (mpg !== "") body.avgMpg = Number(mpg);
      if (fillup !== "") body.typicalFillupGallons = Number(fillup);

      const onlySettings = !homePicked && !workPicked && Object.keys(body).length === 1;
      if (onlySettings) {
        // No fields filled → behave like skip.
        dismiss();
        return;
      }

      await fetch("/api/users/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      toast.success("Preferences saved. Looking for opportunities…");
      // Hint the OpportunityCard to refetch sooner. It polls anyway, but
      // a fresh window event lets it do an immediate refresh.
      window.dispatchEvent(new CustomEvent("gyas:prefs-updated"));
    } finally {
      setSubmitting(false);
      dismiss();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-medium text-zinc-900">
            Set up your commute
          </DialogTitle>
          <DialogDescription className="text-[13px] text-zinc-500">
            We use this to find gas stations actually worth detouring for. Both fields
            optional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-1 pt-2">
          <AddressField
            label="Home address"
            value={homeQ}
            onChange={setHomeQ}
            picked={homePicked}
            onPick={setHomePicked}
          />
          <AddressField
            label="Work address"
            optional
            value={workQ}
            onChange={setWorkQ}
            picked={workPicked}
            onPick={setWorkPicked}
          />

          <details className="group">
            <summary className="cursor-pointer select-none text-[13px] font-medium text-zinc-700 hover:text-zinc-900">
              Advanced preferences
              <span className="ml-1 text-zinc-400 group-open:hidden">›</span>
              <span className="ml-1 text-zinc-400 hidden group-open:inline">⌄</span>
            </summary>
            <div className="mt-3 space-y-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <NumberField
                label="Value of your time"
                prefix="$"
                suffix="per hour"
                helper="Used to calculate whether a detour is worth it."
                value={hourly}
                onChange={setHourly}
                placeholder="30"
              />
              <NumberField
                label="Vehicle MPG"
                helper="Used to calculate whether a detour is worth it."
                value={mpg}
                onChange={setMpg}
                placeholder="25"
              />
              <NumberField
                label="Typical fillup"
                suffix="gallons"
                helper="Used to calculate whether a detour is worth it."
                value={fillup}
                onChange={setFillup}
                placeholder="12"
              />
            </div>
          </details>

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              disabled={submitting || !valid()}
              onClick={submit}
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-emerald-600 text-[15px] font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Save preferences"}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="text-center text-[13px] text-zinc-500 hover:text-zinc-900"
            >
              Skip for now
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
