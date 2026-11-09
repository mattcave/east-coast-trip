// Pin helpers that are safe to import from both server and client code (no
// fs access). Persistence lives in src/lib/store.js.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function hasOrder(pin) {
  return Number.isInteger(pin?.order);
}

// The one place stop order is decided: pins with an `order` first, ascending,
// then pins without one in their stored (file) order. Ties on `order` keep
// file order too, since Array.prototype.sort is stable - so a hand-edited
// file with duplicate numbers still produces a predictable sequence.
export function sortPins(pins = []) {
  return [...pins].sort((a, b) => {
    const aHas = hasOrder(a);
    const bHas = hasOrder(b);
    if (aHas && bHas) return a.order - b.order;
    if (aHas) return -1;
    if (bHas) return 1;
    return 0;
  });
}

// The `order` a new pin gets so it lands at the end of the trip
export function nextOrder(pins = []) {
  const orders = pins.filter(hasOrder).map((p) => p.order);
  return orders.length ? Math.max(...orders) + 1 : pins.length + 1;
}

// Renumbers pins 1..n following orderedIds. Any pin the list leaves out
// (e.g. one added from another tab since the admin list was loaded) keeps
// its place after the listed ones, in sortPins order, rather than being
// dropped or left with a stale number. Unknown ids are ignored. Returns the
// pins in their original file positions so the diff of the data file only
// shows the changed numbers.
export function applyOrder(pins, orderedIds) {
  const byId = new Map(pins.map((p) => [p.id, p]));
  const listed = [...new Set(orderedIds)].filter((id) => byId.has(id));
  const listedSet = new Set(listed);
  const rest = sortPins(pins).filter((p) => !listedSet.has(p.id)).map((p) => p.id);
  const position = new Map([...listed, ...rest].map((id, i) => [id, i + 1]));
  return pins.map((p) => ({ ...p, order: position.get(p.id) }));
}

// Moves the item at `from` to `to` (both 0-based) and returns a new array.
// Out-of-range targets are clamped, so "move to position 99" means "last".
export function moveItem(list, from, to) {
  if (from < 0 || from >= list.length) return list;
  const target = Math.max(0, Math.min(list.length - 1, to));
  if (target === from) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}

// Validates the optional `date` field from a request body. Returns
// { date } (null clears it), { error }, or {} when the body doesn't mention
// date at all, so PATCH leaves an existing date alone.
export function sanitizePinDate(body) {
  if (!body || !("date" in body)) return {};
  const { date } = body;
  if (date === null || date === "") return { date: null };
  if (typeof date !== "string" || !DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    return { error: "date must be a YYYY-MM-DD date" };
  }
  return { date };
}

// "July 14". UTC and a fixed locale for the same reason as formatTripDates:
// server and client renders agree, and the day never shifts across a
// timezone boundary.
const dayMonth = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" });

export function formatPinDate(date) {
  if (!date || !DATE_RE.test(date)) return null;
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : dayMonth.format(d);
}

// Every photo on a pin, falling back to the legacy single `image` field
export function pinImages(pin) {
  return pin?.images ?? (pin?.image ? [pin.image] : []);
}

// Lowercased with accents stripped, so "cheticamp" finds "Chéticamp"
function foldForSearch(text) {
  return String(text ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Text filter for the stops list: every word in the query has to appear in
// the stop's name, in any order. A blank query matches everything.
export function matchesStopQuery(pin, query) {
  const words = foldForSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const label = foldForSearch(pin?.label);
  return words.every((w) => label.includes(w));
}

// A pin shows a Wikipedia summary unless it's switched off: `null` looks up
// the nearest article automatically, a URL shows that article
export function pinLinksToWikipedia(pin) {
  return Boolean(pin) && pin.wikipedia !== "none";
}

// Which of the trip summary's claims are true for these pins, worked out
// from the content so the summary can't overpromise. The photo line needs at
// least half the stops to have photos; the Wikipedia line needs one stop.
export function tripSummaryFacts(pins = []) {
  const withPhotos = pins.filter((p) => pinImages(p).length > 0).length;
  return {
    photos: pins.length > 0 && withPhotos * 2 >= pins.length,
    wikipedia: pins.some(pinLinksToWikipedia),
  };
}

// Links to a single stop look like /trips/<trip>?stop=<pinId>
export const STOP_PARAM = "stop";

// The pin id in a `?stop=` query string, if it's one of these stops.
// Anything else (missing, unknown, another trip's pin) gives null.
export function stopIdFromSearch(search, stops = []) {
  const id = new URLSearchParams(search ?? "").get(STOP_PARAM);
  return id && stops.some((p) => p.id === id) ? id : null;
}

// The query string with `?stop=` set to stopId, or removed when stopId is
// null. Other params are kept. Returns "" or a string starting with "?".
export function searchWithStop(search, stopId) {
  const params = new URLSearchParams(search ?? "");
  if (stopId) params.set(STOP_PARAM, stopId);
  else params.delete(STOP_PARAM);
  const query = params.toString();
  return query ? `?${query}` : "";
}
