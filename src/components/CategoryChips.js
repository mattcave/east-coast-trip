"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { PIN_ICONS } from "@/lib/icons";

// Filter chips for the categories a trip uses. Each chip's dot is the
// marker colour, so the row doubles as the map's legend. Nothing selected
// shows every stop; selecting chips narrows the map to those categories.
//
// On a phone the row is wider than the screen and scrolls sideways, which
// nothing showed: it just ended at a chip. While there's more to the right,
// the chips fade out at the right edge. It's a mask on the chips rather
// than a white overlay, because the row floats over the map and a white
// band would show up as a smear across it.
const FADE = "linear-gradient(to right, black calc(100% - 40px), transparent)";

export default function CategoryChips({ categories, selected, onToggle, onClear }) {
  const rowRef = useRef(null);
  const [moreRight, setMoreRight] = useState(false);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const update = () => setMoreRight(row.scrollLeft + row.clientWidth < row.scrollWidth - 1);
    update();
    row.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(row);
    return () => {
      row.removeEventListener("scroll", update);
      observer.disconnect();
    };
  // Chips come and go (Show all), which changes the scroll width
  }, [categories, selected.size]);

  return (
    <div
      ref={rowRef}
      role="group"
      aria-label="Filter stops by category"
      className="flex max-w-full gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden"
      style={{
        scrollbarWidth: "none",
        maskImage: moreRight ? FADE : undefined,
        WebkitMaskImage: moreRight ? FADE : undefined,
      }}
    >
      {categories.map((key) => {
        const { label, color } = PIN_ICONS[key];
        const isOn = selected.has(key);
        return (
          <button
            key={key}
            type="button"
            aria-pressed={isOn}
            onClick={() => onToggle(key)}
            className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium shadow-sm transition-colors ${
              isOn
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden="true" />
            {label}
          </button>
        );
      })}
      {selected.size > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="flex flex-shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-500 shadow-sm hover:bg-gray-50 hover:text-gray-700"
        >
          <X size={12} aria-hidden="true" />
          Show all
        </button>
      )}
    </div>
  );
}
