"use client";

import { useEffect, useRef, useState } from "react";
import { X, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import PhotoViewer from "./PhotoViewer";
import { pinImages } from "@/lib/pins";
import { prefersReducedMotion } from "@/lib/trips";

// The plain `search?api=1&query=` URL ignores a `zoom` param and always
// opens at Google's default place zoom, so a specific coordinate + zoom
// needs the "/@lat,lng,zoomz" form instead. Web Mercator zoom levels match
// MapLibre's, so the app's current zoom carries over directly.
function googleMapsUrl(lngLat, zoom) {
  const lat = Array.isArray(lngLat) ? lngLat[1] : lngLat.lat;
  const lng = Array.isArray(lngLat) ? lngLat[0] : lngLat.lng;
  return `https://www.google.com/maps/place/${lat},${lng}/@${lat},${lng},${Math.round(zoom ?? 14)}z`;
}

// Keyboard shortcuts shouldn't fire while the user is typing in a field.
function isTypingTarget(el) {
  return el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

// Photo frame height. Grows on large screens, but is capped at a share of
// the viewport so the story below stays visible on short laptop screens.
const FRAME_HEIGHT = "h-52 sm:h-60 lg:h-[min(320px,40vh)]";

// One photo in the fixed-height frame, as a button that opens the
// full-screen viewer. Uploads keep their original aspect ratio, so the
// photo is shown whole (object-contain) over a blurred, zoomed copy of
// itself that fills any letterbox space — a portrait shot isn't cropped,
// and a ~3:2 landscape shot simply covers the backdrop.
function Slide({ src, alt, onOpen, className = "" }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${alt}, open full screen`}
      className={`relative block w-full h-full flex-shrink-0 overflow-hidden bg-gray-900 cursor-zoom-in focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white ${className}`}
    >
      <img src={src} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl brightness-75" />
      <img src={src} alt={alt} className="relative w-full h-full object-contain" />
    </button>
  );
}

// Swipeable/scrollable photo carousel. A single photo renders with no
// carousel chrome (dots/arrows); multiple photos get a horizontal
// scroll-snap strip so it works natively with touch swipe on mobile and
// click-drag or the arrow buttons on desktop, without any extra library.
// The keyboard arrows belong to stop stepping now; photos are stepped with
// the buttons, swipe, or the full-screen viewer.
function PhotoCarousel({ images, alt, onOpen, scrollRequest }) {
  const [index, setIndex] = useState(0);
  const scrollerRef = useRef(null);

  const scrollToIndex = (i, smooth = true) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTo({ left: i * scroller.clientWidth, behavior: smooth && !prefersReducedMotion() ? "smooth" : "instant" });
  };

  // Coming back from the full-screen viewer: show the photo it was on.
  // Instant, so the carousel doesn't visibly slide past the others.
  // Focus follows too: the viewer hands focus back to the photo that opened
  // it, which is the wrong one if the visitor moved on inside the viewer.
  // This runs after the viewer's unmount cleanup, so it has the last word.
  useEffect(() => {
    if (!scrollRequest) return;
    scrollToIndex(scrollRequest.index, false);
    scrollerRef.current?.children[scrollRequest.index]?.focus({ preventScroll: true });
  }, [scrollRequest]);

  const handleScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller || scroller.clientWidth === 0) return;
    setIndex(Math.round(scroller.scrollLeft / scroller.clientWidth));
  };

  if (images.length === 0) return null;

  if (images.length === 1) {
    return (
      <div className={FRAME_HEIGHT}>
        <Slide src={images[0]} alt={alt} onOpen={() => onOpen(0)} />
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className={`flex ${FRAME_HEIGHT} overflow-x-auto snap-x snap-mandatory motion-safe:scroll-smooth [&::-webkit-scrollbar]:hidden`}
        style={{ scrollbarWidth: "none" }}
      >
        {images.map((src, i) => (
          <Slide
            key={i}
            src={src}
            alt={`${alt} photo ${i + 1} of ${images.length}`}
            onOpen={() => onOpen(i)}
            className="snap-center"
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
  const url = pin.wikipedia === "none"
    ? null
    : pin.wikipedia
      ? `/api/wikipedia?url=${encodeURIComponent(pin.wikipedia)}`
      : (() => {
          const lat = Array.isArray(pin.lngLat) ? pin.lngLat[1] : pin.lngLat.lat;
          const lng = Array.isArray(pin.lngLat) ? pin.lngLat[0] : pin.lngLat.lng;
          return `/api/wikipedia?lat=${lat}&lng=${lng}`;
        })();

  // The result remembers which request URL it answers, so loading and stale
  // data are derived during render rather than reset at the start of the effect
  const [result, setResult] = useState({ url: null, data: null });
  const loading = url !== null && result.url !== url;
  const wiki = result.url === url ? result.data : null;

  useEffect(() => {
    if (!url) return;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setResult({ url, data }))
      .catch(() => setResult({ url, data: null }));
  }, [url]);

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

function StepButton({ direction, target, onClick }) {
  const isPrev = direction === "prev";
  const Icon = isPrev ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!target}
      aria-label={target ? `${isPrev ? "Previous" : "Next"} stop: ${target.label}` : `No ${isPrev ? "previous" : "next"} stop`}
      className={`flex min-w-0 flex-1 items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium transition-colors text-blue-600 hover:bg-blue-50 hover:text-blue-800 disabled:text-gray-300 disabled:hover:bg-transparent ${isPrev ? "justify-start" : "justify-end"}`}
    >
      {isPrev && <Icon size={18} className="flex-shrink-0" />}
      <span className="min-w-0 text-left">
        <span className={`block text-[11px] font-normal ${target ? "text-gray-400" : "text-gray-300"} ${isPrev ? "" : "text-right"}`}>
          {isPrev ? "Previous stop" : "Next stop"}
        </span>
        <span className={`block truncate ${isPrev ? "" : "text-right"}`}>{target?.label ?? "—"}</span>
      </span>
      {!isPrev && <Icon size={18} className="flex-shrink-0" />}
    </button>
  );
}

// One stop's details. A bottom sheet on mobile (capped at 85% of the
// visible height, scrolling inside, with the title and stop controls fixed
// at its top and bottom), and from the sm breakpoint a full-height panel
// docked to the right that leaves the map undimmed, so the pin that was
// clicked stays visible beside it. TripMap measures the panel through
// panelRef to keep the stop clear of it.
//
// ArrowLeft/ArrowRight step between stops while the panel is open (when
// `keyboardEnabled`), and Escape closes it.
export default function PinPopup({
  pin, prev, next, onPrev, onNext, onClose, onEdit, getZoom, panelRef, keyboardEnabled = true,
}) {
  const [viewer, setViewer] = useState(null); // { index } while the full-screen viewer is open
  const [scrollRequest, setScrollRequest] = useState(null);
  const dialogRef = useRef(null);
  const scrollRef = useRef(null);
  const images = pinImages(pin);

  // Whatever had focus when the panel opened (usually the marker) gets it
  // back when the panel closes, so keyboard users carry on from where they were
  useEffect(() => {
    const opener = document.activeElement;
    dialogRef.current?.focus({ preventScroll: true });
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  // Each stop starts scrolled to the top, and the viewer never carries over
  const [shownPinId, setShownPinId] = useState(pin.id);
  if (pin.id !== shownPinId) {
    setShownPinId(pin.id);
    setViewer(null);
    setScrollRequest(null);
  }
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [pin.id]);

  // Captured at the window and stopped there so MapLibre's own keyboard
  // handler doesn't also pan the map when its canvas has focus. The photo
  // viewer handles its own keys while it's open.
  useEffect(() => {
    if (!keyboardEnabled || viewer) return;
    const onKeyDown = (e) => {
      if (isTypingTarget(e.target) || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "Escape") { onClose(); return; }
      const handler = e.key === "ArrowLeft" ? (prev && onPrev) : e.key === "ArrowRight" ? (next && onNext) : null;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      e.stopPropagation();
      handler?.();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [keyboardEnabled, viewer, prev, next, onPrev, onNext, onClose]);

  const closeViewer = (index) => {
    setViewer(null);
    setScrollRequest({ index });
  };

  return (
    <>
      {/* Backdrop — mobile only. On desktop the map stays live and
          undimmed beside the panel; clicking it closes the panel via
          TripMap's map click handler. */}
      <div className="fixed inset-0 z-20 bg-black/30 sm:hidden" onClick={onClose} aria-hidden="true" />

      <div
        ref={(el) => {
          dialogRef.current = el;
          if (panelRef) panelRef.current = el;
        }}
        role="dialog"
        aria-labelledby="pin-popup-title"
        tabIndex={-1}
        className="fixed bottom-0 left-0 right-0 z-30 flex max-h-[85dvh] flex-col bg-white rounded-t-2xl shadow-2xl outline-none sm:top-0 sm:bottom-0 sm:left-auto sm:max-h-none sm:w-[380px] sm:rounded-none lg:w-[440px]"
      >
        {/* Header: always visible */}
        <div className="flex-shrink-0 border-b border-gray-100">
          {/* Mobile drag handle */}
          <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>
          <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-1 sm:px-5 sm:pt-4">
            <h2 id="pin-popup-title" className="font-semibold text-gray-900 text-lg sm:text-xl leading-snug">
              {pin.label}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition-colors p-0.5"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body: scrolls on its own */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <PhotoCarousel
            key={pin.id}
            images={images}
            alt={pin.label}
            onOpen={(index) => setViewer({ index })}
            scrollRequest={scrollRequest}
          />

          <div className="p-4 sm:p-5">
            {pin.description && (
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                {pin.description}
              </p>
            )}

            <div className={pin.description ? "mt-2" : undefined}>
              <a
                href={googleMapsUrl(pin.lngLat, getZoom?.())}
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
                type="button"
                onClick={() => onEdit(pin.id)}
                className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                Edit
              </button>
            )}
          </div>
        </div>

        {/* Footer: stop stepping, always visible. The bottom padding keeps
            it clear of the iPhone home indicator. */}
        {(prev || next) && (
          <div className="flex flex-shrink-0 items-stretch gap-2 border-t border-gray-100 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <StepButton direction="prev" target={prev} onClick={onPrev} />
            <StepButton direction="next" target={next} onClick={onNext} />
          </div>
        )}
      </div>

      {viewer && (
        <PhotoViewer images={images} alt={pin.label} startIndex={viewer.index} onClose={closeViewer} />
      )}
    </>
  );
}
