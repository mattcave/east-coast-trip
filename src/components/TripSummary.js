"use client";

import { X, MapPin, Camera, BookOpen } from "lucide-react";
import Sheet from "./Sheet";
import { formatTripDates } from "@/lib/trips";

const TIPS = [
  { icon: MapPin, text: "Tap any pin to relive that stop - photos, a little story, and exactly where we were." },
  { icon: Camera, text: "Every stop has our own photos and a few words about what made it worth remembering." },
  { icon: BookOpen, text: "Want to know more about a place? Most pins link out to Wikipedia so you can dig in." },
];

// Introduces one trip. Shown the first time a visitor opens a trip page, and
// reopenable from the help button. Visibility is controlled by TripMap.
export default function TripSummary({ trip, pinCount, onClose, onShowAllTrips }) {
  const dates = formatTripDates(trip);
  const meta = [dates, `${pinCount} ${pinCount === 1 ? "stop" : "stops"}`].filter(Boolean).join(" · ");
  const intro = trip.intro || trip.description;

  return (
    <Sheet onClose={onClose}>
      <div className="p-5 pb-8 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900 text-lg sm:text-xl leading-snug">{trip.name}</h2>
            <p className="mt-0.5 text-xs font-medium text-gray-400">{meta}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition-colors p-0.5"
          >
            <X size={20} />
          </button>
        </div>

        {intro && (
          <p className="mt-3 text-sm sm:text-base text-gray-600 leading-relaxed whitespace-pre-line">{intro}</p>
        )}

        <ul className="mt-4 flex flex-col gap-3">
          {TIPS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center">
                <Icon size={14} className="text-blue-600" />
              </span>
              <span className="text-sm text-gray-600 leading-relaxed">{text}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={onClose}
          className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
        >
          Start exploring
        </button>

        {onShowAllTrips && (
          <button
            onClick={onShowAllTrips}
            className="mt-2 w-full text-sm font-medium text-blue-600 hover:text-blue-800 py-1.5 transition-colors"
          >
            See our other trips
          </button>
        )}
      </div>
    </Sheet>
  );
}
