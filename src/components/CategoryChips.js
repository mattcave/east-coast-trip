"use client";

import { X } from "lucide-react";
import { PIN_ICONS } from "@/lib/icons";

// Filter chips for the categories a trip uses. Each chip's dot is the
// marker colour, so the row doubles as the map's legend. Nothing selected
// shows every stop; selecting chips narrows the map to those categories.
export default function CategoryChips({ categories, selected, onToggle, onClear }) {
  return (
    <div
      role="group"
      aria-label="Filter stops by category"
      className="flex max-w-full gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden"
      style={{ scrollbarWidth: "none" }}
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
