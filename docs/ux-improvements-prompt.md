# UX improvements: Cave Family Road Trips

You're improving the usability of a road trip photo blog: a Next.js app with a MapLibre map, one trip per page (`/trips/<id>`), and pins that open a popup with photos and a short story. The work is split into eight batches; batch 5 holds fixes from reviewing batches 1–4, batch 6 is the look-and-feel pass, batch 7 holds every content and copy change, and batch 8 holds fixes and new touches from reviewing batches 5–7. Do them in order, and finish and verify each batch before you start the next.

**Look and feel is batch 6.** Until you reach it, build new UI with the patterns already in the app (Tailwind, white cards, gray text, the existing blue for links and buttons, lucide icons). Batch 6 then sets the fonts, colours, and marker and cluster styling for the whole app.

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

## Batch 5: Fixes from the design review (do next)

Batches 1–4 were reviewed in a browser at 375×667 and 1440×900. Everything in them works except the items below. 5.1 is a must do; the rest should be done in this batch too.

### 5.1 On mobile, keep the open stop visible (must do)

When a stop opens on a phone, its marker is hidden. The sheet starts at y=100 on a 667px screen, so only 100px of map shows, and the trip menu, Stops button and chips row fill it. The map behind is dimmed as well. Deep links (`?stop=`), picking from the stops list, and Previous/Next all hit this: stop 12 lands at y=50, under the top bar.

- Open the sheet at about 55dvh, not 85dvh. The story scrolls inside it as now, and the header and Previous/Next footer stay sticky. Dragging the handle up expands it to about 85dvh, and dragging down returns it to 55dvh. Swiping down from 55dvh closes it.
- While a stop sheet is open on mobile, hide the chips row. Keep the trip menu and Stops button.
- Ease the map so the stop sits in the middle of the map strip that's visible between the top bar and the sheet. Set the map `padding` from the sheet's measured height and the top bar's height; don't use fixed numbers. Reset it when the sheet closes, using the map-movement helper.
- Drop the dim on mobile. Tapping the visible map still closes the sheet.
- Done when: at 375×667 and 390×844, stepping through all 45 stops with Next (and opening one from a `?stop=` link) leaves the selected marker on screen and not covered (`document.elementFromPoint` at its centre returns the marker).

### 5.2 Google Maps link opens at the trip's zoom level

Batch 4 passed the map's current zoom to "View on Google Maps". At the trip-wide view, that's zoom 3 on a phone and zoom 6 on desktop, so the link opens on half a continent. Use `Math.max(currentZoom, 15)`, so the link always opens close enough to see the place.

### 5.3 Tell cluster counts apart from stop numbers

Cluster circles ("7") and stop number badges ("8") look alike, so a cluster reads as a stop. When a cluster's stops are consecutive in trip order, label it with the range ("5–7"), and name it "Stops 5 to 7" for screen readers. Otherwise keep the count. This item is only about the label; 6.5 changes how clusters look.

### 5.4 Cluster list: don't hide the cluster, don't cut off names

`ClusterList.js` truncates names at about 20 characters, so "Camping Republique Edmundston" and "The Blockhouse Edmundston" lose the word that tells them apart. The list also covers the cluster it came from.

- Widen it to about 320px (staying inside the viewport), and let names wrap to two lines instead of truncating.
- Place it beside the cluster (to the right, or left near the right edge) rather than over it.

### 5.5 (Moved to 7.2)

Renaming the default category moved to batch 7 with the other copy changes.

### 5.6 Show that the chips row scrolls on mobile

At 375px the chips row ends at "Food". Nature, Beach, Activity, Attraction and the default category are off screen, and nothing shows the row scrolls. Fade the right edge while there's more to scroll, using the existing white.

---

## Batch 6: Look and feel (after batch 5)

After batch 4, the app was reviewed at 1440×900 and 390×844. The structure works, but the app looks like a generic admin tool: Arial, Tailwind blue, white cards, and markers that are hard to read. For a family photo blog, this batch makes the photos lead, sets the stories in a serif, adds a coastal palette, and makes markers readable at a glance. 6.1 is a must do and a bug, so do it first. Do the rest in order.

### 6.1 On mobile, fit the trip above the intro sheet (must do)

