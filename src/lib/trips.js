// Trip helpers that are safe to import from both server and client code (no
// fs access). Persistence lives in src/lib/store.js.

export const SITE_NAME = "Cave Family Road Trips";
export const SITE_DESCRIPTION = "Our family road trips, pinned on a map with photos and stories from every stop";

// The public address, used to turn link-preview image paths into the full
// URLs that messaging apps and social sites need. SITE_URL overrides it for
// another deployment.
export const SITE_URL = process.env.SITE_URL || "https://roadtrip.home.ma.ttcave.ca";

// Open Graph fields every page shares. A page that sets its own openGraph
// replaces the parent's object rather than merging into it, so trip pages
// spread this in to keep the site name and type.
export const BASE_OPEN_GRAPH = { siteName: SITE_NAME, type: "website", locale: "en_CA" };

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

// The view the map flies to for a trip: fit all of the trip's pins, so every
// stop is on screen whatever the screen size. A fixed center and zoom saved
// in the admin panel only suits the screen it was saved on (on a phone the
// East Coast trip's saved view missed most of Nova Scotia), so it's only
// used for a trip with no pins yet. Returns { center, zoom }, { bounds }, or
// null for a trip with no pins and no saved view.
export function tripHomeView(trip, pins = []) {
  const coords = pins.map((p) => p.lngLat).filter((c) => Array.isArray(c) && c.length === 2);
  if (coords.length === 0) {
    return trip?.view ? { center: trip.view.center, zoom: trip.view.zoom } : null;
  }

  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  const [west, east] = [Math.min(...lngs), Math.max(...lngs)];
  const [south, north] = [Math.min(...lats), Math.max(...lats)];
  // A single pin (or all pins at one spot) has zero-size bounds, which
  // fitBounds would zoom into as far as maxZoom allows
  if (west === east && south === north) return { center: [west, south], zoom: 10 };
  return { bounds: [[west, south], [east, north]] };
}

// The pin-free view behind the trip chooser at the site root: fits every
// trip's pins, plus the saved view centre of any trip that has no pins yet,
// so the backdrop hints at where the trips are without showing one of them.
export function overviewHomeView(trips, pinsByTrip) {
  const points = [];
  for (const trip of trips) {
    const pins = pinsByTrip[trip.id] ?? [];
    if (pins.length > 0) points.push(...pins);
    else if (trip.view) points.push({ lngLat: trip.view.center });
  }
  return tripHomeView(null, points);
}

// Keeps a fitted trip's edge pins clear of the floating controls: the trip
// switcher, Stops button and category chips (two rows) and the help/admin
// button along the top, the zoom/home controls down the left side
const FIT_OPTIONS = { padding: { top: 104, bottom: 48, left: 72, right: 56 }, maxZoom: 12 };
const NO_INSET = { top: 0, right: 0, bottom: 0, left: 0 };

