// Trip helpers that are safe to import from both server and client code (no
// fs access). Persistence lives in src/lib/store.js.

export const SITE_NAME = "Cave Family Road Trips";

// Trip ids double as URL slugs (/trips/<id>) and as pin file names
// (data/pins/<id>.json), so they're restricted to lowercase words joined by
// single hyphens. That also rules out path traversal via the id.
const TRIP_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidTripId(id) {
  return typeof id === "string" && id.length <= 64 && TRIP_ID_RE.test(id);
}

export function slugify(name) {
  const slug = String(name)
    // Split accented letters into letter + combining mark, then drop the
    // marks, so "Québec" becomes "quebec" rather than "qu-bec"
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/, "");
  return slug || "trip";
}

export function uniqueTripId(name, existingIds) {
  const taken = new Set(existingIds);
  const base = slugify(name);
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

// Picks the editable trip fields out of a request body and validates them.
// Unknown keys (including `id`) are ignored. Returns { fields } or { error }.
export function sanitizeTripFields(body) {
  if (!body || typeof body !== "object") return { error: "Invalid request body" };
  const fields = {};

  for (const key of ["name", "description", "intro"]) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== "string") return { error: `${key} must be a string` };
    fields[key] = body[key].trim();
  }
  if (fields.name === "") return { error: "name can't be empty" };

  for (const key of ["startDate", "endDate"]) {
    if (body[key] === undefined) continue;
    if (body[key] === null || body[key] === "") { fields[key] = null; continue; }
    if (typeof body[key] !== "string" || !DATE_RE.test(body[key])) {
      return { error: `${key} must be a YYYY-MM-DD date` };
    }
    fields[key] = body[key];
  }

  if (body.view !== undefined) {
    const view = body.view;
    if (view === null) {
      fields.view = null;
    } else {
      const valid = view && Array.isArray(view.center) && view.center.length === 2
        && view.center.every(isFiniteNumber) && isFiniteNumber(view.zoom);
      if (!valid) return { error: "view must be null or { center: [lng, lat], zoom }" };
      fields.view = { center: [view.center[0], view.center[1]], zoom: view.zoom };
    }
  }

  return { fields };
}

// Newest first by start date; undated trips go last, in their stored order
export function sortTrips(trips) {
  return [...trips].sort((a, b) => {
    if (a.startDate && b.startDate) return b.startDate.localeCompare(a.startDate);
    if (a.startDate) return -1;
    if (b.startDate) return 1;
    return 0;
  });
}

// The view the map flies to for a trip: an explicit view set in the admin
// panel wins, otherwise fit all of the trip's pins. Returns
// { center, zoom }, { bounds }, or null for a trip with no view and no pins.
export function tripHomeView(trip, pins = []) {
  if (trip?.view) return { center: trip.view.center, zoom: trip.view.zoom };

  const coords = pins.map((p) => p.lngLat).filter((c) => Array.isArray(c) && c.length === 2);
  if (coords.length === 0) return null;

  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  const [west, east] = [Math.min(...lngs), Math.max(...lngs)];
  const [south, north] = [Math.min(...lats), Math.max(...lats)];
  // A single pin (or all pins at one spot) has zero-size bounds, which
  // fitBounds would zoom into as far as maxZoom allows
  if (west === east && south === north) return { center: [west, south], zoom: 10 };
  return { bounds: [[west, south], [east, north]] };
}

// Keeps a fitted trip's edge pins clear of the floating controls: the trip
// switcher and help/admin buttons along the top, the zoom/home controls down
// the left side
const FIT_OPTIONS = { padding: { top: 80, bottom: 48, left: 72, right: 56 }, maxZoom: 12 };

export function flyToView(map, view) {
  if (!map || !view) return;
  if (view.bounds) map.fitBounds(view.bounds, FIT_OPTIONS);
  else map.flyTo({ center: view.center, zoom: view.zoom });
}

// MapLibre constructor options for starting at a view. With no view (a new
// trip without pins) it starts zoomed out over North America.
export function initialMapOptions(view) {
  if (view?.bounds) return { bounds: view.bounds, fitBoundsOptions: FIT_OPTIONS };
  if (view) return { center: view.center, zoom: view.zoom };
  return { center: [-85, 45], zoom: 3 };
}

// Fixed locale and UTC so the server render and client hydration agree, and
// a YYYY-MM-DD date never shifts a month across a timezone boundary
const monthYear = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const monthOnly = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" });

// "July 2026", "July – August 2026", or "December 2025 – January 2026".
// Month-level on purpose: it's a summary line, not an itinerary.
export function formatTripDates(trip) {
  const start = trip?.startDate ? new Date(`${trip.startDate}T00:00:00Z`) : null;
  const end = trip?.endDate ? new Date(`${trip.endDate}T00:00:00Z`) : null;
  if (!start && !end) return null;
  if (!start || !end) return monthYear.format(start ?? end);

  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  if (sameYear && start.getUTCMonth() === end.getUTCMonth()) return monthYear.format(start);
  if (sameYear) return `${monthOnly.format(start)} – ${monthYear.format(end)}`;
  return `${monthYear.format(start)} – ${monthYear.format(end)}`;
}

// First photo on any of the trip's pins, used as its card thumbnail in the
// trip chooser. Falls back to the legacy single `image` field.
export function tripCoverImage(pins = []) {
  for (const pin of pins) {
    const images = pin.images ?? (pin.image ? [pin.image] : []);
    const first = images.find(Boolean);
    if (first) return first;
  }
  return null;
}
