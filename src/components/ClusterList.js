"use client";

import { useEffect, useRef } from "react";
import { PIN_ICONS } from "@/lib/icons";

const WIDTH = 240;

// The stops inside a small cluster, listed next to it so one click opens a
// stop instead of zooming in two or three times. Positioned in the map
// container's pixel space by Map, which closes it as soon as the map moves.
export default function ClusterList({ pins, stopNumbers, x, y, containerWidth, containerHeight, onPick, onClose }) {
  const rootRef = useRef(null);

  // Focus the first stop so keyboard users land in the list they opened
  useEffect(() => {
    rootRef.current?.querySelector("button")?.focus();
  }, []);

  useEffect(() => {
    const onPointerDown = (e) => { if (!rootRef.current?.contains(e.target)) onClose(); };
    // Captured and stopped so an open stop panel underneath doesn't also
    // close on the same Escape
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown, { capture: true });
    };
  }, [onClose]);

  // Below the cluster, or above it when it's in the bottom half of the map,
  // and nudged sideways to stay inside the map near the edges
  const below = y < containerHeight / 2;
  const left = Math.max(8, Math.min(x - WIDTH / 2, containerWidth - WIDTH - 8));
  const style = below ? { left, top: y + 28, width: WIDTH } : { left, bottom: containerHeight - y + 28, width: WIDTH };

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label={`${pins.length} stops here`}
      className="absolute z-10 bg-white rounded-lg shadow-lg border border-gray-200 py-1 max-h-72 overflow-y-auto"
      style={style}
    >
      <ul>
        {pins.map((pin) => {
          const { icon: Icon, color, label: category } = PIN_ICONS[pin.icon] ?? PIN_ICONS.default;
          const number = stopNumbers?.[pin.id];
          return (
            <li key={pin.id}>
              <button
                type="button"
                onClick={() => onPick(pin)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50"
              >
                <span className="w-5 flex-shrink-0 text-right text-xs font-semibold text-gray-400 tabular-nums">{number}</span>
                <span className="w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center" style={{ background: color }} title={category}>
                  <Icon size={12} color="white" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">{pin.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
