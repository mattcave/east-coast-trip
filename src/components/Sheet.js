"use client";

import { useEffect } from "react";

// Modal shell shared by the trip summary and trip chooser: a bottom sheet on
// mobile and a centered card on desktop, matching PinPopup. Clicking the
// backdrop or pressing Escape closes it.
export default function Sheet({ onClose, children, widthClass = "sm:w-[440px]" }) {
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        className={`fixed bottom-0 left-0 right-0 z-50 max-h-[85dvh] overflow-y-auto overscroll-contain bg-white rounded-t-2xl shadow-2xl sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl ${widthClass}`}
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
