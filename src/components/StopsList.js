"use client";

import { useState } from "react";
import { Camera, Search } from "lucide-react";
import SidePanel from "./SidePanel";
import { PIN_ICONS } from "@/lib/icons";
import { pinCategory } from "@/lib/categories";
import { formatPinDate, pinImages, matchesStopQuery } from "@/lib/pins";

// Every stop in the trip, in order, in the same panel as a single stop.
// Picking one closes the list, eases the map to it and opens it.
export default function StopsList({ stops, stopNumbers, onPick, onClose, panelRef }) {
  const [query, setQuery] = useState("");
  const shown = stops.filter((pin) => matchesStopQuery(pin, query));

  const filter = (
    <div className="px-4 pb-3 sm:px-5">
      <label className="relative block">
        <span className="sr-only">Filter stops by name</span>
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name"
          className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </label>
    </div>
  );

  return (
    <SidePanel
      titleId="stops-list-title"
      title="Stops"
      eyebrow={`${stops.length} ${stops.length === 1 ? "stop" : "stops"} in order`}
      headerExtra={stops.length > 6 ? filter : null}
      onClose={onClose}
      panelRef={panelRef}
    >
      {shown.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-500">No stops match “{query.trim()}”.</p>
      ) : (
        <ol className="py-1">
          {shown.map((pin) => {
            const category = pinCategory(pin);
            const { icon: Icon, color, label: categoryLabel } = PIN_ICONS[category];
            const date = formatPinDate(pin.date);
            const photoCount = pinImages(pin).length;
            const number = stopNumbers[pin.id];
            return (
              <li key={pin.id}>
                <button
                  type="button"
                  onClick={() => onPick(pin)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 sm:px-5"
                >
                  <span className="w-6 flex-shrink-0 text-right text-xs font-semibold text-gray-400 tabular-nums">{number}</span>
                  <span
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ background: color }}
                    title={categoryLabel}
                  >
                    <Icon size={13} color="white" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-snug text-gray-800">{pin.label}</span>
                    <span className="block text-xs text-gray-400">
                      {[categoryLabel, date].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {photoCount > 0 && (
                    <span className="flex flex-shrink-0 items-center gap-1 text-xs text-gray-400" title={`${photoCount} ${photoCount === 1 ? "photo" : "photos"}`}>
                      <Camera size={14} aria-hidden="true" />
                      <span className="sr-only">{photoCount} {photoCount === 1 ? "photo" : "photos"}</span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </SidePanel>
  );
}
