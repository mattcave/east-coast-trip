"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PIN_ICONS } from "@/lib/icons";

// Wide enough for two-word place names ("Camping Republique Edmundston")
// without cutting off the word that tells them apart; names wrap to a
// second line rather than truncating
const WIDTH = 320;
// Gap between the cluster's centre and the list: its 18px radius plus room
// for the ring
const OFFSET = 30;
const MARGIN = 8;

// Where the list goes: beside the cluster (right, or left near the right
// edge) so it doesn't hide the cluster it came from. On a phone there's
// rarely room beside it, so it goes below or above instead, whichever has
// more space. `height` is the list's measured height.
function placeList({ x, y, width, height, containerWidth, containerHeight }) {
  const clampTop = (top) => Math.max(MARGIN, Math.min(top, containerHeight - height - MARGIN));
  if (x + OFFSET + width <= containerWidth - MARGIN) return { left: x + OFFSET, top: clampTop(y - 24) };
  if (x - OFFSET - width >= MARGIN) return { left: x - OFFSET - width, top: clampTop(y - 24) };
  const left = Math.max(MARGIN, Math.min(x - width / 2, containerWidth - width - MARGIN));
  const roomBelow = containerHeight - (y + OFFSET);
  const roomAbove = y - OFFSET;
  return roomBelow >= height || roomBelow >= roomAbove
    ? { left, top: y + OFFSET }
    : { left, top: Math.max(MARGIN, y - OFFSET - height) };
}

// The stops inside a small cluster, listed next to it so one click opens a
// stop instead of zooming in two or three times. Positioned in the map
// container's pixel space by Map, which closes it as soon as the map moves.
export default function ClusterList({ pins, stopNumbers, x, y, containerWidth, containerHeight, onPick, onClose }) {
  const rootRef = useRef(null);
  const width = Math.min(WIDTH, containerWidth - MARGIN * 2);
  // Placed after the first layout, once the list's height is known. Hidden
  // until then so it doesn't flash in the wrong spot.
  const [position, setPosition] = useState(null);
  useLayoutEffect(() => {
    const height = rootRef.current?.offsetHeight ?? 0;
    setPosition(placeList({ x, y, width, height, containerWidth, containerHeight }));
  }, [x, y, width, containerWidth, containerHeight]);

  // Focus the first stop so keyboard users land in the list they opened.
  // Waits until the list is placed: while it's hidden for measuring, it
  // can't take focus.
  const placed = position !== null;
  useEffect(() => {
    if (placed) rootRef.current?.querySelector("button")?.focus();
  }, [placed]);

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

  const style = position ? { ...position, width } : { left: 0, top: 0, width, visibility: "hidden" };

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
                className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-gray-50"
              >
                <span className="w-5 flex-shrink-0 pt-1 text-right text-xs font-semibold text-gray-400 tabular-nums">{number}</span>
                <span className="w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center" style={{ background: color }} title={category}>
                  <Icon size={12} color="white" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 pt-0.5 line-clamp-2 text-sm font-medium leading-snug text-gray-800">{pin.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
