"use client";

import { useEffect, useRef, useState } from "react";
import { X, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import Map from "./Map";

// The plain `search?api=1&query=` URL ignores a `zoom` param and always
// opens at Google's default place zoom, so a specific coordinate + zoom
// needs the "/@lat,lng,zoomz" form instead. Web Mercator zoom levels match
// MapLibre's, so the app's current zoom carries over directly.
function googleMapsUrl(lngLat) {
  const lat = Array.isArray(lngLat) ? lngLat[1] : lngLat.lat;
  const lng = Array.isArray(lngLat) ? lngLat[0] : lngLat.lng;
  const zoom = Math.round(Map.mapRef?.current?.getZoom() ?? 14);
  return `https://www.google.com/maps/place/${lat},${lng}/@${lat},${lng},${zoom}z`;
}

// Swipeable/scrollable photo carousel. A single photo renders with no
// carousel chrome (dots/arrows); multiple photos get a horizontal
// scroll-snap strip so it works natively with touch swipe on mobile and
// click-drag or the arrow buttons on desktop, without any extra library.
function PhotoCarousel({ images, alt }) {
  const [index, setIndex] = useState(0);
  const scrollerRef = useRef(null);

  if (images.length === 0) return null;

  const scrollToIndex = (i) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTo({ left: i * scroller.clientWidth, behavior: "smooth" });
  };

  const handleScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller || scroller.clientWidth === 0) return;
    setIndex(Math.round(scroller.scrollLeft / scroller.clientWidth));
  };

  if (images.length === 1) {
    return <img src={images[0]} alt={alt} className="w-full h-52 object-cover sm:h-64" />;
  }

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex h-52 sm:h-64 overflow-x-auto snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {images.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`${alt} photo ${i + 1} of ${images.length}`}
            className="w-full h-full object-cover flex-shrink-0 snap-center"
          />
        ))}
      </div>

      {index > 0 && (
        <button
          type="button"
          onClick={() => scrollToIndex(index - 1)}
          aria-label="Previous photo"
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
      )}
      {index < images.length - 1 && (
        <button
          type="button"
          onClick={() => scrollToIndex(index + 1)}
          aria-label="Next photo"
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      )}

      <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1.5 pointer-events-none">
        {images.map((_, i) => (
          <span
            key={i}
            className={`w-1.5 h-1.5 rounded-full shadow ${i === index ? "bg-white" : "bg-white/50"}`}
          />
        ))}
      </div>
    </div>
  );
}

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
          <div className="h-3 bg-gray-200 rounded animate-pulse w-full" />
          <div className="h-3 bg-gray-200 rounded animate-pulse w-4/5" />
          <div className="h-3 bg-gray-200 rounded animate-pulse w-3/5" />
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

        <PhotoCarousel images={pin.images ?? []} alt={pin.label} />

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

          <div className="mt-2">
            <a
              href={googleMapsUrl(pin.lngLat)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
            >
              <ExternalLink size={12} />
              View on Google Maps
            </a>
          </div>

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
