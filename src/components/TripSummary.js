"use client";

import { X } from "lucide-react";
import Sheet from "./Sheet";
import { formatTripDayRange, tripCoverImage } from "@/lib/trips";
import { pinImages } from "@/lib/pins";

// "14–31 Aug 2026 · 45 stops · 22 with photos", leaving out what isn't known
function factsLine(trip, pins) {
  const withPhotos = pins.filter((p) => pinImages(p).length > 0).length;
  return [
    formatTripDayRange(trip),
    pins.length > 0 ? `${pins.length} ${pins.length === 1 ? "stop" : "stops"}` : null,
    withPhotos > 0 ? `${withPhotos} with photos` : null,
  ].filter(Boolean).join(" · ");
}

// Introduces one trip. Shown the first time a visitor opens a trip page, and
// reopenable from the help button. Visibility is controlled by TripMap.
// The cover photo is the one the trip's chooser card uses. `onStart` closes
// the intro and opens the first stop; it's only offered when there is one.
// There are no "how to use the map" tips: the first stop shows how it works.
export default function TripSummary({ trip, pins, sheetRef, onClose, onStart, onShowAllTrips }) {
  const cover = tripCoverImage(pins);
  const facts = factsLine(trip, pins);
  const intro = trip.intro || trip.description;

  return (
    <Sheet onClose={onClose} labelledBy="trip-summary-title" sheetRef={sheetRef} handleOnPhoto={Boolean(cover)}>
      <div className="relative">
        {/* 16:9, but on a short phone no taller than a quarter of the
            screen, so the trip name, facts line and the start of the intro
            still show above the buttons without scrolling */}
        {cover && <img src={cover} alt="" className="aspect-video max-h-[25dvh] w-full object-cover bg-line sm:max-h-none" />}
        <button
          onClick={onClose}
          aria-label="Close"
          className={`press absolute top-3 right-3 rounded-full p-1.5 ${
            cover ? "bg-black/45 text-white hover:bg-black/65" : "text-muted hover:text-ink hover:bg-line"
          }`}
        >
          <X size={20} />
        </button>
      </div>

      <div className={`px-5 sm:px-6 ${cover ? "pt-4" : "pt-7 sm:pt-6"}`}>
        <h2 id="trip-summary-title" className="pr-10 font-serif font-semibold text-ink text-[26px] sm:text-[30px] leading-[1.15]">
          {trip.name}
        </h2>
        {facts && <p className="mt-1.5 text-xs font-medium text-muted">{facts}</p>}

        {intro && (
          <p className="mt-3 font-serif text-[17px] sm:text-[18px] leading-[1.6] text-ink whitespace-pre-line">{intro}</p>
        )}
      </div>

      {/* Kept in view at the bottom of the sheet while the intro scrolls,
          so the way into the trip is never below the fold on a phone */}
      <div className="sticky bottom-0 mt-5 flex flex-col gap-0.5 bg-paper px-5 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:gap-1 sm:px-6 sm:pt-3 sm:pb-6 border-t border-line">
        {onStart && (
          <button
            onClick={onStart}
            className="press w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Start at stop 1
          </button>
        )}
        <button
          onClick={onClose}
          className={onStart
            ? "press w-full rounded-lg py-1.5 sm:py-2 text-sm font-medium text-accent hover:bg-line/60 hover:text-accent-hover"
            : "press w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white hover:bg-accent-hover"}
        >
          Browse the map
        </button>
        {onShowAllTrips && (
          <button
            onClick={onShowAllTrips}
            className="press w-full py-1 text-sm font-medium text-muted hover:text-ink hover:underline underline-offset-2"
          >
            See our other trips
          </button>
        )}
      </div>
    </Sheet>
  );
}
