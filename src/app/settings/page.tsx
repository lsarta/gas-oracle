"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { toast } from "sonner";
import { ConnectButton } from "@/components/ConnectButton";
import { LiveTxCounter } from "@/components/LiveTxCounter";
import { Wordmark } from "@/components/Wordmark";
import { Info, MapPin, Trash2 } from "lucide-react";

const DEBOUNCE_MS = 250;

type Suggestion = { placeName: string; lat: number; lng: number };

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

type Me = {
  homeLat: number | null;
  homeLng: number | null;
  homeAddress: string | null;
  workLat: number | null;
  workLng: number | null;
  workAddress: string | null;
  hourlyValueUsd: number | null;
  avgMpg: number | null;
  typicalFillupGallons: number | null;
};

function AddressEditor({
  label,
  initialCoords,
  initialAddress,
  emptyCallout,
  onSave,
  onClear,
}: {
  label: string;
  initialCoords: { lat: number; lng: number } | null;
  initialAddress: string | null;
  /** Shown in place of "Not set" when no coords are saved yet. */
  emptyCallout?: React.ReactNode;
  onSave: (s: Suggestion) => void;
  onClear?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Suggestion | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const tref = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (tref.current) clearTimeout(tref.current);
    if (!editing || picked || !q.trim()) {
      setSuggestions([]);
      return;
    }
    tref.current = setTimeout(async () => {
      setSuggestions(await geocode(q));
    }, DEBOUNCE_MS);
    return () => {
      if (tref.current) clearTimeout(tref.current);
    };
  }, [q, editing, picked]);

  if (!editing) {
    if (!initialCoords && emptyCallout) {
      return (
        <div className="space-y-2">
          <p className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            {label}
          </p>
          {emptyCallout}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[13px] font-medium text-zinc-700 hover:text-zinc-900"
          >
            Set {label.toLowerCase()}
          </button>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            {label}
          </p>
          {initialAddress ? (
            <p className="mt-1 truncate text-[14px] text-zinc-900">{initialAddress}</p>
          ) : initialCoords ? (
            <>
              <p className="mt-1 truncate font-mono text-[13px] text-zinc-700">
                {initialCoords.lat.toFixed(5)}, {initialCoords.lng.toFixed(5)}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                Re-set to see address
              </p>
            </>
          ) : (
            <p className="mt-1 text-[14px] text-zinc-500">Not set</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {initialCoords && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="text-[13px] text-zinc-500 hover:text-red-600"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md border border-zinc-200 px-3 py-1 text-[13px] font-medium text-zinc-700 hover:border-zinc-300 hover:text-zinc-900"
          >
            {initialCoords ? "Edit" : "Set"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={picked ? picked.placeName : q}
          onChange={(e) => {
            setPicked(null);
            setQ(e.target.value);
          }}
          placeholder="123 Market St, San Francisco"
          autoComplete="off"
          className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-4 text-[14px] text-zinc-900 outline-none transition-colors focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
        />
      </div>
      {!picked && suggestions.length > 0 && (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-sm">
          {suggestions.map((s, i) => (
            <button
              key={`${s.lat}-${s.lng}-${i}`}
              type="button"
              className="block w-full rounded-md px-3 py-2 text-left text-[13px] hover:bg-zinc-50"
              onClick={() => setPicked(s)}
            >
              {s.placeName}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!picked}
          onClick={() => {
            if (picked) {
              onSave(picked);
              setEditing(false);
              setPicked(null);
              setQ("");
            }
          }}
          className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-4 text-[13px] font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setPicked(null);
            setQ("");
          }}
          className="text-[13px] text-zinc-500 hover:text-zinc-900"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { ready, authenticated, user } = usePrivy();
  const wallet = user?.wallet?.address;

  const [me, setMe] = useState<Me | null>(null);
  const [hourly, setHourly] = useState("");
  const [mpg, setMpg] = useState("");
  const [fillup, setFillup] = useState("");
  const [savingPrefs, setSavingPrefs] = useState(false);

  const refresh = useCallback(async () => {
    if (!wallet) return;
    const r = await fetch(`/api/users/me?wallet=${wallet}`, { cache: "no-store" });
    const j = await r.json();
    if (j.user) {
      setMe({
        homeLat: j.user.homeLat,
        homeLng: j.user.homeLng,
        homeAddress: j.user.homeAddress,
        workLat: j.user.workLat,
        workLng: j.user.workLng,
        workAddress: j.user.workAddress,
        hourlyValueUsd: j.user.hourlyValueUsd,
        avgMpg: j.user.avgMpg,
        typicalFillupGallons: j.user.typicalFillupGallons,
      });
      setHourly(j.user.hourlyValueUsd?.toString() ?? "");
      setMpg(j.user.avgMpg?.toString() ?? "");
      setFillup(j.user.typicalFillupGallons?.toString() ?? "");
    }
  }, [wallet]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function postUpdate(body: Record<string, unknown>) {
    if (!wallet) return;
    await fetch("/api/users/update", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ walletAddress: wallet, ...body }),
    });
    await refresh();
    // Notify the OpportunityCard so it refetches without waiting for its
    // 60s poll cycle.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("gyas:prefs-updated"));
    }
  }

  async function clearLocations() {
    if (!wallet) return;
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        "Clear your home and work addresses? You'll need to set them again to get recommendations.",
      );
      if (!ok) return;
    }
    await postUpdate({
      homeLat: null,
      homeLng: null,
      homeAddress: null,
      workLat: null,
      workLng: null,
      workAddress: null,
    });
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("gyas:onboarding-dismissed");
    }
    toast.success("Locations cleared");
  }

  async function savePrefs() {
    if (!wallet) return;
    setSavingPrefs(true);
    try {
      const body: Record<string, unknown> = {};
      if (hourly !== "") body.hourlyValueUsd = Number(hourly);
      if (mpg !== "") body.avgMpg = Number(mpg);
      if (fillup !== "") body.typicalFillupGallons = Number(fillup);
      await postUpdate(body);
      toast.success("Preferences saved.");
    } finally {
      setSavingPrefs(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/95 px-6 backdrop-blur-[1px]">
        <Link href="/">
          <Wordmark size="sm" withMark />
        </Link>
        <nav className="flex items-center gap-6 text-[14px] text-zinc-700">
          <Link href="/" className="hover:text-zinc-900">
            Home
          </Link>
          <Link href="/map" className="hover:text-zinc-900">
            Map
          </Link>
          <Link href="/verticals" className="hover:text-zinc-900">
            Verticals
          </Link>
          <Link
            href="/developers"
            className="inline-flex items-center gap-1.5 hover:text-zinc-900"
          >
            Developers
            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 font-inter text-[9px] font-medium uppercase tracking-wider text-emerald-700">
              new
            </span>
          </Link>
          <Link href="/stats" className="hover:text-zinc-900">
            Live
          </Link>
          <LiveTxCounter />
          <ConnectButton />
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[640px] flex-1 px-6 py-12">
        <h1 className="text-[32px] font-medium tracking-tight text-zinc-900">
          Settings
        </h1>

        {!ready || !authenticated ? (
          <p className="mt-6 text-[14px] text-zinc-500">Sign in to manage settings.</p>
        ) : !me ? (
          <p className="mt-6 text-[14px] text-zinc-500">Loading…</p>
        ) : (
          <>
            <section className="mt-10">
              <p className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Locations
              </p>
              <div className="mt-4 space-y-6 rounded-xl border border-zinc-200 bg-white p-6">
                <AddressEditor
                  label="Home address"
                  initialCoords={
                    me.homeLat !== null && me.homeLng !== null
                      ? { lat: me.homeLat, lng: me.homeLng }
                      : null
                  }
                  initialAddress={me.homeAddress}
                  onSave={async (s) => {
                    await postUpdate({
                      homeLat: s.lat,
                      homeLng: s.lng,
                      homeAddress: s.placeName,
                    });
                    toast.success("Home address updated.");
                  }}
                />
                <div className="h-px bg-zinc-100" />
                <AddressEditor
                  label="Work address"
                  initialCoords={
                    me.workLat !== null && me.workLng !== null
                      ? { lat: me.workLat, lng: me.workLng }
                      : null
                  }
                  initialAddress={me.workAddress}
                  emptyCallout={
                    <div className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
                      <p className="text-[12px] leading-snug text-zinc-600">
                        Set work to get commute-aware recommendations. Stations on
                        your route earn you more than ones out of the way.
                      </p>
                    </div>
                  }
                  onSave={async (s) => {
                    await postUpdate({
                      workLat: s.lat,
                      workLng: s.lng,
                      workAddress: s.placeName,
                    });
                    toast.success("Work address updated.");
                  }}
                  onClear={async () => {
                    await postUpdate({
                      workLat: null,
                      workLng: null,
                      workAddress: null,
                    });
                    toast.success("Work address cleared.");
                  }}
                />
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={clearLocations}
                  className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-red-600"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear locations
                </button>
              </div>
            </section>

            <section className="mt-10">
              <p className="font-inter text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Detour preferences
              </p>
              <div className="mt-4 space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
                <NumPref
                  label="Value of your time"
                  prefix="$"
                  suffix="per hour"
                  value={hourly}
                  onChange={setHourly}
                  placeholder="30"
                />
                <NumPref
                  label="Vehicle MPG"
                  value={mpg}
                  onChange={setMpg}
                  placeholder="25"
                />
                <NumPref
                  label="Typical fillup"
                  suffix="gallons"
                  value={fillup}
                  onChange={setFillup}
                  placeholder="12"
                />
                <button
                  type="button"
                  disabled={savingPrefs}
                  onClick={savePrefs}
                  className="inline-flex h-10 items-center rounded-lg bg-emerald-600 px-4 text-[14px] font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                >
                  {savingPrefs ? "Saving…" : "Save preferences"}
                </button>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function NumPref({
  label,
  prefix,
  suffix,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  prefix?: string;
  suffix?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
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
          className={`h-10 w-full rounded-lg border border-zinc-200 bg-white text-[14px] text-zinc-900 outline-none transition-colors focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 ${prefix ? "pl-7" : "pl-3"} ${suffix ? "pr-20" : "pr-3"}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 text-[12px] text-zinc-500">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
