"use client";

import { useState, useRef, useEffect, useMemo, useCallback, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import { Pencil, HelpCircle, List } from "lucide-react";
import Map from "./Map";
import GeoSearch from "./GeoSearch";
import EditorModal from "./EditorModal";
import PinPopup from "./PinPopup";
import TripSummary from "./TripSummary";
import TripChooser from "./TripChooser";
import TripSwitcher from "./TripSwitcher";
import StopsList from "./StopsList";
import CategoryChips from "./CategoryChips";
import { tripHomeView, overviewHomeView, flyToView, easeToPoint, setMapInset } from "@/lib/trips";
import { sortPins, stopIdFromSearch, searchWithStop } from "@/lib/pins";
import { tripCategories, filterPinsByCategory } from "@/lib/categories";

// Stable empty array so a trip without pins doesn't hand Map a new array
// (and rebuild its markers) on every render
const NO_PINS = [];

// Space kept between the top bar and a stop eased into the strip below it,
// so the enlarged selected marker and its number badge clear the bar
const TOP_BAR_GAP = 12;

// Two layout breakpoints. The stop panel and stops list are bottom sheets
// below 1024px (phones and portrait tablets; see SidePanel). The trip
// summary and chooser are bottom sheets only on phones, below 640px; on a
// tablet they're centred cards. Read with useSyncExternalStore so they
// follow rotation and resizing; the server render assumes desktop.
const SHEET_LAYOUT_QUERY = "(max-width: 1023px)";
const PHONE_QUERY = "(max-width: 639px)";
function useMediaQuery(query) {
  const subscribe = useCallback((callback) => {
    const list = window.matchMedia(query);
    list.addEventListener("change", callback);
    return () => list.removeEventListener("change", callback);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

// The map padding that keeps a point clear of an open panel, measured from
// the page rather than fixed numbers, since the sheet's height depends on
// the stop and the screen. Docked right (desktop, full height from the
// top): the panel's width.
// Bottom sheet (mobile): the sheet's height, plus the top bar (trip menu
// and Stops) along the top, so the stop lands in the middle of the strip
// of map that's actually visible between them.
function measurePanelInset(map, panel, topBar) {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  const rect = panel?.getBoundingClientRect();
  if (!map || !rect) return inset;
  const mapRect = map.getContainer().getBoundingClientRect();
  // A bottom sheet starts partway down; on a tablet it's also centred, so
  // its left edge alone doesn't tell the two layouts apart
  if (rect.top <= mapRect.top + 1) {
    inset.right = Math.round(mapRect.right - rect.left);
    return inset;
  }
  inset.bottom = Math.max(0, Math.round(mapRect.bottom - rect.top));
  const bar = topBar?.getBoundingClientRect();
  if (bar) inset.top = Math.max(0, Math.round(bar.bottom - mapRect.top) + TOP_BAR_GAP);
  return inset;
}

const insetChanged = (a, b) => ["top", "right", "bottom", "left"].some((k) => Math.abs(a[k] - b[k]) >= 4);

// Stands in for a trip id when tracking which view the map last flew to
const OVERVIEW = Symbol("overview");

// Trip summaries show once per trip per browser. The pre-multi-trip welcome
// modal stored a single flag; it counts as having seen the East Coast trip.
const summaryKey = (tripId) => `road-trips:summary-dismissed:${tripId}`;
const LEGACY_WELCOME_KEY = "east-coast-trip:welcome-dismissed";
const LEGACY_WELCOME_TRIP_ID = "east-coast-2026";

function isSummaryDismissed(tripId) {
  try {
    if (localStorage.getItem(summaryKey(tripId))) return true;
    return tripId === LEGACY_WELCOME_TRIP_ID && Boolean(localStorage.getItem(LEGACY_WELCOME_KEY));
  } catch {
    // localStorage unavailable (private browsing, etc.) - treat as unseen
    return false;
  }
}

function markSummaryDismissed(tripId) {
  try {
    localStorage.setItem(summaryKey(tripId), "1");
  } catch {
    // ignore - worst case the summary reappears next visit
  }
}

// Rendered once by the (map) layout and kept mounted across "/" and
// "/trips/[id]", so the current trip comes from the URL on every render
// rather than from props. Trips and pins are seeded from the server and then
// owned here, refreshed from the API after admin edits.
export default function TripMap({ initialTrips, initialDefaultTripId, initialPinsByTrip, isAuthenticated }) {
  const params = useParams();
  const routeTripId = params?.id ?? null;
  const isRoot = routeTripId === null;

  const [trips, setTrips] = useState(initialTrips);
  const [defaultTripId, setDefaultTripId] = useState(initialDefaultTripId);
  const [pinsByTrip, setPinsByTrip] = useState(initialPinsByTrip);
  // Trips deleted in this session from the admin panel. See isUnknownTrip.
  const [deletedTripIds, setDeletedTripIds] = useState([]);

  // "/" shows the default trip, as does a trip deleted in this session
  // while it's still in the URL (the admin panel navigates to "/" right
  // after, and the map shouldn't be torn down in between).
  const trip = trips.find((t) => t.id === routeTripId)
    ?? trips.find((t) => t.id === defaultTripId)
    ?? trips[0];
  const tripPins = pinsByTrip[trip.id] ?? NO_PINS;
  // The trip's stops in visit order, and each one's stop number. Everything
  // that shows or steps through stops uses these, never the raw file order.
  const stops = useMemo(() => (tripPins.length ? sortPins(tripPins) : NO_PINS), [tripPins]);
  const stopNumbers = useMemo(() => Object.fromEntries(stops.map((p, i) => [p.id, i + 1])), [stops]);

  // A /trips/<id> that never existed renders the site's 404 page (the trip
  // page calls notFound()). That page renders inside this layout, so the map
  // has to stand aside, or it would cover the 404 with the default trip and
  // its summary popup. Hooks below still run; the early return is at the end.
  const isUnknownTrip = routeTripId !== null
    && !trips.some((t) => t.id === routeTripId)
    && !deletedTripIds.includes(routeTripId);

  // Which popup covers the map: the trip chooser, a trip summary, or neither.
  // "/" opens the chooser on every visit, and that's known at render time,
  // so it's in the initial state and server-rendered. Whether a trip page
  // shows its summary depends on localStorage, which isn't available during
  // SSR, so that has to wait for an effect - reading it during render would
  // make the client's first render diverge from the server's and break
  // hydration. The effect (further down, after the per-trip state it also
  // sets) re-runs on client-side navigation between trips.
  const [overlay, setOverlay] = useState(isRoot ? "chooser" : null);

  // While the chooser is open at "/", no trip has been picked yet, so the
  // map shows a pin-free overview of where all the trips are rather than the
  // default trip. Closing the chooser without picking reveals the default
  // trip. (The chooser opened from a trip page leaves that trip showing.)
  const showOverview = isRoot && overlay === "chooser";
  const pins = showOverview ? NO_PINS : stops;
  const categories = useMemo(() => tripCategories(pins), [pins]);
  const homeView = useMemo(
    () => (showOverview ? overviewHomeView(trips, pinsByTrip) : tripHomeView(trip, tripPins)),
    [showOverview, trips, pinsByTrip, trip, tripPins]
  );
  const viewKey = showOverview ? OVERVIEW : trip.id;
  // Behind the chooser at "/": every trip's stops as small dots, so the map
  // isn't empty there (see Map's backgroundPoints)
  const backgroundPoints = useMemo(
    () => (showOverview
      ? Object.values(pinsByTrip).flat().map((p) => p.lngLat).filter((c) => Array.isArray(c) && c.length === 2)
      : null),
    [showOverview, pinsByTrip]
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [placementMode, setPlacementMode] = useState(false);
  const [editTargetId, setEditTargetId] = useState(null);
  // Held as an id, not a pin object, so an edited pin shows its new details
  // after the pins are refreshed
  const [selectedPinId, setSelectedPinId] = useState(null);
  const selectedIndex = selectedPinId ? stops.findIndex((p) => p.id === selectedPinId) : -1;
  const selectedPin = selectedIndex === -1 || showOverview ? null : stops[selectedIndex];
  const prevStop = selectedPin ? stops[selectedIndex - 1] ?? null : null;
  const nextStop = selectedPin ? stops[selectedIndex + 1] ?? null : null;
  // Owned here (not inside Map) so GeoSearch and the editor can call flyTo
  const mapRef = useRef(null);
  // The open panel (a stop or the stops list), measured to keep the stop
  // clear of it
  const panelRef = useRef(null);
  // The top bar (trip menu, Stops, chips), measured for the same reason
  const topBarRef = useRef(null);
  // The trip summary or chooser sheet, measured to fit the trip above it
  const sheetRef = useRef(null);
  // The stop whose marker is lit up while Previous/Next is hovered
  const [previewPinId, setPreviewPinId] = useState(null);
  const isSheetLayout = useMediaQuery(SHEET_LAYOUT_QUERY);
  const isPhone = useMediaQuery(PHONE_QUERY);
  // Only one thing uses the right-hand panel at a time: a stop, the stops
  // list, or the admin editor. Opening one closes the others.
  const [stopsListOpen, setStopsListOpen] = useState(false);
  // Whether the open stop was picked from the list, so it can offer a way back
  const [openedFromList, setOpenedFromList] = useState(false);
  // Selected category chips. Kept while the visitor stays on this trip,
  // dropped on a trip switch; not persisted.
  const [categoryFilter, setCategoryFilter] = useState(() => new Set());
  const mapPins = useMemo(
    () => filterPinsByCategory(pins, categoryFilter, selectedPinId),
    [pins, categoryFilter, selectedPinId]
  );

  // Stored callback from the form's "Pick on map" button.
  // Called with the picked lngLat when the user clicks the map.
  const onPickCallbackRef = useRef(null);
  const pickingPinIdRef = useRef(null);

  // Per-trip UI state is dropped when the trip changes. Done during render
  // (React's "adjust state when a prop changes" pattern) so the old trip's
  // popup never flashes over the new trip's pins.
  const [shownTripId, setShownTripId] = useState(trip.id);
  if (trip.id !== shownTripId) {
    setShownTripId(trip.id);
    setSelectedPinId(null);
    setStopsListOpen(false);
    setOpenedFromList(false);
    setCategoryFilter(new Set());
    setEditTargetId(null);
    setPlacementMode(false);
  }

  // Shows the trip summary or chooser on arrival (see `overlay` above).
  // Set while a stop from a `?stop=` link is being opened, so the URL sync
  // further down doesn't strip the param in the render before it's selected
  const stopLinkPendingRef = useRef(false);
  useEffect(() => {
    if (isUnknownTrip) return;
    if (isRoot) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: syncs with the route and localStorage, neither readable during SSR
      setOverlay("chooser");
      return;
    }
    // A link to one stop (/trips/<id>?stop=<pinId>) skips the summary and
    // opens that stop; the selection effect eases the map to it. Read from
    // window.location rather than useSearchParams, which would need a
    // Suspense boundary around this whole client-rendered map, and only on
    // arrival, so it's a one-way read. An unknown id is ignored.
    const linkedStopId = stopIdFromSearch(window.location.search, stops);
    if (linkedStopId) {
      stopLinkPendingRef.current = true;
      setOverlay(null);
      setOpenedFromList(false);
      setSelectedPinId(linkedStopId);
      return;
    }
    setOverlay(isSummaryDismissed(trip.id) ? null : "summary");
  // Only on arrival at a trip, not every time its pins change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRoot, trip.id, isUnknownTrip]);

  // When a stop opens (or the visitor steps to another), ease the map so it
  // sits in the part of the map the panel doesn't cover: left of the docked
  // panel on desktop, above the bottom sheet on mobile. When the panel
  // closes, its padding is cleared without moving the map (see
  // setMapInset). Declared before the trip fly-to effect below so that, on a
  // trip switch, the padding is cleared before the flight starts rather
  // than cancelling it.
  // The inset and stop from the last ease, or null when no panel inset is set
  const lastInsetRef = useRef(null);
  const selectedLngLat = selectedPin?.lngLat;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!selectedPinId || !selectedLngLat) {
      const last = lastInsetRef.current;
      lastInsetRef.current = null;
      if (!last) return;
      // A mobile sheet covers most of the screen, so the stop was squeezed
      // into the strip above it; leaving the map there after the sheet
      // closes shows mostly whatever lies south of the stop. Bring the stop
      // back to the middle instead. The desktop panel only shifted things
      // sideways, so there the map is left exactly as it looks.
      if (last.inset.bottom > 0) easeToPoint(map, last.lngLat, { inset: { top: 0, right: 0, bottom: 0, left: 0 } });
      else setMapInset(map);
      return;
    }
    const inset = measurePanelInset(map, panelRef.current, topBarRef.current);
    lastInsetRef.current = { inset, lngLat: selectedLngLat };
    easeToPoint(map, selectedLngLat, { inset });
  // Keyed on the coordinates' values so a refresh that hands back an equal
  // array doesn't re-ease
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPinId, selectedLngLat?.[0], selectedLngLat?.[1]]);

  // The sheet changes size after it opens: dragged between 55% and 85%, or
  // as the Wikipedia summary loads in. The top bar changes too, when the
  // chips row hides. Re-centre the stop once the size settles (debounced,
  // since a resize fires on every frame of the sheet's snap animation).
  useEffect(() => {
    const map = mapRef.current;
    const panel = panelRef.current;
    if (!map || !panel || !selectedPinId) return;
    let timer = null;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const last = lastInsetRef.current;
        if (!last) return;
        const inset = measurePanelInset(map, panelRef.current, topBarRef.current);
        if (!insetChanged(inset, last.inset)) return;
        lastInsetRef.current = { inset, lngLat: last.lngLat };
        easeToPoint(map, last.lngLat, { inset });
      }, 150);
    });
    observer.observe(panel);
    if (topBarRef.current) observer.observe(topBarRef.current);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [selectedPinId]);

  // Keep `?stop=` in the address bar in step with the open stop, so the URL
  // can be copied and shared at any point. replaceState rather than
  // router.replace: it doesn't add a history entry per stop, and it doesn't
  // make a server round trip on every step. Next's patched replaceState
  // keeps useParams/useSearchParams in sync. It needs `null` (not the
  // current history.state, which carries Next's own marker and would skip
  // that sync). Only trip pages get the param; "/" has no single trip to
  // link into.
  const openStopId = selectedPin?.id ?? null;
  useEffect(() => {
    if (isRoot || isUnknownTrip) return;
    if (stopLinkPendingRef.current) {
      if (!openStopId) return;
      stopLinkPendingRef.current = false;
    }
    const { pathname, search, hash } = window.location;
    const nextSearch = searchWithStop(search, openStopId);
    if (nextSearch === search) return;
    window.history.replaceState(null, "", `${pathname}${nextSearch}${hash}`);
  }, [openStopId, isRoot, isUnknownTrip]);

  // On a phone, the trip summary and the chooser are bottom sheets that
  // cover the lower part of the map, so the trip (or, at "/", every trip's
  // stops) is fitted into the strip above the sheet instead of the whole
  // screen, where most stops sat behind it. When the sheet closes the view
  // fits the whole map again, unless a stop opened as it closed (the
  // summary's "Start at stop 1"), which moves the map itself.
  const fittedAboveSheetRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (overlay && isPhone) {
      if (!sheetRef.current) return;
      fittedAboveSheetRef.current = true;
      flyToView(map, homeView, { inset: measurePanelInset(map, sheetRef.current, topBarRef.current) });
      return;
    }
    if (!overlay && fittedAboveSheetRef.current) {
      fittedAboveSheetRef.current = false;
      if (!selectedPinId) flyToView(map, homeView);
    }
  // selectedPinId is read, not watched: this is about the sheet changing
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay, isPhone, homeView]);

  // Fly to the new view when the trip changes, or when the root overview
  // opens or closes. The map already starts at the initial view, so that one
  // is skipped.
  const flownViewKeyRef = useRef(viewKey);
  useEffect(() => {
    if (flownViewKeyRef.current === viewKey) return;
    flownViewKeyRef.current = viewKey;
    onPickCallbackRef.current = null;
    pickingPinIdRef.current = null;
    flyToView(mapRef.current, homeView);
  }, [viewKey, homeView]);

  const closeSummary = () => {
    setOverlay(null);
    markSummaryDismissed(trip.id);
  };

  // Picking a trip in the chooser counts as having seen its summary: the
  // chooser card already showed its name, dates and description, and a
  // second popup straight after the first was one too many. The summary is
  // for visitors who land on a trip page directly (e.g. a shared link), and
  // stays reachable from the help button. Marked before the navigation
  // lands, so the route-change effect above finds it dismissed.
  const pickTripFromChooser = (tripId) => {
    markSummaryDismissed(tripId);
    setOverlay(null);
  };

  const refreshPins = async () => {
    const tripId = trip.id;
    const res = await fetch(`/api/trips/${tripId}/pins`);
    if (!res.ok) return;
    const nextPins = await res.json();
    setPinsByTrip((prev) => ({ ...prev, [tripId]: nextPins }));
  };

  const refreshTrips = async () => {
    const res = await fetch("/api/trips");
    if (!res.ok) return;
    const config = await res.json();
    const remaining = new Set(config.trips.map((t) => t.id));
    const removed = trips.map((t) => t.id).filter((id) => !remaining.has(id));
    if (removed.length) setDeletedTripIds((prev) => [...prev, ...removed]);
    setTrips(config.trips);
    setDefaultTripId(config.defaultTripId);
    // New trips start empty; deleted trips' pins are dropped
    setPinsByTrip((prev) => Object.fromEntries(config.trips.map((t) => [t.id, prev[t.id] ?? []])));
  };

  // For "Use current map view" in the trip form. Rounded so trips.json
  // doesn't fill up with 15-decimal floats.
  const getMapView = () => {
    const map = mapRef.current;
    if (!map) return null;
    const { lng, lat } = map.getCenter();
    const round = (n, places) => Math.round(n * 10 ** places) / 10 ** places;
    return { center: [round(lng, 5), round(lat, 5)], zoom: round(map.getZoom(), 2) };
  };

  const startPlacement = (callback, pinId = null) => {
    onPickCallbackRef.current = callback;
    pickingPinIdRef.current = pinId;
    setPlacementMode(true);
    setModalOpen(false);
    setSelectedPinId(null);
    setStopsListOpen(false);
  };

  // prefill is optional extra fields (label, wikipedia) from a Wikipedia search selection
  const handleLocationPick = (lngLat, prefill = {}) => {
    onPickCallbackRef.current?.(lngLat, prefill);
    onPickCallbackRef.current = null;

    // Optimistically reposition the pin on the map before the form is saved,
    // so the marker moves immediately instead of waiting for the API round-trip.
    const pinId = pickingPinIdRef.current;
    if (pinId) {
      const lngLatArray = [lngLat.lng, lngLat.lat];
      const tripId = trip.id;
      setPinsByTrip((prev) => ({
        ...prev,
        [tripId]: (prev[tripId] ?? []).map((p) => p.id === pinId ? { ...p, lngLat: lngLatArray } : p),
      }));
    }
    pickingPinIdRef.current = null;

    setPlacementMode(false);
    setModalOpen(true);
  };

  const cancelPlacement = () => {
    onPickCallbackRef.current = null;
    setPlacementMode(false);
    setModalOpen(true);
  };

  const closeStop = useCallback(() => setSelectedPinId(null), []);
  // Opening a stop from a marker or the cluster list
  const openStop = useCallback((pin) => {
    setStopsListOpen(false);
    setOpenedFromList(false);
    setSelectedPinId(pin.id);
  }, []);
  const openStopFromList = useCallback((pin) => {
    setStopsListOpen(false);
    setOpenedFromList(true);
    setSelectedPinId(pin.id);
  }, []);
  const openStopsList = useCallback(() => {
    setSelectedPinId(null);
    setStopsListOpen(true);
  }, []);
  const closeStopsList = useCallback(() => setStopsListOpen(false), []);
  // A map click closes whichever panel is open
  const closePanels = useCallback(() => {
    setSelectedPinId(null);
    setStopsListOpen(false);
  }, []);
  const toggleCategory = useCallback((key) => {
    setCategoryFilter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  const clearCategories = useCallback(() => setCategoryFilter(new Set()), []);
  // Stepping clears the hover preview: the button stays under the pointer
  // but now leads somewhere else
  const goToPrev = useCallback(() => {
    if (!prevStop) return;
    setPreviewPinId(null);
    setSelectedPinId(prevStop.id);
  }, [prevStop]);
  const goToNext = useCallback(() => {
    if (!nextStop) return;
    setPreviewPinId(null);
    setSelectedPinId(nextStop.id);
  }, [nextStop]);
  const getZoom = useCallback(() => mapRef.current?.getZoom(), []);

  // The chips row only shows for trips with two or more categories. It's
  // hidden while a stop's sheet is open on a phone or tablet, where the strip of map
  // above the sheet is small enough already.
  // Same while the summary or chooser sheet covers the map on a phone.
  const showChips = categories.length > 1 && !placementMode
    && !(isSheetLayout && selectedPin) && !(isPhone && overlay);

  if (isUnknownTrip) return null;

  return (
    <div className={`trip-map relative w-full h-full ${showChips ? "with-category-chips" : ""}`}>
      {/* The floating controls come before the map in the DOM, though they
          sit on top of it (z-10), so keyboard users reach the trip menu,
          Stops and the filters before tabbing through the markers */}
      {/* Top bar: trip menu and Stops button, with the category chips
          below. The wrapper ignores clicks so the map stays usable in the
          gaps; the right margin leaves room for the help/Admin button. */}
      {!placementMode && (
        <div ref={topBarRef} className="pointer-events-none absolute top-4 left-4 right-4 z-10 flex flex-col items-start gap-2">
          <div className="pointer-events-auto flex max-w-[calc(100%-6.5rem)] items-start gap-2">
            <TripSwitcher
              trips={trips}
              currentTripId={showOverview ? null : trip.id}
              onShowAllTrips={() => setOverlay("chooser")}
            />
            {!showOverview && stops.length > 0 && (
              <button
                type="button"
                onClick={stopsListOpen ? closeStopsList : openStopsList}
                aria-expanded={stopsListOpen}
                className="press flex flex-shrink-0 items-center gap-1.5 bg-paper hover:bg-line text-ink text-sm font-medium px-3 py-2 rounded-lg shadow-md border border-line"
              >
                <List size={16} className="text-muted" aria-hidden="true" />
                Stops
              </button>
            )}
          </div>
          {showChips && (
            <div className="pointer-events-auto max-w-full">
              <CategoryChips
                categories={categories}
                selected={categoryFilter}
                onToggle={toggleCategory}
                onClear={clearCategories}
              />
            </div>
          )}
        </div>
      )}

      {/* Floating search box shown during placement mode */}
      {placementMode && (
        <GeoSearch
          mapRef={mapRef}
          onCancel={cancelPlacement}
          onAutoPlace={handleLocationPick}
        />
      )}

      {/* Admin button — top-right, aligned with the panel it opens */}
      {isAuthenticated && !placementMode && (
        <button
          onClick={() => { closePanels(); setModalOpen(true); }}
          className="press absolute top-4 right-4 z-10 flex items-center gap-2 bg-paper hover:bg-line text-ink text-sm font-medium px-3 py-2 rounded-lg shadow-md border border-line"
        >
          <Pencil size={14} />
          Admin
        </button>
      )}

      {/* Help button - reopens this page's popup (chooser at "/", the trip
          summary on a trip page). Top-right, hidden while logged in since
          the Admin button takes that spot; the bottom corners are taken by
          MapLibre's scale/attribution. */}
      {!placementMode && !isAuthenticated && (
        <button
          onClick={() => setOverlay(isRoot ? "chooser" : "summary")}
          aria-label="About this trip"
          title="About this trip"
          className="press absolute top-4 right-4 z-10 flex items-center justify-center w-9 h-9 bg-paper hover:bg-line text-muted hover:text-ink rounded-full shadow-md border border-line"
        >
          <HelpCircle size={18} />
        </button>
      )}

      <Map
        mapRef={mapRef}
        pins={mapPins}
        previewPinId={selectedPin ? previewPinId : null}
        backgroundPoints={backgroundPoints}
        stopNumbers={stopNumbers}
        selectedPinId={selectedPin?.id ?? null}
        homeView={homeView}
        placementMode={placementMode}
        onLocationPick={handleLocationPick}
        onPinClick={openStop}
        // Clicking the open map closes the stop panel or stops list
        // (desktop has no backdrop to click)
        onMapClick={closePanels}
      />

      {overlay === "summary" && (
        <TripSummary
          trip={trip}
          pins={tripPins}
          sheetRef={sheetRef}
          onClose={closeSummary}
          onStart={stops.length > 0 ? () => {
            closeSummary();
            setOpenedFromList(false);
            setSelectedPinId(stops[0].id);
          } : null}
          onShowAllTrips={trips.length > 1 ? () => { closeSummary(); setOverlay("chooser"); } : null}
        />
      )}

      {overlay === "chooser" && (
        <TripChooser
          trips={trips}
          pinsByTrip={pinsByTrip}
          sheetRef={sheetRef}
          currentTripId={isRoot ? null : trip.id}
          onPick={pickTripFromChooser}
          onClose={() => setOverlay(null)}
        />
      )}

      {/* Editor side panel — kept mounted during placement mode so form state
          (including partially-filled fields) survives the pick flow */}
      {(modalOpen || placementMode) && (
        <div className={placementMode ? "hidden" : undefined}>
          <EditorModal
            key={trip.id}
            trip={trip}
            trips={trips}
            defaultTripId={defaultTripId}
            pinsByTrip={pinsByTrip}
            getMapView={getMapView}
            onTripsChanged={refreshTrips}
            pins={stops}
            onClose={() => setModalOpen(false)}
            onStartPlacement={startPlacement}
            onRefresh={refreshPins}
            onFlyTo={(lngLat) => mapRef.current?.flyTo({ center: lngLat, zoom: 12 })}
            editTargetId={editTargetId}
            onEditTargetConsumed={() => setEditTargetId(null)}
          />
        </div>
      )}

      {stopsListOpen && !showOverview && (
        <StopsList
          stops={stops}
          stopNumbers={stopNumbers}
          onPick={openStopFromList}
          onClose={closeStopsList}
          panelRef={panelRef}
        />
      )}

      {/* Stop detail — bottom sheet on mobile, right-hand panel on desktop */}
      {selectedPin && (
        <PinPopup
          pin={selectedPin}
          stopNumber={stopNumbers[selectedPin.id]}
          stopCount={stops.length}
          onBackToList={openedFromList ? openStopsList : null}
          shareHref={`/trips/${trip.id}${searchWithStop("", selectedPin.id)}`}
          prev={prevStop}
          next={nextStop}
          onPrev={goToPrev}
          onNext={goToNext}
          onClose={closeStop}
          getZoom={getZoom}
          panelRef={panelRef}
          onPreviewStop={setPreviewPinId}
          keyboardEnabled={!modalOpen && !placementMode}
          onEdit={isAuthenticated ? (id) => {
            setSelectedPinId(null);
            setEditTargetId(id);
            setModalOpen(true);
          } : null}
        />
      )}
    </div>
  );
}