At 390×844, `/trips/east-coast-2026` opens centred on Labrador. The trip intro sheet covers the bottom of the screen, and every stop is behind it (Toronto sits at about y=480, under the sheet). 1.3 fits the pins to the whole screen, not to the part a visitor can see.

- While the trip summary or the trip chooser sheet is open on mobile, fit the pins into the map area above the sheet. Use the same measured padding as 5.1 (sheet height plus top bar), not fixed numbers.
- When the sheet closes, fit again without the sheet padding, using the map-movement helper.
- Done when: at 375×667 and 390×844, every stop is on screen above the intro sheet when the trip loads, and still on screen after the sheet closes.

### 6.2 Fonts

- `globals.css` sets `font-family: Arial, Helvetica, sans-serif` on `body`. Because of that, the Geist font loaded in `layout.js` is never used. Remove the rule, so UI text uses Tailwind's `font-sans` (Geist).
- Add **Newsreader** with `next/font/google` as `--font-serif`, with a `font-serif` Tailwind theme entry. Use it for the site title, trip names (chooser cards and trip intro), stop titles, and story text. The trip menu button stays sans.
- Story text: Newsreader 18px with 1.6 line height on desktop, 17px on mobile, in the ink colour (6.3), not gray.
- Stop title: Newsreader semibold, 26px on desktop and 22px on mobile, 1.15 line height.
- Keep Geist for the context line ("Stop 10 of 45 · Attraction"), buttons, chips, lists, the photo counter and the admin editor.

### 6.3 Colours

Add these tokens to `@theme` in `globals.css`. Use them in place of Tailwind grays and `blue-600` in every visitor-facing component. The admin editor can keep its current styling.

| Token | Value | Use |
|---|---|---|
| `--color-ink` | `#1f2a2e` | Headings, story text, cluster rings and counts |
| `--color-muted` | `#5b6b70` | Context line, facts line, secondary text |
| `--color-paper` | `#fbf8f3` | Background of the side panel, sheets, trip chooser and stops list |
| `--color-line` | `#e7e1d8` | Dividers and card borders |
| `--color-accent` | `#1f6f6b` | Primary buttons (white text), links, focus and selection rings |
| `--color-accent-hover` | `#185955` | Hover state for buttons and links |

All the text pairs meet WCAG AA: accent on paper is 5.6:1, and muted on paper is 5.2:1. Don't use purple or violet anywhere.

### 6.4 Category colours

Several of the current colours are too close to tell apart on the map (Food and Attraction, Home and Activity, Beach and the default), and Landmark is purple. Replace the colours in `PIN_ICONS` (`src/lib/icons.js`):

| Category | Colour |
|---|---|
| Home | `#a86a12` gold |
| Landmark | `#9f3a22` brick |
| Camping | `#23523b` pine |
| Food | `#e0662b` orange |
| Nature | `#5b9a2e` leaf |
| Wildlife | `#5b9a2e` leaf (same as Nature; the icon tells them apart) |
| Beach | `#1d74b0` ocean |
| Activity | `#0e8a87` teal |
| Attraction | `#d6336c` raspberry |
| Other (default, see 7.2) | `#64748b` slate |

Every colour gives at least 3:1 contrast with the white marker icon. The chip dots use the same values.

### 6.5 Markers, clusters and stop numbers

This builds on 5.3 (cluster range labels). The goal: a dark circle with a number always means a stop number, and a cluster never looks like a stop.

- **Clusters:** a paper circle with a 2px ink ring and the count (or range) in Geist semibold ink. Keep all clusters the same size, as agreed in the batch 1 follow-ups.
- **Stop numbers:** keep the small dark badge at the marker's top right. Use the ink colour for it.
- **Photo badge:** remove the separate camera badge. A marker on a stop with photos now gets a 2px white outer ring and a soft shadow, so it looks like a small print. Stops without photos get no ring. Keep "has photos" in the marker's accessible name. The stops list keeps its camera icon.
- **Selected marker:** scale it to 1.25, with a 3px accent outer ring. This replaces the 1.5 highlight.
- Done when: at the trip's opening view at 390×844, a visitor can tell clusters from stops without reading the numbers, and no stop has more than one badge.

### 6.6 Photo-first stop panel

