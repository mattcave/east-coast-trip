"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, ChevronLeft, ChevronRight, List, Link2, Check } from "lucide-react";
import PhotoViewer from "./PhotoViewer";
import SidePanel from "./SidePanel";
import { pinImages, formatPinDate } from "@/lib/pins";
import { pinCategory } from "@/lib/categories";
import { PIN_ICONS } from "@/lib/icons";
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

      <div className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-medium text-white tabular-nums pointer-events-none">
        {index + 1} / {images.length}
      </div>

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

// Copies text to the clipboard. The Clipboard API only exists in secure
// contexts (https or localhost), so a plain-http visit falls back to the
// older execCommand copy from a throwaway textarea. Resolves true on success.
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or not focused - try the fallback
  }
  try {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand("copy");
    field.remove();
    return ok;
  } catch {
    return false;
  }
}

// "Copy link" for sharing this stop, with a short confirmation in place of
// the label that screen readers also hear
function CopyLinkButton({ href }) {
  const [status, setStatus] = useState(null); // null | "copied" | "failed"
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const copy = async () => {
    const ok = await copyText(new URL(href, window.location.origin).href);
    setStatus(ok ? "copied" : "failed");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setStatus(null), 2000);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
    >
      {status === "copied" ? <Check size={12} aria-hidden="true" /> : <Link2 size={12} aria-hidden="true" />}
      <span aria-live="polite">
        {status === "copied" ? "Link copied" : status === "failed" ? "Couldn't copy" : "Copy link"}
      </span>
    </button>
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

// One stop's details, in the shared SidePanel shell (bottom sheet on
// mobile, docked right on desktop). ArrowLeft/ArrowRight step between stops
// while it's open (when `keyboardEnabled`); SidePanel handles Escape.
export default function PinPopup({
  pin, stopNumber, stopCount, prev, next, onPrev, onNext, onClose, onEdit, onBackToList,
  shareHref, getZoom, panelRef, keyboardEnabled = true,
}) {
  const [viewer, setViewer] = useState(null); // { index } while the full-screen viewer is open
  const [scrollRequest, setScrollRequest] = useState(null);
  const scrollRef = useRef(null);
  const images = pinImages(pin);

  // "Stop 12 of 44 · Camping · July 14", leaving out whatever isn't known
  const eyebrow = [
    stopNumber ? `Stop ${stopNumber} of ${stopCount}` : null,
    PIN_ICONS[pinCategory(pin)].label,
    formatPinDate(pin.date),
  ].filter(Boolean).join(" · ");

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
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (isTypingTarget(e.target) || e.altKey || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "ArrowLeft" && prev) onPrev();
      if (e.key === "ArrowRight" && next) onNext();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [keyboardEnabled, viewer, prev, next, onPrev, onNext]);

  const closeViewer = (index) => {
    setViewer(null);
    setScrollRequest({ index });
  };

  // Stop stepping, always visible. The bottom padding keeps it clear of the
  // iPhone home indicator.
  const footer = (prev || next) ? (
    <div className="flex flex-shrink-0 items-stretch gap-2 border-t border-gray-100 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <StepButton direction="prev" target={prev} onClick={onPrev} />
      <StepButton direction="next" target={next} onClick={onNext} />
    </div>
  ) : null;

  return (
    <>
      <SidePanel
        titleId="pin-popup-title"
        title={pin.label}
        eyebrow={eyebrow}
        headerExtra={onBackToList ? (
          <button
            type="button"
            onClick={onBackToList}
            className="-mt-1 mb-2 ml-4 sm:ml-5 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            <List size={12} />
            All stops
          </button>
        ) : null}
        footer={footer}
        onClose={onClose}
        panelRef={panelRef}
        bodyRef={scrollRef}
      >
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

          <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${pin.description ? "mt-2" : ""}`}>
            <a
              href={googleMapsUrl(pin.lngLat, getZoom?.())}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
            >
              <ExternalLink size={12} />
              View on Google Maps
            </a>
            {/* Keyed by stop so the confirmation doesn't carry over */}
            {shareHref && <CopyLinkButton key={pin.id} href={shareHref} />}
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
      </SidePanel>

      {viewer && (
        <PhotoViewer images={images} alt={pin.label} startIndex={viewer.index} onClose={closeViewer} />
      )}
    </>
  );
}
