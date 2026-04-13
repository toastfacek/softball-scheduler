"use client";

import { useEffect, useRef, useState } from "react";

type NominatimHit = {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    park?: string;
    sports_centre?: string;
    leisure?: string;
    amenity?: string;
    building?: string;
    name?: string;
    road?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
  };
};

type Fill = {
  venueName: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
};

const US_STATES: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR",
  California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE",
  Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID",
  Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS",
  Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
  Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK",
  Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT",
  Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV",
  Wisconsin: "WI", Wyoming: "WY",
};

function toFill(hit: NominatimHit): Fill {
  const a = hit.address ?? {};
  const venueName =
    a.name ??
    a.park ??
    a.sports_centre ??
    a.leisure ??
    a.amenity ??
    a.building ??
    hit.display_name.split(",")[0]?.trim() ??
    "";
  const addressLine1 = [a.house_number, a.road].filter(Boolean).join(" ");
  const city = a.city ?? a.town ?? a.village ?? "";
  const state = a.state ? (US_STATES[a.state] ?? a.state) : "";
  const postalCode = a.postcode ?? "";
  return { venueName, addressLine1, city, state, postalCode };
}

/**
 * Location autocomplete that is the *only* location input on the event form.
 * Maintains venue + address in internal React state and submits via hidden
 * inputs. Users never hand-edit individual fields; they search, pick, or clear.
 *
 * Uses OpenStreetMap Nominatim (keyless, rate-limited ~1 req/sec). For
 * production traffic swap to Mapbox / Google Places via an internal API route.
 */
export function LocationSearch({
  initial,
}: {
  initial?: Partial<Fill> | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimHit[]>([]);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "empty">(
    "idle",
  );
  const [fill, setFill] = useState<Fill>({
    venueName: initial?.venueName ?? "",
    addressLine1: initial?.addressLine1 ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "",
    postalCode: initial?.postalCode ?? "",
  });
  const chosen = fill.venueName || null;
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  function onChange(q: string) {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    if (q.trim().length < 3) {
      setResults([]);
      setStatus("idle");
      setOpen(false);
      return;
    }
    setStatus("loading");
    setOpen(true);
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const url =
          "https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&q=" +
          encodeURIComponent(q);
        const res = await fetch(url, { signal: controller.signal });
        const data = (await res.json()) as NominatimHit[];
        setResults(data);
        setStatus(data.length === 0 ? "empty" : "idle");
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setStatus("error");
        setResults([]);
      }
    }, 280);
  }

  function select(hit: NominatimHit) {
    const next = toFill(hit);
    if (!next.venueName) next.venueName = hit.display_name.split(",")[0] ?? "";
    setFill(next);
    setOpen(false);
    setQuery("");
  }

  function clear() {
    setFill({
      venueName: "",
      addressLine1: "",
      city: "",
      state: "",
      postalCode: "",
    });
    setQuery("");
  }

  const addressLine = [fill.addressLine1, fill.city, fill.state]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      <label>Location</label>
      <input type="hidden" name="venueName" value={fill.venueName} />
      <input type="hidden" name="addressLine1" value={fill.addressLine1} />
      <input type="hidden" name="city" value={fill.city} />
      <input type="hidden" name="state" value={fill.state} />
      <input type="hidden" name="postalCode" value={fill.postalCode} />
      {chosen ? (
        <div className="loc-selected">
          <div className="grow">
            <div className="row-title">{chosen}</div>
            {addressLine ? <div className="row-sub">{addressLine}</div> : null}
          </div>
          <button type="button" className="clear" onClick={clear} aria-label="Clear">
            <XIcon />
          </button>
        </div>
      ) : (
        <div className="loc-wrap relative">
          <input
            type="search"
            value={query}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => {
              if (results.length > 0) setOpen(true);
            }}
            placeholder="Search parks, fields, or an address…"
          />
          <div className={`loc-results${open ? " open" : ""}`}>
            {status === "loading" ? (
              <div className="loc-status">Searching…</div>
            ) : status === "error" ? (
              <div className="loc-status">
                Search unavailable. Type the address below instead.
              </div>
            ) : status === "empty" ? (
              <div className="loc-empty">
                No matches. Try a broader search.
              </div>
            ) : (
              results.map((hit, idx) => {
                const parts = hit.display_name.split(", ");
                const name = parts[0] ?? hit.display_name;
                const addr = parts.slice(1).join(", ");
                return (
                  <button
                    key={`${hit.lat}-${hit.lon}-${idx}`}
                    type="button"
                    className="loc-result"
                    onClick={() => select(hit)}
                  >
                    <div className="loc-name">{name}</div>
                    {addr ? <div className="loc-addr">{addr}</div> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function XIcon() {
  return (
    <svg
      width="14"
      height="14"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
