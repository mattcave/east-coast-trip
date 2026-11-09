"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { trapTabKey } from "./focusTrap";

// The shell shared by the stop panel and the stops list. A bottom sheet on
// mobile (capped at 85% of the visible height, scrolling inside, with the
// header and footer fixed), and from the sm breakpoint a full-height panel
// docked to the right that leaves the map undimmed beside it. TripMap
// measures it through panelRef to keep the selected stop clear of it.
//
// Focus moves into the panel when it opens and back to whatever opened it
// when it closes. Escape closes it; layers above it (the photo viewer, a
// cluster list) stop the key before it gets here. As a bottom sheet it's
// modal (the backdrop covers the map), so Tab stays inside it; docked on
// desktop it isn't, and Tab can carry on out to the map.
export default function SidePanel({
  titleId, title, eyebrow = null, headerExtra = null, footer = null, onClose, panelRef, bodyRef, children,
}) {
  const dialogRef = useRef(null);

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
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(e) => {
          // Same breakpoint as Tailwind's sm, where the sheet docks right
          if (!window.matchMedia("(min-width: 640px)").matches) trapTabKey(e, dialogRef.current);
        }}
        className="fixed bottom-0 left-0 right-0 z-30 flex max-h-[85dvh] flex-col bg-white rounded-t-2xl shadow-2xl outline-none sm:top-0 sm:bottom-0 sm:left-auto sm:max-h-none sm:w-[380px] sm:rounded-none lg:w-[440px]"
      >
        {/* Header: always visible */}
        <div className="flex-shrink-0 border-b border-gray-100">
          {/* Mobile drag handle */}
          <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>
          <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-1 sm:px-5 sm:pt-4">
            <div className="min-w-0">
              {eyebrow && <p className="mb-0.5 text-xs font-medium text-gray-400">{eyebrow}</p>}
              <h2 id={titleId} className="font-semibold text-gray-900 text-lg sm:text-xl leading-snug">
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex-shrink-0 rounded text-gray-400 hover:text-gray-700 transition-colors p-0.5"
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
