"use client";

import { useEffect, useRef, useState } from "react";
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

export function OnboardingModal() {
  const { ready, authenticated, user } = usePrivy();
  const wallet = user?.wallet?.address;

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [picked, setPicked] = useState<Suggestion | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

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

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const r = await geocode(q);
      setSuggestions(r);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  function dismiss() {
    if (typeof window !== "undefined") sessionStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }

  async function submit() {
    if (!picked || !wallet) return;
    setSubmitting(true);
    try {
      await fetch("/api/users/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          walletAddress: wallet,
          homeLat: picked.lat,
          homeLng: picked.lng,
        }),
      });
    } finally {
      setSubmitting(false);
      dismiss();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Where do you usually drive?</DialogTitle>
          <DialogDescription>
            We&apos;ll surface gas opportunities near your home.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-1">
          <div className="space-y-1.5">
            <Label htmlFor="home">Home address</Label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="home"
                value={picked ? picked.placeName : q}
                onChange={(e) => {
                  setPicked(null);
                  setQ(e.target.value);
                }}
                placeholder="123 Market St, San Francisco"
                className="pl-8"
                autoComplete="off"
              />
            </div>
            {!picked && suggestions.length > 0 && (
              <div className="mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover p-1 shadow-sm">
                {suggestions.map((s, i) => (
                  <button
                    key={`${s.lat}-${s.lng}-${i}`}
                    type="button"
                    className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setPicked(s);
                      setSuggestions([]);
                    }}
                  >
                    {s.placeName}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={dismiss}>
              Skip for now
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={!picked || submitting}
              onClick={submit}
            >
              {submitting ? "Saving..." : "Save home address"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
