"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Check, LayoutGrid } from "lucide-react";
import { formatTripDates, sortTrips } from "@/lib/trips";

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
        className="flex max-w-full items-center gap-1.5 bg-white hover:bg-gray-50 text-gray-800 text-sm font-medium pl-3 pr-2.5 py-2 rounded-lg shadow-md border border-gray-200 transition-colors"
      >
        <span className="truncate">{current?.name ?? "Choose a trip"}</span>
        <ChevronDown size={16} className={`flex-shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div role="menu" className="absolute left-0 top-full z-20 mt-1.5 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-lg border border-gray-200 py-1 overflow-hidden">
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
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-800 truncate">{trip.name}</span>
                  {dates && <span className="block text-xs text-gray-400">{dates}</span>}
                </span>
                {isCurrent && <Check size={16} className="flex-shrink-0 text-blue-600" />}
              </Link>
            );
          })}
          <div className="my-1 border-t border-gray-100" />
          <button
            role="menuitem"
            onClick={() => { setOpen(false); onShowAllTrips(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            <LayoutGrid size={14} />
            All trips…
          </button>
        </div>
      )}
    </div>
  );
}
