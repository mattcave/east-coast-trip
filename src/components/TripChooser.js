"use client";

import Link from "next/link";
import { X } from "lucide-react";
import Sheet from "./Sheet";
import MotorhomeIcon from "./MotorhomeIcon";
import { SITE_NAME, formatTripDayRange, plannedTripTag, sortTrips, tripCoverImage } from "@/lib/trips";

// Lists every trip as a card. Shown on each visit to the site root, and from
// the trip switcher's "All trips" item or a trip summary's "other trips" link.
// Picking a card navigates to /trips/<id>; the map stays mounted (see the
// (map) layout) and TripMap flies to the new trip. onPick(tripId) lets
// TripMap skip that trip's summary popup.
//
// A trip with stops gets its cover photo across the top of the card and a
// facts line ("14–31 Aug 2026 · 45 stops"). A trip without any yet has
// nothing to show, so it's a text-only card with a "Planned" tag (with the
// year once the trip has a start date).
export default function TripChooser({ trips, pinsByTrip, currentTripId, sheetRef, onPick, onClose }) {
  return (
    <Sheet onClose={onClose} labelledBy="trip-chooser-title" sheetRef={sheetRef} widthClass="sm:w-[520px]">
      <div className="p-5 pt-6 pb-8 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="trip-chooser-title" className="flex items-center gap-2.5 font-serif font-semibold text-ink text-[26px] sm:text-[30px] leading-[1.15]">
            <MotorhomeIcon size={30} className="flex-shrink-0 text-accent" />
            {SITE_NAME}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="press flex-shrink-0 rounded-full p-1 text-muted hover:text-ink hover:bg-line"
          >
            <X size={20} />
          </button>
        </div>

        <p className="mt-2 text-sm sm:text-base text-muted leading-relaxed">
          Every road trip we&apos;ve taken, pinned on a map - with photos and a few
          words from each stop. Pick a trip to start exploring.
        </p>

        <ul className="mt-5 flex flex-col gap-4">
          {sortTrips(trips).map((trip) => {
            const pins = pinsByTrip[trip.id] ?? [];
            const cover = tripCoverImage(pins);
            const dates = formatTripDayRange(trip);
            const facts = [dates, `${pins.length} ${pins.length === 1 ? "stop" : "stops"}`].filter(Boolean).join(" · ");
            const isCurrent = trip.id === currentTripId;

            return (
              <li key={trip.id}>
                <Link
                  href={`/trips/${trip.id}`}
                  // Also closes the chooser, which matters when picking the
                  // trip that's already showing (the URL doesn't change)
                  onClick={() => onPick(trip.id)}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`group block overflow-hidden rounded-xl border bg-white shadow-sm transition-[box-shadow,transform,border-color] duration-200 hover:shadow-lg motion-safe:hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    isCurrent ? "border-accent ring-1 ring-accent" : "border-line"
                  }`}
                >
                  {pins.length > 0 && cover && (
                    <img src={cover} alt="" className="aspect-video w-full object-cover bg-line" />
                  )}
                  <span className="block p-4">
                    <span className="block font-serif font-semibold text-[20px] leading-tight text-ink">{trip.name}</span>
                    {pins.length > 0 ? (
                      <span className="mt-1 block text-xs font-medium text-muted">{facts}</span>
                    ) : (
                      <span className="mt-1.5 inline-block rounded-full bg-line px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink">
                        {plannedTripTag(trip)}
                      </span>
                    )}
                    {trip.description && (
                      <span className="mt-1.5 block text-sm text-muted leading-relaxed line-clamp-2">{trip.description}</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}
