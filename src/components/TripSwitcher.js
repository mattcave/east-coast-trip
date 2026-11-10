"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Check, LayoutGrid } from "lucide-react";
import { formatTripDates, sortTrips } from "@/lib/trips";
import MotorhomeIcon from "./MotorhomeIcon";

// Pill showing the current trip, with a dropdown for jumping straight to
// another one. Positioned by TripMap's top bar; the dropdown floats over
// whatever is below the bar (the category chips, the map controls). The
// MapLibre controls are pushed down below the bar in globals.css.
export default function TripSwitcher({ trips, currentTripId, onShowAllTrips }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const current = trips.find((t) => t.id === currentTripId);

  // Close on a click outside the switcher, or Escape
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    const onKeyDown = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0 max-w-full">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="press touch-hit relative flex max-w-full items-center gap-1.5 bg-paper hover:bg-line text-ink text-sm font-medium pl-2.5 pr-2.5 py-2 rounded-lg shadow-md border border-line"
      >
        <MotorhomeIcon size={18} className="flex-shrink-0 text-accent" />
        <span className="truncate">{current?.name ?? "Choose a trip"}</span>
        <ChevronDown size={16} className={`flex-shrink-0 text-muted motion-safe:transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div role="menu" className="absolute left-0 top-full z-20 mt-1.5 w-72 max-w-[calc(100vw-2rem)] bg-paper rounded-lg shadow-lg border border-line py-1 overflow-hidden">
          {sortTrips(trips).map((trip) => {
            const dates = formatTripDates(trip);
            const isCurrent = trip.id === currentTripId;
            return (
              <Link
                key={trip.id}
                role="menuitem"
                href={`/trips/${trip.id}`}
                onClick={() => setOpen(false)}
                aria-current={isCurrent ? "page" : undefined}
                className="flex items-center gap-2 px-3 py-2 hover:bg-line/60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink truncate">{trip.name}</span>
                  {dates && <span className="block text-xs text-muted">{dates}</span>}
                </span>
                {isCurrent && <Check size={16} className="flex-shrink-0 text-accent" />}
              </Link>
            );
          })}
          <div className="my-1 border-t border-line" />
          <button
            role="menuitem"
            onClick={() => { setOpen(false); onShowAllTrips(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted hover:bg-line/60 hover:text-ink"
          >
            <LayoutGrid size={14} />
            All trips…
          </button>
        </div>
      )}
    </div>
  );
}
