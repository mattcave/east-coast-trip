# UX improvements: Cave Family Road Trips

You're improving the usability of a road trip photo blog: a Next.js app with a MapLibre map, one trip per page (`/trips/<id>`), and pins that open a popup with photos and a short story. The work is split into four batches. Do them in order, and finish and verify each batch before you start the next.

**Out of scope: look and feel.** A creative director will redesign fonts, colours, marker and cluster styling, and the overall visual identity later. Build new UI with the patterns already in the app (Tailwind, white cards, gray text, the existing blue for links and buttons, lucide icons). Don't add a new visual language, fonts or palette.

## Before you start

- Read `AGENTS.md`. This Next.js version differs from what you may know, so check `node_modules/next/dist/docs/` before you write Next-specific code.
- Write plain JavaScript, not TypeScript.
- Comment any workaround or non-obvious handling with *why* it's there. The codebase already does this; match it.
- Add or extend Vitest tests for logic in `src/lib/` (ordering, view fitting, URL handling). Run `npm test` and `npm run lint` before you finish each batch.
- Check every UI change at three viewport sizes: **375×667** (iPhone SE), **390×844**, and **1440×900**.
- Headless Chromium has no WebGL by default, so the map won't render. Launch it with `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.

### Key files

| File | What it does |
|---|---|
| `src/components/TripMap.js` | Owns trip, pin and overlay state; renders everything else |
| `src/components/Map.js` | MapLibre setup, Supercluster clustering, marker rendering |
| `src/components/PinPopup.js` | Pin detail: photo carousel, story, Google Maps link |
| `src/components/Sheet.js` | Shared modal shell (bottom sheet on mobile, centered card on desktop) |
| `src/components/TripSummary.js`, `TripChooser.js`, `TripSwitcher.js` | Trip intro, trip list, top-left trip menu |
| `src/components/EditorModal.js` | Admin pin and trip editor |
| `src/lib/trips.js` | Home view, fly-to and date helpers |
| `data/pins/<tripId>.json`, `data/trips.json` | Data |

---

## Batch 1: Must do

### 1.1 Give the stops an order

Pins have no visit order today. The array order in `data/pins/east-coast-2026.json` isn't the route: the first entry is in New Brunswick, but the trip started in Ontario.

- Add an `order` integer to pins. It sets the stop sequence, and the owner will fill it in for every existing pin.
- Let the owner change the order in the admin pin list (drag to reorder, or up/down buttons), and save it through the existing pins API. A new pin goes to the end.
- Add an optional `date` field (`YYYY-MM-DD`), with a date input in the pin editor. It's only shown to visitors (see 2.2); it never affects the order.
- Put one sort function in `src/lib/` and use it everywhere: pins by `order`, then any pins without an `order` in file order. Cover it with tests, including pins with a missing or duplicate `order`.

### 1.2 Show the journey: stop numbers, Previous/Next

- **Don't draw a route line.** Straight lines between stops don't follow the roads (they cut across the Bay of Fundy, for example), and visitors read them as the route driven. There's no logged route, and a recreated or calculated one isn't worth building and maintaining. The stop numbers and Previous/Next carry the order.
- Show each stop's number on or beside its marker. Keep the marker visuals otherwise as they are.
- In the pin popup, add **Previous stop** and **Next stop** buttons, labelled with the neighbouring stop's name. Disable them at the ends.
- Moving to another stop updates the popup and eases the map to that stop.
- On desktop, **ArrowLeft/ArrowRight now step between stops.** Stepping through photos moves to the carousel buttons, swipe, and the full-screen viewer (1.6). Remove the carousel's current window-level arrow key handler so the two don't fight.
- Don't add swipe-to-change-stop on mobile. Swipe on the photo already changes photos, and two swipe gestures in one sheet will clash.

**Done when:** a visitor can open the first stop and step through the whole trip with Next only, and the map follows along.

### 1.3 Fit the opening view to the trip's stops

`tripHomeView` in `src/lib/trips.js` uses the trip's saved `view` (a fixed center and zoom) whenever one exists. That suits desktop, but on a 390px phone it misses about 30 of the 44 stops (all of Nova Scotia, PEI and Cape Breton).

- When a trip has pins, fit the view to the pins' bounds, padded so markers don't sit under the trip menu or map controls. Use this for the first load, the Home button and switching trips.
- Use the saved `view` only for trips with no pins.
- Update the tests in `src/lib/trips.test.js`.

**Done when:** every stop is on screen when the trip page loads at all three viewport sizes.

### 1.4 Make the mobile pin sheet fit and scroll

