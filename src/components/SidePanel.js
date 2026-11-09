"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { trapTabKey } from "./focusTrap";

// The shell shared by the stop panel and the stops list. A bottom sheet on
// mobile (capped at 85% of the visible height, or 55% at first for a stop,
// see mobileSnap; scrolling inside, with the header and footer fixed), and from the sm breakpoint a full-height panel
// docked to the right that leaves the map undimmed beside it. TripMap
// measures it through panelRef to keep the selected stop clear of it.
//
// Focus moves into the panel when it opens and back to whatever opened it
// when it closes. Escape closes it; layers above it (the photo viewer, a
// cluster list) stop the key before it gets here. As a bottom sheet it's
// modal (the backdrop covers the map), so Tab stays inside it; docked on
// desktop it isn't, and Tab can carry on out to the map.
//
// With `mobileSnap` (the stop panel), the mobile sheet works differently,
// so the stop it shows stays visible on the map above it: it opens at 55%
// of the screen with no dim over the map (tapping the map closes it, via
// TripMap's map click handler), and its handle drags it up to 85% or back
// down, or closes it when dragged down from 55%. The handle is also a
// button, for keyboards and screen readers. `snapKey` (the stop's id) drops
// it back to 55% when the visitor moves to another stop, so each stop
// starts with its marker in view.
const SNAP_DRAG_THRESHOLD = 40; // px of drag that counts as a swipe
const DRAG_START = 6; // px of movement before a press becomes a drag

function isMobileViewport() {
  // Same breakpoint as Tailwind's sm, where the sheet docks right
  return !window.matchMedia("(min-width: 640px)").matches;
}

export default function SidePanel({
  titleId, title, eyebrow = null, headerExtra = null, footer = null, onClose, panelRef, bodyRef, children,
  mobileSnap = false, snapKey = null,
}) {
  const dialogRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [shownSnapKey, setShownSnapKey] = useState(snapKey);
  if (snapKey !== shownSnapKey) {
    setShownSnapKey(snapKey);
    setExpanded(false);
  }

  // Dragging the header. The live height is written straight to the
  // element's style while the finger moves (no re-render per frame), then
  // cleared on release so the class for the snapped size takes over.
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);
  const onPointerDown = (e) => {
    if (!mobileSnap || !isMobileViewport() || e.button > 0) return;
    dragRef.current = { id: e.pointerId, startY: e.clientY, startHeight: dialogRef.current.offsetHeight, moved: false };
  };
  const onPointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== e.pointerId) return;
    const dy = e.clientY - drag.startY;
    if (!drag.moved) {
      if (Math.abs(dy) < DRAG_START) return;
      drag.moved = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    const viewport = window.visualViewport?.height ?? window.innerHeight;
    const panel = dialogRef.current;
    panel.style.transition = "none";
    panel.style.maxHeight = `${Math.max(80, Math.min(drag.startHeight - dy, viewport * 0.85))}px`;
  };
  const endDrag = (e) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== e.pointerId) return;
    dragRef.current = null;
    if (!drag.moved) return;
    const panel = dialogRef.current;
    panel.style.transition = "";
    panel.style.maxHeight = "";
    // The press started on the header, which holds the close button; a
    // drag that ends there mustn't also count as a click on it
    suppressClickRef.current = true;
    const dy = e.clientY - drag.startY;
    if (e.type === "pointercancel") return;
    if (dy <= -SNAP_DRAG_THRESHOLD) setExpanded(true);
    else if (dy >= SNAP_DRAG_THRESHOLD) {
      if (expanded) setExpanded(false);
      else onClose();
    }
  };
  const onClickCapture = (e) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  useEffect(() => {
    const opener = document.activeElement;
    dialogRef.current?.focus({ preventScroll: true });
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <>
      {/* Backdrop — mobile only, and not for the stop sheet (see
          mobileSnap). On desktop the map stays live and undimmed beside
          the panel; clicking it closes the panel via TripMap's map click
          handler. */}
      {!mobileSnap && (
        <div className="fixed inset-0 z-20 bg-black/30 sm:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <div
        ref={(el) => {
          dialogRef.current = el;
          if (panelRef) panelRef.current = el;
        }}
        role="dialog"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (isMobileViewport()) trapTabKey(e, dialogRef.current);
        }}
        className={`fixed bottom-0 left-0 right-0 z-30 flex ${mobileSnap && !expanded ? "max-h-[55dvh]" : "max-h-[85dvh]"} motion-safe:transition-[max-height] motion-safe:duration-200 flex-col bg-paper text-ink rounded-t-2xl shadow-2xl outline-none sm:top-0 sm:bottom-0 sm:left-auto sm:max-h-none sm:w-[380px] sm:rounded-none lg:w-[520px]`}
      >
        {/* Header: always visible. With mobileSnap it's also the drag
            area, so touch gestures on it go to the drag, not the page. */}
        <div
          className={`flex-shrink-0 border-b border-line ${mobileSnap ? "touch-none sm:touch-auto" : ""}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={onClickCapture}
        >
          {/* Mobile drag handle */}
          {mobileSnap ? (
            <button
              type="button"
              onClick={() => setExpanded((x) => !x)}
              aria-expanded={expanded}
              aria-label={expanded ? "Show less of this stop" : "Show more of this stop"}
              className="flex w-full justify-center pt-2.5 pb-1 sm:hidden cursor-grab"
            >
              <span className="w-10 h-1 bg-line rounded-full" />
            </button>
          ) : (
            <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-line rounded-full" />
            </div>
          )}
          <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-1 sm:px-5 sm:pt-4">
            <div className="min-w-0">
              {eyebrow && <p className="mb-1 text-xs font-medium text-muted">{eyebrow}</p>}
              <h2 id={titleId} className="font-serif font-semibold text-ink text-[22px] sm:text-[26px] leading-[1.15]">
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="press flex-shrink-0 rounded text-muted hover:text-ink p-0.5"
            >
              <X size={20} />
            </button>
          </div>
          {headerExtra}
        </div>

        {/* Body: scrolls on its own */}
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>

        {footer}
      </div>
    </>
  );
}