// Visitors who ask the OS for less motion get instant jumps instead of
// flights and eases. Read at call time, so changing the setting applies
// without a reload.
export function prefersReducedMotion() {
  return typeof window !== "undefined"
    && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

// The padding for a fit into the part of the map a panel leaves uncovered.
// Sides the panel covers get its inset plus `gap` (room for a marker along
// that edge); the other sides keep FIT_OPTIONS' room for the floating
// controls. A bottom sheet's inset also has a top (the top bar).
function insetPadding(inset, gap) {
  const i = { ...NO_INSET, ...inset };
  const base = FIT_OPTIONS.padding;
  return {
    top: i.top ? i.top + gap.top : base.top,
    bottom: i.bottom ? i.bottom + gap.bottom : base.bottom,
    left: base.left + i.left,
    right: base.right + i.right,
  };
}

// Whether a padding leaves at least `room` px of map to fit into. MapLibre
// refuses a fit whose padding is bigger than the map, and leaves the view
// where it was.
function leavesRoom(map, padding, room) {
  const canvas = map.getCanvas?.();
  const width = canvas?.clientWidth ?? Infinity;
  const height = canvas?.clientHeight ?? Infinity;
  return padding.left + padding.right + room <= width && padding.top + padding.bottom + room <= height;
}

// MapLibre keeps padding from an earlier easeTo and adds it to a later fit,
// which would squeeze the fit into a corner. Clearing it with setMapInset
// doesn't visibly move the map.
function clearMapInset(map) {
  const current = map.getPadding?.();
  if (current && Object.values(current).some((v) => v > 0)) setMapInset(map);
}

// Every camera move in the app goes through flyToView, fitToStops or
// easeToPoint, so reduced motion is handled in one place.
//
// `inset` fits the view into part of the map: the strip above a mobile
// sheet that covers the bottom of it, or left of a docked panel
// ({ top, right, bottom, left } in px, measured by the caller). Without it
// the view fits the whole map.
export function flyToView(map, view, { inset } = {}) {
  if (!map || !view) return;
  const animate = !prefersReducedMotion();
  clearMapInset(map);
  // An inset that leaves too little map to fit anything into (a tall sheet
  // on a short phone) is dropped, and the view fits the whole map instead
  if (inset && !leavesRoom(map, insetPadding(inset, { top: 16, bottom: 24 }), 80)) inset = undefined;
  if (view.bounds) {
    const padding = inset ? insetPadding(inset, { top: 16, bottom: 24 }) : FIT_OPTIONS.padding;
    map.fitBounds(view.bounds, { ...FIT_OPTIONS, padding, animate });
    return;
  }
  // A single spot: padding moves the centre into the uncovered strip. It's
  // always passed, so a fit without an inset clears an earlier one.
  const options = { center: view.center, zoom: view.zoom, padding: { ...NO_INSET, ...inset } };
  if (animate) map.flyTo(options);
  else map.jumpTo(options);
}

// Zoom cap when fitting an open stop and its neighbours: two stops at the
// same campground would otherwise zoom in to street level
const STOP_FIT_MAX_ZOOM = 12;

// Fits the open stop and its neighbours (`points`, the open stop first) into
// the part of the map the panel or sheet leaves uncovered. The gap at the
// top and bottom is a little more than half the enlarged selected marker,
// so a stop at the edge isn't clipped by the top bar or the sheet. When
// the panel leaves too little map for a fit (the sheet dragged up on a
// short phone), the open stop is centred in what's left instead.
export function fitToStops(map, points, { inset } = {}) {
  const valid = (points ?? []).filter((p) => Array.isArray(p) && p.length === 2);
  if (!map || valid.length === 0) return;
  const padding = insetPadding(inset, { top: 24, bottom: 32 });
  if (!leavesRoom(map, padding, 40)) {
    easeToPoint(map, valid[0], { inset: { ...NO_INSET, ...inset } });
    return;
  }
  clearMapInset(map);
  const lngs = valid.map((p) => p[0]);
  const lats = valid.map((p) => p[1]);
  const bounds = [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
  // fitBounds flies, and a flight's length grows with the distance, so a
  // long hop between stops could take a few seconds; capped so stepping
  // through the trip stays brisk
  map.fitBounds(bounds, { padding, maxZoom: STOP_FIT_MAX_ZOOM, maxDuration: 1200, animate: !prefersReducedMotion() });
}

// Centres a point in the part of the map that isn't covered by a panel.
// `inset` is the map padding ({ top, right, bottom, left }) for the panel;
// omit it to keep the current padding. `zoom` is optional.

export function easeToPoint(map, lngLat, { inset, zoom } = {}) {
  if (!map || !lngLat) return;
  const options = { center: lngLat };
  if (inset) options.padding = inset;
  if (zoom !== undefined) options.zoom = zoom;
  if (prefersReducedMotion()) map.jumpTo(options);
  else map.easeTo(options);
}

// Changes the map's padding without visibly moving the map. MapLibre keeps
// padding passed to easeTo/flyTo and adds it to every later fitBounds, so
// once a panel closes its padding has to be cleared, or the Home button and
// trip switches would keep fitting into the left of the screen. Clearing it
// with a plain setPadding would also shift the picture sideways by half the
// panel width; picking the new centre from what's on screen avoids that.
export function setMapInset(map, inset = NO_INSET) {
  if (!map) return;
  const next = { ...NO_INSET, ...inset };
  const canvas = map.getCanvas();
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const x = next.left + (width - next.left - next.right) / 2;
  const y = next.top + (height - next.top - next.bottom) / 2;
  map.jumpTo({ center: map.unproject([x, y]), padding: next });
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

const SHORT_MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const parseDay = (date) => {
  if (!date || !DATE_RE.test(date)) return null;
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};
// "Sept" is what en-GB gives for September; the facts line wants "Sep"
const shortMonth = (d) => SHORT_MONTH.format(d).slice(0, 3);

// The dates in a trip's facts line, by the day: "14–31 Aug 2026" within a
// month, "28 Jul – 3 Aug 2026" across months, "28 Dec 2025 – 3 Jan 2026"
// across years. With only one date (usually a planned trip with just a
// start), the month and year: "Aug 2026". Null with neither. UTC, for the
// same reason as formatTripDates.
export function formatTripDayRange(trip) {
  const start = parseDay(trip?.startDate);
  const end = parseDay(trip?.endDate);
  if (!start && !end) return null;
  if (!start || !end) {
    const only = start ?? end;
    return `${shortMonth(only)} ${only.getUTCFullYear()}`;
  }
  const [sd, sm, sy] = [start.getUTCDate(), shortMonth(start), start.getUTCFullYear()];
  const [ed, em, ey] = [end.getUTCDate(), shortMonth(end), end.getUTCFullYear()];
  if (sy !== ey) return `${sd} ${sm} ${sy} – ${ed} ${em} ${ey}`;
  if (sm !== em) return `${sd} ${sm} – ${ed} ${em} ${ey}`;
  if (sd === ed) return `${sd} ${sm} ${sy}`;
  return `${sd}–${ed} ${sm} ${sy}`;
}

// How many days a trip lasted, counting both the first and last day
// (14 to 31 August is 18 days). Null unless both dates are set and in order.
export function tripDayCount(trip) {
  const start = parseDay(trip?.startDate);
  const end = parseDay(trip?.endDate);
  if (!start || !end || end < start) return null;
  return Math.round((end - start) / 86400000) + 1;
}

// The tag on a trip that has no stops yet, in place of its facts line:
// "Planned", plus the year once a start date is set ("Planned · 2027")
export function plannedTripTag(trip) {
  const start = parseDay(trip?.startDate);
  return start ? `Planned · ${start.getUTCFullYear()}` : "Planned";
}

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