On mobile, `PinPopup`'s panel has `overflow-hidden` and no max height. At 375×667, the Alexander Graham Bell Museum stop (3 photos, a long story) is 726px tall. Its top 58px, including the drag handle and the top of the photo, go off the top of the screen, and the sheet doesn't scroll.

- Cap the sheet at about 85vh (use `dvh` so mobile browser toolbars are allowed for) and let it scroll.
- Keep the stop title, close button and Previous/Next controls visible while the story scrolls (a sticky header or footer).
- Check `Sheet.js` too, so the trip summary and trip chooser behave the same way.

**Done when:** the Bell Museum stop is fully reachable at 375×667, and the close button never leaves the screen.

### 1.5 On desktop, show the stop in a side panel and keep the pin visible

The centered card and dimmed backdrop cover the pin the visitor just clicked.

- From the `sm` breakpoint up, show the stop in a panel docked to the right edge, full height, with its own scrolling. Keep the bottom sheet on mobile.
- Don't dim the map behind the panel. Clicking the map or pressing Escape closes the panel.
- When a stop opens, ease the map so the stop sits in the visible area left of the panel (use MapLibre's `padding` option).
- Highlight the selected marker (for example, scale it up and raise it above the others) so it's obvious which pin the panel is about. Keep the highlight subtle; final styling comes later.

### 1.6 Full-screen photo viewer

The photo frame is 208px tall on mobile, and portrait photos shrink to a narrow strip.

- Tapping or clicking a photo opens it full screen on a dark background, at that photo's position in the set.
- Support swipe on touch and arrow keys plus on-screen buttons on desktop to move between photos, and a "2 / 3" counter. Pinch-to-zoom is out of scope for now (see "Later, maybe" at the end).
- Close with an X button, Escape, or swipe down on touch. Closing returns to the popup at the same photo.
- Use `object-contain` so photos are never cropped. If you use a library, keep it small; a hand-rolled viewer is fine too.

### 1.7 Make clusters easier to open

At the trip's opening zoom, 39 of 44 stops are inside anonymous clusters, and some take two or three clicks to open.

- Lower `CLUSTER_RADIUS` in `Map.js` (try 25–30) and check the trip at the 1.3 opening view.
- When a cluster has 6 or fewer stops, clicking it shows a small list of those stops (number, name, category icon), anchored to the cluster. Picking one opens that stop. Larger clusters keep the current zoom-in behaviour.
- Don't change how clusters look; that's for the creative director.

---

## Batch 2: Nice to do (finding stops)

### 2.1 Stops list

- Add a "Stops" button near the trip menu. It opens a list of every stop in order, showing the number, name, category icon, date (when set) and a camera icon when the stop has photos.
- Use a bottom sheet on mobile, and the same right-hand panel as 1.5 on desktop.
- Selecting a stop eases the map to it and opens its popup.
- A text filter at the top is a bonus.

### 2.2 Context line and photo count in the popup

- Above the title, show "Stop 12 of 44 · Camping · July 14". Leave the date out when the stop has none.
- Show a "1 / 3" counter on the carousel alongside the dots.

### 2.3 Show which stops have photos

22 of the 44 stops have photos, but every marker looks the same. Add a small, neutral camera badge on markers for stops with photos. The creative director may restyle it later.

### 2.4 Category filter chips

Add chips for the categories in `src/lib/icons.js` (only categories the trip uses). They filter markers and double as a legend for the marker colours. Remember the selection while the visitor stays on the trip; it doesn't need to persist.

---

## Batch 3: Nice to do (sharing and accurate content)

### 3.1 Links to single stops

- Opening a stop adds `?stop=<pinId>` to the URL with `router.replace`, so it doesn't flood the browser history. Closing the stop removes it.
- Loading a URL with `?stop=` skips the trip summary, eases to that stop and opens it. An unknown id is ignored.
- Add a "Copy link" button in the popup, with a short confirmation.

### 3.2 Make the trip summary match the content

`TripSummary.js` claims "Every stop has our own photos" (22 of 44 do) and "Most pins link out to Wikipedia" (0 of 44 do).

- Show the photo line only if at least half the stops have photos, and reword it to "Lots of stops have…".
- Show the Wikipedia line only if at least one stop links to Wikipedia.
- Work these out from the trip's pins; don't hard-code them.

---

## Batch 4: Accessibility and polish (required, do last)

### Accessibility

- Render markers and clusters as `<button>` elements with an accessible name ("Stop 12: Peggy's Cove, Beach" / "Cluster of 4 stops"), reachable by keyboard and with visible focus.
- Give the pin popup, side panel, stops list and photo viewer `role="dialog"` and an accessible name. Keep focus inside the bottom sheet and the photo viewer while they're open, and send focus back to the element that opened them when they close.
- Give every icon-only button an `aria-label`. The `PinPopup` close button has none today.
- Don't override focus rings. `globals.css` removes the outline on the MapLibre popup close button; check that it still applies, and remove the rule if it doesn't.
- Respect `prefers-reduced-motion`: jump instead of fly or ease, and turn off smooth scrolling in the carousel.

### Polish

- When the trip menu is open, a sliver of the zoom control shows at its left edge. Stop the menu from overlapping the controls.
- Turn on MapLibre's compact attribution on mobile. The full credits wrap to two lines across the bottom of the screen.
- On touch devices, hide the zoom buttons (people pinch) and turn off map rotation, then remove the compass button.
- On the 404 page (`src/app/not-found.js`), the trip button looks like a text box. Make it clearly a link, for example with an arrow.
- Fix "View on Google Maps": `googleMapsUrl` in `PinPopup.js` reads `Map.mapRef`, which is never set, so it always uses zoom 14. Pass the real zoom from `TripMap`'s `mapRef`, or drop the zoom and fix the comment.

---

## Agreed changes to the plan

These override the batch descriptions above where they differ.

- **Stop order data.** The owner fills in `order` for the East Coast pins in a local copy of `data/pins/east-coast-2026.json`, then copies that file to the server during the batch 1 deploy. Don't edit pins on prod between pulling the fixtures and that deploy, or the copy will overwrite those edits.
- **Saving the order.** Add a bulk endpoint (`PUT /api/trips/:tripId/pins/order`, body: the ordered list of pin ids) that renumbers `order` 1..n in one `mutatePins` call. PATCH ignores `order`, because the editor sends the whole pin and would otherwise write back a stale value. POST sets `order = max + 1` inside the same mutation. Validate `date` on POST and PATCH.
- **Admin ordering UI.** Up/down buttons plus a "move to position N" input. No drag-to-reorder.
- **Markers.** Before 1.5, rework `Map.js` to keep markers keyed by pin or cluster id and only add or remove the ones that change, instead of rebuilding all of them on every `moveend`. Render markers as `<button>`s from the start. Always draw the selected pin as its own marker, left out of clustering, so Previous/Next never lands on a stop hidden inside a cluster.
- **Map movement.** Use one helper for every fly/ease/fit. It respects `prefers-reduced-motion` and resets the map's `padding` when the side panel closes (MapLibre keeps padding passed to `easeTo`).
- **Keyboard.** Use one shared rule for Escape and the arrow keys: only the topmost layer (photo viewer, then panel or sheet, then menus) handles a key. Ignore keys while the admin editor is open.
- **Map clicks.** Closing the panel on a map click must not fire for marker clicks, and must be off during placement mode ("Pick on map").
- **Right-hand panel.** `TripMap` holds a single right-panel state (stop, stops list, or editor), so only one is open at a time.
- **`?stop=` URLs.** Use `window.history.replaceState`, not `router.replace`, so stepping between stops doesn't go to the server. Check whether `useSearchParams` in `TripMap` needs a Suspense boundary.
- **Accessibility.** Build dialog roles, accessible names, focus return and reduced motion into each new piece as it's built. Batch 4 then checks them and does the polish items.
- **Cluster list (1.7).** Use a custom element, not `maplibregl.Popup`, so the existing `.maplibregl-popup-*` rules in `globals.css` don't apply to it.
- **Filters and numbering.** Previous/Next steps through every stop even when a category filter is on. Stop numbers keep their trip order and never renumber.
- **Wikipedia line (3.2).** A pin "links to Wikipedia" when `wikipedia` is anything other than `"none"`: a `null` value looks up the nearest article automatically.
- **Saved trip view.** With 1.3, a trip's saved `view` only applies when it has no pins. Relabel or hide "Use current map view" in the trip form to say so.

## Later, maybe

- Pinch-to-zoom in the full-screen photo viewer. If it goes ahead, consider PhotoSwipe v5 rather than hand-rolling the pinch, swipe and swipe-down gesture handling.

## For each batch

1. Implement it, with tests for any new `src/lib` logic.
2. Run `npm test` and `npm run lint`.
3. Check the changes in a browser at 375×667, 390×844 and 1440×900, logged out and logged in as admin. The admin editor must still work, including "Pick on map".
4. Commit the batch with a message that lists what changed.
