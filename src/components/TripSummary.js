"use client";

import { X, MapPin, Camera, BookOpen } from "lucide-react";
import Sheet from "./Sheet";
import { formatTripDayRange, tripCoverImage } from "@/lib/trips";
import { tripSummaryFacts, pinImages } from "@/lib/pins";

// The photo and Wikipedia tips only appear when the trip's pins back them
// up (see tripSummaryFacts), so the summary never promises what isn't there
function summaryTips(pins) {
  const facts = tripSummaryFacts(pins);
  return [
    { icon: MapPin, text: "Tap any pin to relive that stop - photos, a little story, and exactly where we were." },
    facts.photos && { icon: Camera, text: "Lots of stops have our own photos and a few words about what made them worth remembering." },
    facts.wikipedia && { icon: BookOpen, text: "Want to know more about a place? Some stops link out to Wikipedia so you can dig in." },
  ].filter(Boolean);
}

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
export default function TripSummary({ trip, pins, sheetRef, onClose, onStart, onShowAllTrips }) {
  const cover = tripCoverImage(pins);
  const facts = factsLine(trip, pins);
  const intro = trip.intro || trip.description;
  const tips = summaryTips(pins);

  return (
    <Sheet onClose={onClose} labelledBy="trip-summary-title" sheetRef={sheetRef} handleOnPhoto={Boolean(cover)}>
      <div className="relative">
        {cover && <img src={cover} alt="" className="aspect-video w-full object-cover bg-line" />}
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

        {tips.length > 0 && (
          <ul className="mt-4 flex flex-col gap-3">
            {tips.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center">
                  <Icon size={14} className="text-accent" aria-hidden="true" />
                </span>
                <span className="text-sm text-muted leading-relaxed">{text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Kept in view at the bottom of the sheet while the intro scrolls,
          so the way into the trip is never below the fold on a phone */}
      <div className="sticky bottom-0 mt-5 flex flex-col gap-1 bg-paper px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6 border-t border-line">
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
            ? "press w-full rounded-lg py-2 text-sm font-medium text-accent hover:bg-line/60 hover:text-accent-hover"
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
