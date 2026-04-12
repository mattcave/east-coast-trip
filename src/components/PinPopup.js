"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

function WikiSection({ pin }) {
  const [wiki, setWiki] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (pin.wikipedia === "none") return;

    setLoading(true);
    setWiki(null);

    const url = pin.wikipedia
      ? `/api/wikipedia?url=${encodeURIComponent(pin.wikipedia)}`
      : (() => {
          const lat = Array.isArray(pin.lngLat) ? pin.lngLat[1] : pin.lngLat.lat;
          const lng = Array.isArray(pin.lngLat) ? pin.lngLat[0] : pin.lngLat.lng;
          return `/api/wikipedia?lat=${lat}&lng=${lng}`;
        })();

    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { setWiki(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [pin.id, pin.wikipedia]);

  if (pin.wikipedia === "none") return null;

  // First paragraph only (Wikipedia extracts can be multi-paragraph)
  const extract = wiki?.extract?.split("\n")[0];

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      {loading && (
        <div className="space-y-2">
          <div className="h-3 bg-gray-100 rounded animate-pulse w-full" />
          <div className="h-3 bg-gray-100 rounded animate-pulse w-4/5" />
        </div>
      )}
      {!loading && wiki && (
        <>
          <p className="text-sm text-gray-500 leading-relaxed line-clamp-3">{extract}</p>
          <a
            href={wiki.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            Read more on Wikipedia →
          </a>
        </>
      )}
    </div>
  );
}

export default function PinPopup({ pin, onClose, onEdit }) {
  if (!pin) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-20 bg-black/30" onClick={onClose} />

      {/* Panel — bottom sheet on mobile, centered card on desktop */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white rounded-t-2xl shadow-2xl overflow-hidden sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:right-auto sm:w-[460px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {pin.image && (
          <img
            src={pin.image}
            alt={pin.label}
            className="w-full h-52 object-cover sm:h-64"
          />
        )}

        <div className="p-4 pb-8 sm:p-6 sm:pb-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-semibold text-gray-900 text-lg sm:text-xl leading-snug">
              {pin.label}
            </h2>
            <button
              onClick={onClose}
              className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition-colors p-0.5"
            >
              <X size={20} />
            </button>
          </div>

          {pin.description && (
            <p className="mt-2 text-sm sm:text-base text-gray-600 leading-relaxed">
              {pin.description}
            </p>
          )}

          <WikiSection pin={pin} />

          {onEdit && (
            <button
              onClick={() => onEdit(pin.id)}
              className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
            >
              Edit
            </button>
          )}
        </div>
      </div>
    </>
  );
}
