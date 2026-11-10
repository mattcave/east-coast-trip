"use client";

import { useState, useRef, useEffect, useMemo, useCallback, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import { Pencil, HelpCircle, List, Play } from "lucide-react";
import Map from "./Map";
import GeoSearch from "./GeoSearch";
import EditorModal from "./EditorModal";
import PinPopup from "./PinPopup";
import TripSummary from "./TripSummary";
import TripChooser from "./TripChooser";
import TripSwitcher from "./TripSwitcher";
import StopsList from "./StopsList";
import CategoryChips from "./CategoryChips";
import FinishCard from "./FinishCard";
import { tripHomeView, overviewHomeView, flyToView, fitToStops, easeToPoint, setMapInset } from "@/lib/trips";
import { sortPins, stopIdFromSearch, searchWithStop } from "@/lib/pins";
import { tripCategories, filterPinsByCategory } from "@/lib/categories";
import { DOCKED_PANEL_QUERY } from "@/lib/layout";

// Stable empty array so a trip without pins doesn't hand Map a new array
// (and rebuild its markers) on every render
const NO_PINS = [];

// Space kept between the top bar and a stop eased into the strip below it,
// so the enlarged selected marker and its number badge clear the bar
const TOP_BAR_GAP = 12;

// Two layout breakpoints. The stop panel and stops list are bottom sheets
// unless the screen is wide and in landscape (phones and portrait tablets;
// see DOCKED_PANEL_QUERY). The trip
// summary and chooser are bottom sheets only on phones, below 640px; on a
// tablet they're centred cards. Read with useSyncExternalStore so they
// follow rotation and resizing; the server render assumes desktop.
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
  // The finish card, shown after the last stop ("The end of the trip"). It
  // takes the stop panel's place, so no stop is selected while it's open.
  const [finishOpen, setFinishOpen] = useState(false);
  const showFinish = finishOpen && !showOverview && stops.length > 0;
  // The last stop opened during this visit to the trip, for the map's
  // "Back to stop N" button. Component state only, not persisted.
  const [lastOpenedStopId, setLastOpenedStopId] = useState(null);
  if (selectedPin && selectedPin.id !== lastOpenedStopId) setLastOpenedStopId(selectedPin.id);
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
  const isSheetLayout = !useMediaQuery(DOCKED_PANEL_QUERY);
  const isPhone = useMediaQuery(PHONE_QUERY);
  // Only one thing uses the right-hand panel at a time: a stop, the stops
  // list, or the admin editor. Opening one closes the others.
  const [stopsListOpen, setStopsListOpen] = useState(false);
  // Whether the open stop was picked from the list, so it can offer a way back
  const [openedFromList, setOpenedFromList] = useState(false);
  // Selected category chips. Kept while the visitor stays on this trip,
  // dropped on a trip switch; not persisted.
  const [categoryFilter, setCategoryFilter] = useState(() => new Set());
  // The open stop's neighbours stay on the map under a filter too, since
  // Previous/Next steps through every stop. On the finish card, the last
  // stop is the "previous" one.
  const lastStop = stops[stops.length - 1] ?? null;
  const neighbourIds = useMemo(
    () => (showFinish ? [lastStop?.id] : [prevStop?.id, nextStop?.id]).filter(Boolean),
    [showFinish, lastStop?.id, prevStop?.id, nextStop?.id]
  );
  const mapPins = useMemo(
    () => filterPinsByCategory(pins, categoryFilter, [selectedPinId, ...neighbourIds]),
    [pins, categoryFilter, selectedPinId, neighbourIds]
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
    setFinishOpen(false);
    setLastOpenedStopId(null);
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
  // The trip whose arrival has been handled. Until then it isn't known
  // whether the summary will open, so the map's Start button waits, rather
  // than flashing up for a moment under the summary.
  const [arrivedTripId, setArrivedTripId] = useState(null);
  useEffect(() => {
    if (isUnknownTrip) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: syncs with the route and localStorage, neither readable during SSR
    setArrivedTripId(trip.id);
    if (isRoot) {
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

  // When a stop opens (or the visitor steps to another), fit the map to it
  // and its neighbours (the stops Previous and Next lead to), in the part of
  // the map the panel doesn't cover: left of the docked panel, above the
  // bottom sheet. Without the zoom, the open stop sat at the trip-wide view
  // piled up on its neighbours, and most of them were inside clusters.
  // When the panel closes, its padding is cleared without moving the map
  // (see setMapInset). Declared before the trip fly-to effect below so
  // that, on a trip switch, the padding is cleared before the flight
  // starts rather than cancelling it.
  // The finish card fits the whole trip beside it instead.
  // The inset and points from the last fit, or null when no panel is open
  const lastInsetRef = useRef(null);
  const selectedLngLat = selectedPin?.lngLat;
  const fitPoints = selectedPin
    ? [selectedPin, prevStop, nextStop].filter(Boolean).map((p) => p.lngLat)
    : null;
  // Changes when the open stop or where it and its neighbours are changes,
  // so a refresh that hands back equal arrays doesn't refit
  const fitKey = fitPoints ? JSON.stringify(fitPoints) : null;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (showFinish) {
      const inset = measurePanelInset(map, panelRef.current, topBarRef.current);
      lastInsetRef.current = { inset, points: null };
      flyToView(map, homeView, { inset });
      return;
    }
    if (!selectedPinId || !selectedLngLat) {
      const last = lastInsetRef.current;
      lastInsetRef.current = null;
      if (!last) return;
      // A mobile sheet covers most of the screen, so the stop was squeezed
      // into the strip above it; leaving the map there after the sheet
      // closes shows mostly whatever lies south of the stop. Bring the stop
      // back to the middle instead. The desktop panel only shifted things
      // sideways, so there the map is left exactly as it looks.
      if (last.points && last.inset.bottom > 0) easeToPoint(map, last.points[0], { inset: { top: 0, right: 0, bottom: 0, left: 0 } });
      else setMapInset(map);
      return;
    }
    const inset = measurePanelInset(map, panelRef.current, topBarRef.current);
    const points = JSON.parse(fitKey);
    lastInsetRef.current = { inset, points };
    fitToStops(map, points, { inset });
  // homeView is read, not watched: the finish card fits once as it opens
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPinId, fitKey, showFinish]);

  // The sheet changes size after it opens: dragged between 55% and 85%, or
  // as the Wikipedia summary loads in. The top bar changes too, when the
  // chips row hides. Refit once the size settles (debounced, since a resize
  // fires on every frame of the sheet's snap animation).
  useEffect(() => {
    const map = mapRef.current;
    const panel = panelRef.current;
    if (!map || !panel || !selectedPinId) return;
    let timer = null;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const last = lastInsetRef.current;
        if (!last?.points) return;
        const inset = measurePanelInset(map, panelRef.current, topBarRef.current);
        if (!insetChanged(inset, last.inset)) return;
        lastInsetRef.current = { inset, points: last.points };
        fitToStops(map, last.points, { inset });
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
    setFinishOpen(false);
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
  // Opening a stop from a marker, the cluster list, the map's Start
  // button or the finish card's photos
  const openStop = useCallback((pin) => {
    setStopsListOpen(false);
    setFinishOpen(false);
    setOpenedFromList(false);
    setSelectedPinId(pin.id);
  }, []);
  const openStopFromList = useCallback((pin) => {
    setStopsListOpen(false);
    setFinishOpen(false);
    setOpenedFromList(true);
    setSelectedPinId(pin.id);
  }, []);
  const openStopsList = useCallback(() => {
    setSelectedPinId(null);
    setFinishOpen(false);
    setStopsListOpen(true);
  }, []);
  const closeStopsList = useCallback(() => setStopsListOpen(false), []);
  // A map click closes whichever panel is open
  const closePanels = useCallback(() => {
    setSelectedPinId(null);
    setStopsListOpen(false);
    setFinishOpen(false);
  }, []);
  // "The end of the trip", from the last stop
  const openFinish = useCallback(() => {
    setPreviewPinId(null);
    setSelectedPinId(null);
    setStopsListOpen(false);
    setFinishOpen(true);
  }, []);
  const closeFinish = useCallback(() => setFinishOpen(false), []);
  // Previous on the finish card goes back to the last stop
  const finishToLastStop = useCallback(() => {
    if (!lastStop) return;
    setPreviewPinId(null);
    setFinishOpen(false);
    setOpenedFromList(false);
    setSelectedPinId(lastStop.id);
  }, [lastStop]);
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
    && !(isSheetLayout && (selectedPin || showFinish)) && !(isPhone && overlay);

  // While the stop panel, stops list or finish card is docked on the
  // right, the top bar ends 16px short of it, so the chips row doesn't run
  // underneath (it then scrolls, with the fade at its new right edge).
  // The offsets are the panel's widths (see SidePanel) plus 16px.
  const dockedPanelOpen = Boolean(selectedPin || (stopsListOpen && !showOverview) || showFinish);
  const topBarRight = dockedPanelOpen ? "dock:right-[416px] dock-wide:right-[536px]" : "";

  // The map's "Start at stop 1" button (or "Back to stop N" once a stop has
  // been opened), shown only when nothing else is open on the map
  const resumeStop = stops.find((p) => p.id === lastOpenedStopId) ?? null;
  const startStop = resumeStop ?? stops[0] ?? null;
  const showStartButton = Boolean(startStop) && !showOverview && arrivedTripId === trip.id
    && !selectedPin && !stopsListOpen && !showFinish && !overlay && !modalOpen && !placementMode;

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
        <div ref={topBarRef} className={`pointer-events-none absolute top-4 left-4 right-4 z-10 flex flex-col items-start gap-2 ${topBarRight}`}>
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
                className="press touch-hit relative flex flex-shrink-0 items-center gap-1.5 bg-paper hover:bg-line text-ink text-sm font-medium px-3 py-2 rounded-lg shadow-md border border-line"
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
          className="press touch-hit absolute top-4 right-4 z-10 flex items-center justify-center w-9 h-9 bg-paper hover:bg-line text-muted hover:text-ink rounded-full shadow-md border border-line"
        >
          <HelpCircle size={18} />
        </button>
      )}

      <Map
        mapRef={mapRef}
        pins={mapPins}
        previewPinId={selectedPin || showFinish ? previewPinId : null}
        pinnedPinIds={neighbourIds}
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

      {/* Start (or pick up again) from the map itself. Visitors who arrive
          from the trip chooser skip the trip intro, and its "Start at stop
          1", so without this they'd land on a map of clusters with no
          obvious place to begin. Bottom centre, above the safe area and
          clear of MapLibre's scale and attribution in the corners. */}
      {showStartButton && (
        <button
          type="button"
          onClick={() => openStop(startStop)}
          className="press absolute left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-accent py-2.5 pl-4 pr-5 text-sm font-medium text-white shadow-lg hover:bg-accent-hover bottom-[calc(env(safe-area-inset-bottom)+2.5rem)] sm:bottom-[calc(env(safe-area-inset-bottom)+2rem)]"
        >
          <Play size={16} fill="currentColor" aria-hidden="true" />
          {resumeStop ? `Back to stop ${stopNumbers[resumeStop.id]}` : "Start at stop 1"}
        </button>
      )}

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
          trip={trip}
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
          onFinish={openFinish}
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

      {showFinish && (
        <FinishCard
          trip={trip}
          stops={stops}
          stopNumbers={stopNumbers}
          lastStop={lastStop}
          onPrev={finishToLastStop}
          onOpenStop={openStop}
          onShowAllTrips={trips.length > 1 ? () => { closeFinish(); setOverlay("chooser"); } : null}
          onClose={closeFinish}
          panelRef={panelRef}
          onPreviewStop={setPreviewPinId}
          keyboardEnabled={!modalOpen && !placementMode}
        />
      )}
    </div>
  );
}
