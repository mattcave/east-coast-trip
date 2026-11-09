"use client";

import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

// Distance (px) a finger has to travel before a swipe counts, so a tap or a
// slightly wobbly touch doesn't change photo
const SWIPE_THRESHOLD = 50;

// Full-screen photo viewer over a dark background. Photos are shown whole
// (object-contain), never cropped. Arrow keys and the on-screen buttons step
// through them; on touch, swipe sideways to step and swipe down to close.
// Closing hands back the current index so the carousel underneath can show
// the same photo. Pinch-to-zoom is deliberately left out for now.
export default function PhotoViewer({ images, alt, startIndex = 0, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const [dragY, setDragY] = useState(0);
  const touchRef = useRef(null);
  const closeRef = useRef(null);
  const indexRef = useRef(index);
  useEffect(() => { indexRef.current = index; });
  const count = images.length;

  const step = (delta) => setIndex((i) => Math.max(0, Math.min(count - 1, i + delta)));

  // Focus moves into the viewer, and back to the photo that opened it on close
  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  // Captured at the window and stopped there, so the stop panel underneath
  // doesn't also step to another stop (arrows) or close (Escape), and
  // MapLibre doesn't pan the map. Tab is kept inside the viewer, since it
  // covers everything else.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose(indexRef.current);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "Tab") {
        const focusable = [...document.querySelectorAll("[data-photo-viewer] button:not([disabled])")];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        return;
      } else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- step only uses the setter and count
  }, [onClose, count]);

  const onTouchStart = (e) => {
    if (e.touches.length !== 1) { touchRef.current = null; return; }
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, axis: null };
  };

  const onTouchMove = (e) => {
    const start = touchRef.current;
    if (!start) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Commit to one axis once the finger has clearly moved, so a sideways
    // swipe with a little vertical drift doesn't start dragging downwards
    if (!start.axis && Math.hypot(dx, dy) > 10) start.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (start.axis === "y") setDragY(Math.max(0, dy));
  };

  const onTouchEnd = (e) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (start.axis === "y" && dy > SWIPE_THRESHOLD * 2) { onClose(index); return; }
    setDragY(0);
    if (start.axis === "x" && Math.abs(dx) > SWIPE_THRESHOLD) step(dx < 0 ? 1 : -1);
  };

  return (
    <div
      data-photo-viewer
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} photos`}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black select-none"
      // The browser's own touch panning/zooming would fight the swipe gestures
      style={{ touchAction: "none", backgroundColor: dragY ? `rgba(0,0,0,${Math.max(0.4, 1 - dragY / 600)})` : undefined }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => { touchRef.current = null; setDragY(0); }}
    >
      <img
        src={images[index]}
        alt={`${alt} photo ${index + 1} of ${count}`}
        className="max-w-full max-h-full object-contain motion-safe:transition-transform"
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined }}
        draggable={false}
      />

      {count > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm font-medium text-white tabular-nums" aria-live="polite">
          {index + 1} / {count}
        </div>
      )}

      <button
        ref={closeRef}
        type="button"
        onClick={() => onClose(index)}
        aria-label="Close photo viewer"
        className="absolute top-3 right-3 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
      >
        <X size={22} />
      </button>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={index === 0}
            aria-label="Previous photo"
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={26} />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={index === count - 1}
            aria-label="Next photo"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={26} />
          </button>
        </>
      )}
    </div>
  );
}