- Widen the desktop side panel from its current width to **520px**, and update the map padding to match.
- Make the photo frame the full width of the panel at 4:3, with `object-cover`. The full-screen viewer keeps `object-contain`.
- Remove the carousel dots and keep the "1 / 3" counter. This replaces 2.2's "alongside the dots". On desktop, when a stop has 2 or more photos, show a row of thumbnails under the photo: 56px squares with an 8px gap, an accent ring on the current one, and a click that selects that photo. On mobile, keep the counter and swipe.
- The photo is the button that opens the viewer. On desktop it shows a `zoom-in` cursor, and on hover the image scales to 1.03 inside its frame (overflow hidden, 300ms ease).

### 6.7 Landing page and trip intro

**Root page (`/`):**

- Draw every trip's stops on the overview map as small dots: 6px, muted colour, 70% opacity, not clickable. This keeps the map from being empty behind the chooser. Fit the view to all of them, above the sheet on mobile as in 6.1.
- Trip chooser cards: put the cover photo on top, full card width at 16:9 (use the photo the card uses now). Below it, show the trip name in Newsreader at 20px, then a facts line (`14–31 Aug 2026 · 45 stops`), then the description. Build the date with one helper in `src/lib/` (with tests). With both dates, show the day range: `14–31 Aug 2026` within a month, `28 Jul – 3 Aug 2026` across months, and include both years when they differ. With only `startDate`, show the month and year (`Aug 2026`). With neither, leave the date out.
- A trip with no pins shows no stop count and no map-icon tile. Make it a text-only card with a small tag in place of the facts line (the tag's wording is in 7.2).

**Trip intro (`TripSummary.js`):**

- Put the trip's cover photo (the same one as its chooser card) at the top, edge to edge, at 16:9.
- Below it, show the trip name, a facts line (`14–31 Aug 2026 · 45 stops · 22 with photos`), and the intro text in Newsreader.
- Add a primary button that closes the intro and opens the first stop in trip order, and a secondary text button that just closes the intro. Keep the link to the other trips when there's more than one trip. The button labels, and what the intro stops saying, are in 7.1.

### 6.8 Hover and press

- Buttons: darken the background on hover, and scale to 0.98 while pressed (120ms).
- Trip chooser cards: lift 2px and deepen the shadow on hover.
- Text links: underline on hover.
- Markers: scale to 1.1 on hover, unless the marker is already selected.
- On desktop, hovering "Previous stop" or "Next stop" puts that stop's marker in its hover state, so the visitor sees where they're going before they click.
- With `prefers-reduced-motion`, keep the colour changes and drop all scaling and movement.
- Don't add fade-ins on load or scroll, parallax, or any other motion.

**Done when (batch 6):** screenshots of `/`, the trip intro, an open stop with 3 photos, and the stops list at 375×667, 390×844 and 1440×900 show the new fonts, colours and markers. Nothing overlaps, every text pair meets AA, and the admin editor still works.

---

## Batch 7: Content and copy (after batch 6)

Every change to wording, in the app and in the trip data, is in this batch, so it can all be reviewed in one pass. 7.1 and 7.2 change text in the code and are dev work. 7.3 lists data the owner enters in the admin editor on the live site. Don't edit `data/trips.json` or the pins files for 7.3: the live site's data is newer, and a copied file would overwrite it.

### 7.1 Trip intro wording (dev)

- Remove the "Tap any pin…" and Wikipedia rows from `TripSummary.js`; the first stop shows how the app works. This replaces 3.2's conditional lines, so remove that logic too.
- Label the primary button (from 6.7) **"Start at stop 1"**, and the secondary text button **"Browse the map"**. Keep "See our other trips" as it is.

### 7.2 Labels (dev)

- **Default category:** it shows as a "Pin" filter chip and as "Pin" in marker names and the stops list. Label it **"Other"**. (This was 5.5.)
- **Planned trips:** the tag on a trip with no pins (6.7) reads **"Planned"**, plus **"· 2027"** (the year) when `startDate` is set.

### 7.3 Content the owner enters (not dev work)

Build every screen so it works without these; don't add placeholder dates or text.

- **East Coast trip dates:** 2026-08-14 to 2026-08-31, in the trip editor.
- **East Coast intro:** it says "this summer", which will date. Suggested wording: "We piled into our trusty motorhome, Fernando, and drove from Ontario to Nova Scotia in August 2026. Every place we stopped is pinned right where the memory happened."
- **Stop dates:** none of the 45 stops has a `date` yet. They can be worked out from the original phone photos' dates and locations once those are on the Mac; until then they stay empty.
- **Stop 45, "Bathurst":** it has no story, no photos and the default category. Give it a story and a category, or delete it.
- **Georgian Bay trip:** set `startDate` once a year is chosen, so its tag shows the year.

**Done when (batch 7):** the intro, chips, stops list and chooser show the new wording at 375×667 and 1440×900, and they still read well when the trip dates, stop dates and cover photo are missing.

---

## Batch 8: Fixes and new touches (after batch 7)

Batches 5–7 and the tablet follow-ups were reviewed in a browser at 1440×900, 1280×800, 1024×768 and 390×844 (touch). The look and feel landed well. 8.1–8.4 fix what doesn't work and are must do. 8.5 adds data that 8.6 and 8.7 need. 8.6–8.10 add new touches the owner chose. Do them in order.

The owner's content from 7.3 (trip dates, the "this summer" intro, stop dates) still isn't entered. Every item below must work without it.

### 8.1 Keep the open stop and its neighbours visible (must do)

Opening a stop never changes the zoom, so the map stays at the trip-wide view. Two things go wrong:

- **On a phone, the open stop piles up on its neighbours.** With stop 10 (Giant Axe) open at 390×844, its marker overlaps the Bathurst pin and the "27" and "5–9" clusters.
- **The 6.8 hover preview does nothing for most stops.** At that zoom, stops 11–44 are inside clusters, so hovering "Next stop: Rockwood Park Campground" can't highlight a marker that isn't drawn.

Fix:

- Draw the previous and next stops as their own markers, left out of clustering, the same way the selected stop already is.
- When a stop opens, or the visitor steps to another, fit the map to the selected stop and its neighbours. Stop 1 and the last stop have only one neighbour. Use the panel or sheet padding from 1.5 and 5.1, cap the zoom at 12, and go through the map-movement helper.
- Draw the selected marker above every other marker and cluster.
- Done when: at 1440×900, hovering Previous or Next on every stop highlights a marker that's on screen. At 390×844, stepping through all 45 stops leaves the selected marker uncovered (the 5.1 `elementFromPoint` check).

### 8.2 Stop the chips row running under the docked panel (must do)

At 1024×768 and 1280×800, the chips row runs under the docked stop panel. The row ends at x=777, so at 1024×768 (panel from x=624) "Attraction" and "Other" are cut off, and at 1280×800 (panel from x=760) "Other" is. At 1440×900 it clears the panel. While the panel is docked, end the row 16px left of the panel and apply the 5.6 fade at that edge.

### 8.3 Make touch targets at least 44px (must do)

At 390×844 these are too small to tap reliably:

| Control | Size now |
|---|---|
| Stop sheet close | 24×24 |
| Next photo arrow | 26×26 |
| Home (reset view) | 29×29 |
| Help | 36×36 |
| Trip menu and Stops buttons | 38px tall |

On touch devices, give each one a hit area of at least 44×44. The icon or visible button can stay its current size, with padding making up the difference.

### 8.4 Keep the grab handle off the photo on the mobile intro (must do)

On the mobile trip intro, the grab handle is drawn on top of the cover photo, as a pale bar over a pale sky. Add a 20px paper strip above the photo and put the handle in it. Do the same on any other sheet that starts with a photo, including the stop sheet when it gets a postcard (8.6).

### 8.5 Store each stop's province or state

8.6 and 8.7 show where each stop is. Add an optional `region` field to pins, holding the full name ("New Brunswick", "Prince Edward Island", "New York").

- Fill it on the server with Mapbox reverse geocoding (`types=region`, with the existing `MAPBOX_TOKEN`). Do it when a pin is created, and when an edit changes its `lngLat`. If the lookup fails, save the pin without `region`.
- Existing pins: add an admin-only endpoint, `POST /api/trips/:tripId/pins/regions`, that fills `region` on every pin that doesn't have one, in a single `mutatePins` call. The owner runs it once on the live site after deploy. Don't backfill a local file and copy it to the server; see "Agreed changes" on the stop order data.
- Add tests with the Mapbox call mocked.

### 8.6 Postcards for stops without photos

23 of the 45 stops have no photos. Their panel is a title, a paragraph and mostly blank paper (on desktop, about 70% of Home or Notre-Dame-du-Cap Basilica is empty). Show a postcard where the photo frame would be:

- **The card:** 2:1 at all sizes, inset 20px from the panel edges, with a 1px line border. The ground is the paper colour with a 10% tint of the stop's category colour.
- **The stamp:** top right, a 72px square in the category colour with the category icon in white at 32px. Give it a perforated edge, for example with a CSS mask of small half-circles.
- **The postmark:** beside the stamp, a 64px circle with a 1.5px ink ring at 60% opacity. It holds the `region` (8.5) and, below it, the stop's date (`14 Aug 2026`), or "Stop 4" when there's no date. Leave the region out when it isn't set.
- **The text:** bottom left, the stop name in Newsreader at 28px (22px on mobile).
- Keep everything straight; nothing rotated.
- The postcard is decorative. Hide it from screen readers (`aria-hidden`), because the title and context line already carry the name and category.

### 8.7 A finish line after the last stop

On the last stop, "Next stop" is greyed out. Instead, label it **"The end of the trip"** and make it open a finish card in the same panel or sheet:

- **Heading:** "That's the trip" in Newsreader.
- **Facts:** "45 stops · 18 days" (days from the trip dates, inclusive; leave the days out when the dates aren't set). Below that, the regions in trip order, each listed once: "Ontario · Quebec · New Brunswick · Prince Edward Island · Nova Scotia".
- **Photo mosaic:** the first photo of each stop that has photos, in trip order, up to 12. Use square tiles in a 4-column grid on desktop and 3 columns on mobile, with an 8px gap. Tapping a tile opens that stop.
- **Buttons:** primary "Start again at stop 1", and a secondary text link, "See our other trips", when there's more than one trip.
- Previous on the finish card goes back to the last stop. The card doesn't need its own `?stop=` value.

### 8.8 A "Start at stop 1" button on the map

Picking a trip from the chooser skips the intro (on purpose; see commit `25b5d07`). So visitors who start at `/` never see "Start at stop 1", and land on a map of clusters with no obvious starting point.

- Add a floating pill button at the bottom centre of the map: accent background, white text, a play icon, and the label **"Start at stop 1"**. It opens stop 1.
- Once the visitor has opened any stop during this visit, the label changes to **"Back to stop N"**, the last stop they opened. Keep that in component state; don't persist it.
- Show it only when nothing else is open (no stop, stops list, intro, chooser or photo viewer). Keep it clear of the MapLibre attribution and the safe area at the bottom of the screen on mobile.
- Hover and press states follow 6.8.

### 8.9 Photo thumbnails and days in the Stops list

- Each row shows a 40px rounded-square thumbnail of the stop's first photo in place of the category icon circle. Stops without photos keep the category icon circle. Remove the camera icon at the end of the row, since the thumbnail now shows which stops have photos.
- When **every** stop in the trip has a `date`, group the list under day headings: **"Day 3 · Sun 16 Aug"**. The day number counts from the trip's `startDate`, or from the earliest stop date when the trip has none. Until then, keep the flat list, with dates inline as in 2.1.
- The filter box still works across the groups; hide a heading when none of its stops match.

### 8.10 A motorhome mark

The site has no mark, and the favicon is a red Canadian maple leaf.

- Draw a simple motorhome icon on lucide's 24px grid, with a 2px stroke and round caps, so it matches the other icons. It should be a small Class C motorhome: a cab with a bunk over it, a side window and two wheels. Use lucide's `Van` only if the drawing doesn't work at 16px.
- Show it in the accent colour before "Cave Family Road Trips" in the chooser heading, and before the trip name in the trip menu button.
- Use it as the favicon in place of `src/app/icon.svg`: the accent colour on a transparent background, checked at 16px and 32px.

**Done when (batch 8):** 8.1–8.4 pass their checks. Screenshots at 390×844, 1024×768 and 1440×900 show a postcard stop (Home), the finish card, the Start button on the map with nothing open, and the Stops list. All of them still work with no trip dates, no stop dates and no `region` values.

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
