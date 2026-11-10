"use client";

import { useEffect } from "react";
import SidePanel from "./SidePanel";
import { StepButton } from "./PinPopup";
import { pinImages, regionsInOrder } from "@/lib/pins";
import { tripDayCount } from "@/lib/trips";

// Photos in the mosaic: the first photo of each stop that has any, in trip
// order, up to this many (three or four full rows)
const MOSAIC_MAX = 12;

// Keyboard shortcuts shouldn't fire while the user is typing in a field
function isTypingTarget(el) {
  return el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

// "That's the trip": shown after the last stop, from its "The end of the
// trip" button, in the same panel or sheet as a stop. The trip in numbers
// ("45 stops · 18 days"), the provinces and states it passed through, a
// mosaic of photos that each open their stop, and a way to start again.
// Previous (and the left arrow key) goes back to the last stop. It has no
// `?stop=` value of its own; a shared link opens stops, not this card.
export default function FinishCard({
  trip, stops, stopNumbers, lastStop, onPrev, onOpenStop, onShowAllTrips, onClose, panelRef,
  onPreviewStop, keyboardEnabled = true,
}) {
  const days = tripDayCount(trip);
  const facts = [
    `${stops.length} ${stops.length === 1 ? "stop" : "stops"}`,
    days ? `${days} ${days === 1 ? "day" : "days"}` : null,
  ].filter(Boolean).join(" · ");
  const regions = regionsInOrder(stops);
  const tiles = stops
    .map((stop) => ({ stop, src: pinImages(stop).find(Boolean) }))
    .filter((t) => t.src)
    .slice(0, MOSAIC_MAX);

  // Same rule as a stop: captured at the window so MapLibre doesn't also
  // pan the map. Only the left arrow does anything here.
  useEffect(() => {
    if (!keyboardEnabled) return;
    const onKeyDown = (e) => {
      if (e.key !== "ArrowLeft" || isTypingTarget(e.target) || e.altKey || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();
      onPrev();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [keyboardEnabled, onPrev]);

  const footer = (
    <div className="flex flex-shrink-0 items-stretch gap-2 border-t border-line px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <StepButton direction="prev" target={lastStop} onClick={onPrev} onPreview={onPreviewStop} />
      <div className="flex-1" />
    </div>
  );

  return (
    <SidePanel
      titleId="finish-card-title"
      title="That's the trip"
      eyebrow={trip.name}
      footer={footer}
      onClose={onClose}
      panelRef={panelRef}
    >
      <div className="px-4 pt-4 pb-5 sm:px-5 sm:pt-5">
        <p className="text-sm font-medium text-ink">{facts}</p>
        {regions.length > 0 && (
          <p className="mt-1 text-sm text-muted leading-relaxed">{regions.join(" · ")}</p>
        )}

        {tiles.length > 0 && (
          <ul className="mt-4 grid grid-cols-3 gap-2 dock:grid-cols-4" aria-label="Photos from the trip">
            {tiles.map(({ stop, src }) => (
              <li key={stop.id}>
                <button
                  type="button"
                  onClick={() => onOpenStop(stop)}
                  aria-label={`Stop ${stopNumbers[stop.id]}: ${stop.label}`}
                  className="group block aspect-square w-full overflow-hidden rounded-md bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <img
                    src={src}
                    alt=""
                    className="h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-[1.03]"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => onOpenStop(stops[0])}
            className="press w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Start again at stop 1
          </button>
          {onShowAllTrips && (
            <button
              type="button"
              onClick={onShowAllTrips}
              className="press w-full py-1.5 text-sm font-medium text-accent hover:text-accent-hover hover:underline underline-offset-2"
            >
              See our other trips
            </button>
          )}
        </div>
      </div>
    </SidePanel>
  );
}
