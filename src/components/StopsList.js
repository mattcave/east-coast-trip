"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import SidePanel from "./SidePanel";
import { PIN_ICONS } from "@/lib/icons";
import { pinCategory } from "@/lib/categories";
import { formatPinDate, pinImages, matchesStopQuery, groupStopsByDay } from "@/lib/pins";

// Every stop in the trip, in order, in the same panel as a single stop.
// Picking one closes the list, eases the map to it and opens it. Once every
// stop has a date, the list is grouped under day headings.
export default function StopsList({ trip, stops, stopNumbers, onPick, onClose, panelRef }) {
  const [query, setQuery] = useState("");
  const shown = stops.filter((pin) => matchesStopQuery(pin, query));

  const filter = (
    <div className="px-4 pb-3 sm:px-5">
      <label className="relative block">
        <span className="sr-only">Filter stops by name</span>
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name"
          className="w-full rounded-lg border border-line bg-white py-1.5 pl-8 pr-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </label>
    </div>
  );

  // Day headings, once every stop has a date (null until then)
  const groups = groupStopsByDay(stops, trip);

  const row = (pin) => {
    const category = pinCategory(pin);
    const { icon: Icon, color, label: categoryLabel } = PIN_ICONS[category];
    const thumb = pinImages(pin).find(Boolean);
    // Under a day heading the date would only repeat it
    const date = groups ? null : formatPinDate(pin.date);
    const number = stopNumbers[pin.id];
    return (
      <li key={pin.id}>
        <button
          type="button"
          onClick={() => onPick(pin)}
          className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-line/50 sm:px-5"
        >
          <span className="w-6 flex-shrink-0 text-right text-xs font-semibold text-muted tabular-nums">{number}</span>
          {/* The stop's first photo, or its category icon when it has none.
              The thumbnail also replaces the old camera icon: it shows which
              stops have photos. */}
          {thumb ? (
            <img src={thumb} alt="" className="h-10 w-10 flex-shrink-0 rounded-md object-cover bg-line" />
          ) : (
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full"
                style={{ background: color }}
                title={categoryLabel}
              >
                <Icon size={13} color="white" aria-hidden="true" />
              </span>
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium leading-snug text-ink">{pin.label}</span>
            <span className="block text-xs text-muted">
              {[categoryLabel, date].filter(Boolean).join(" · ")}
              {thumb && <span className="sr-only">, has photos</span>}
            </span>
          </span>
        </button>
      </li>
    );
  };

  const noMatch = <p className="px-5 py-6 text-sm text-muted">No stops match “{query.trim()}”.</p>;

  let list;
  if (groups) {
    // The filter applies inside each day; a day with no matches loses its
    // heading too
    const shownIds = new Set(shown.map((p) => p.id));
    const visible = groups
      .map((g) => ({ ...g, stops: g.stops.filter((p) => shownIds.has(p.id)) }))
      .filter((g) => g.stops.length > 0);
    list = visible.length === 0 ? noMatch : (
      <div className="pb-1">
        {visible.map((g, i) => (
          <section key={`${g.date}-${i}`} aria-label={g.label}>
            <h3 className="sticky top-0 z-[1] bg-paper/95 px-4 pt-3 pb-1 text-xs font-semibold text-muted sm:px-5">{g.label}</h3>
            <ol>{g.stops.map(row)}</ol>
          </section>
        ))}
      </div>
    );
  } else {
    list = shown.length === 0 ? noMatch : <ol className="py-1">{shown.map(row)}</ol>;
  }

  return (
    <SidePanel
      titleId="stops-list-title"
      title="Stops"
      eyebrow={`${stops.length} ${stops.length === 1 ? "stop" : "stops"} in order`}
      headerExtra={stops.length > 6 ? filter : null}
      onClose={onClose}
      panelRef={panelRef}
    >
      {list}
    </SidePanel>
  );
}
