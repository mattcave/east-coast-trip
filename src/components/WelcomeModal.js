"use client";

import { X, MapPin, Camera, BookOpen } from "lucide-react";

// Explains what the site is. Visibility is controlled by the parent
// (TripMap), which decides when to show it on first visit and lets a
// help button reopen it later.
export default function WelcomeModal({ onClose }) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Panel - bottom sheet on mobile, centered card on desktop, matching PinPopup */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl overflow-hidden sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:right-auto sm:w-[440px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="p-5 pb-8 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-semibold text-gray-900 text-lg sm:text-xl leading-snug">
              Welcome 👋
            </h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition-colors p-0.5"
            >
              <X size={20} />
            </button>
          </div>

          <p className="mt-2 text-sm sm:text-base text-gray-600 leading-relaxed">
            We piled into our trusty motorhome, Fernando, and drove all the
            way from Ontario to Nova Scotia this summer - this map is every
            place we stopped along the way, pinned right where the memory
            happened.
          </p>

          <ul className="mt-4 flex flex-col gap-3">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center">
                <MapPin size={14} className="text-blue-600" />
              </span>
              <span className="text-sm text-gray-600 leading-relaxed">
                Tap any pin to relive that stop - photos, a little story,
                and exactly where we were.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center">
                <Camera size={14} className="text-blue-600" />
              </span>
              <span className="text-sm text-gray-600 leading-relaxed">
                Every stop has our own photos and a few words about what
                made it worth remembering.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center">
                <BookOpen size={14} className="text-blue-600" />
              </span>
              <span className="text-sm text-gray-600 leading-relaxed">
                Want to know more about a place? Most pins link out to
                Wikipedia so you can dig in.
              </span>
            </li>
          </ul>

          <button
            onClick={onClose}
            className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            Start exploring
          </button>
        </div>
      </div>
    </>
  );
}
