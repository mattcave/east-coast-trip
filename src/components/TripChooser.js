"use client";

import Link from "next/link";
import { X, Map as MapIcon } from "lucide-react";
import Sheet from "./Sheet";
import { SITE_NAME, formatTripDates, sortTrips, tripCoverImage } from "@/lib/trips";

// Lists every trip as a card. Shown on each visit to the site root, and from
// the trip switcher's "All trips" item or a trip summary's "other trips" link.
// Picking a card navigates to /trips/<id>; the map stays mounted (see the
// (map) layout) and TripMap flies to the new trip. onPick(tripId) lets
// TripMap skip that trip's summary popup.
export default function TripChooser({ trips, pinsByTrip, currentTripId, onPick, onClose }) {
  return (
    <Sheet onClose={onClose} labelledBy="trip-chooser-title" widthClass="sm:w-[520px]">
      <div className="p-5 pb-8 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="trip-chooser-title" className="font-semibold text-gray-900 text-lg sm:text-xl leading-snug">{SITE_NAME}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition-colors p-0.5"
          >
            <X size={20} />
          </button>
        </div>

        <p className="mt-2 text-sm sm:text-base text-gray-600 leading-relaxed">
          Every road trip we&apos;ve taken, pinned on a map - with photos and a few
          words from each stop. Pick a trip to start exploring.
        </p>

        <ul className="mt-4 flex flex-col gap-2">
          {sortTrips(trips).map((trip) => {
            const pins = pinsByTrip[trip.id] ?? [];
            const cover = tripCoverImage(pins);
            const dates = formatTripDates(trip);
            const meta = [dates, `${pins.length} ${pins.length === 1 ? "stop" : "stops"}`].filter(Boolean).join(" · ");
            const isCurrent = trip.id === currentTripId;

            return (
              <li key={trip.id}>
                <Link
                  href={`/trips/${trip.id}`}
                  // Also closes the chooser, which matters when picking the
                  // trip that's already showing (the URL doesn't change)
                  onClick={() => onPick(trip.id)}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`flex items-center gap-3 p-2 rounded-xl border transition-colors ${
                    isCurrent ? "border-blue-300 bg-blue-50/50" : "border-gray-100 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {cover ? (
                    <img src={cover} alt="" className="w-16 h-16 flex-shrink-0 rounded-lg object-cover bg-gray-100" />
                  ) : (
                    <span className="w-16 h-16 flex-shrink-0 rounded-lg bg-gray-100 flex items-center justify-center">
                      <MapIcon size={22} className="text-gray-400" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-gray-900 truncate">{trip.name}</span>
                    <span className="block text-xs text-gray-400">{meta}</span>
                    {trip.description && (
                      <span className="mt-0.5 block text-sm text-gray-600 line-clamp-2">{trip.description}</span>
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
