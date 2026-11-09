"use client";

import { useEffect, useRef } from "react";
import { trapTabKey } from "./focusTrap";

// Modal shell shared by the trip summary and trip chooser: a bottom sheet on
// mobile and a centered card on desktop, matching PinPopup. Clicking the
// backdrop or pressing Escape closes it. It's modal at every size, so focus
// moves in when it opens, Tab stays inside, and focus goes back to whatever
// opened it (the help button, the trip menu) when it closes.
// `labelledBy` is the id of the heading that names the dialog.
export default function Sheet({ onClose, children, labelledBy, widthClass = "sm:w-[440px]" }) {
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
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onKeyDown={(e) => trapTabKey(e, dialogRef.current)}
        className={`outline-none fixed bottom-0 left-0 right-0 z-50 max-h-[85dvh] overflow-y-auto overscroll-contain bg-white rounded-t-2xl shadow-2xl sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl ${widthClass}`}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        {children}
      </div>
    </>
  );
}
