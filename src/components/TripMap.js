"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { Pencil, HelpCircle } from "lucide-react";
import Map from "./Map";
import GeoSearch from "./GeoSearch";
import EditorModal from "./EditorModal";
import PinPopup from "./PinPopup";
import TripSummary from "./TripSummary";
import TripChooser from "./TripChooser";
import TripSwitcher from "./TripSwitcher";
import { tripHomeView, overviewHomeView, flyToView, easeToPoint, setMapInset } from "@/lib/trips";
import { sortPins } from "@/lib/pins";

// Stable empty array so a trip without pins doesn't hand Map a new array
// (and rebuild its markers) on every render
const NO_PINS = [];

// Height of the trip menu and the buttons along the top of the map (top-4
// plus a ~36px pill, with a little breathing room)
const TOP_CONTROLS_HEIGHT = 60;

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
  // hydration. The effect also re-runs on client-side navigation between trips.
  const [overlay, setOverlay] = useState(isRoot ? "chooser" : null);
  useEffect(() => {
    if (isUnknownTrip) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: syncs with the route and localStorage, neither readable during SSR
    setOverlay(isRoot ? "chooser" : isSummaryDismissed(trip.id) ? null : "summary");
  }, [isRoot, trip.id, isUnknownTrip]);

  // While the chooser is open at "/", no trip has been picked yet, so the
  // map shows a pin-free overview of where all the trips are rather than the
  // default trip. Closing the chooser without picking reveals the default
  // trip. (The chooser opened from a trip page leaves that trip showing.)
  const showOverview = isRoot && overlay === "chooser";
  const pins = showOverview ? NO_PINS : stops;
  const homeView = useMemo(
    () => (showOverview ? overviewHomeView(trips, pinsByTrip) : tripHomeView(trip, tripPins)),
    [showOverview, trips, pinsByTrip, trip, tripPins]
  );
  const viewKey = showOverview ? OVERVIEW : trip.id;

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
  // The open stop panel, measured to keep the stop clear of it
  const panelRef = useRef(null);

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
    setEditTargetId(null);
    setPlacementMode(false);
  }

  // When a stop opens (or the visitor steps to another), ease the map so it
  // sits in the part of the map the panel doesn't cover: left of the docked
  // panel on desktop, above the bottom sheet on mobile. When the panel
  // closes, its padding is cleared without moving the map (see
  // setMapInset). Declared before the trip fly-to effect below so that, on a
  // trip switch, the padding is cleared before the flight starts rather
  // than cancelling it.
  const insetActiveRef = useRef(false);
  const selectedLngLat = selectedPin?.lngLat;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!selectedPinId || !selectedLngLat) {
      if (insetActiveRef.current) setMapInset(map);
      insetActiveRef.current = false;
      return;
    }
    const rect = panelRef.current?.getBoundingClientRect();
    let inset = { top: 0, right: 0, bottom: 0, left: 0 };
    if (rect) {
      // Docked right (desktop) vs a bottom sheet (mobile). On mobile the
      // stop goes in the strip between the trip menu and the top of the
      // sheet. With a tall sheet on a short phone that strip can be under
      // 100px, so the menu's space is only kept clear when there's room.
      if (rect.left > 0) {
        inset.right = rect.width;
      } else {
        inset.bottom = rect.height;
        if (window.innerHeight - rect.height > TOP_CONTROLS_HEIGHT + 48) inset.top = TOP_CONTROLS_HEIGHT;
      }
    }
    insetActiveRef.current = true;
    easeToPoint(map, selectedLngLat, { inset });
  // Keyed on the coordinates' values so a refresh that hands back an equal
  // array doesn't re-ease
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPinId, selectedLngLat?.[0], selectedLngLat?.[1]]);

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
  const goToPrev = useCallback(() => { if (prevStop) setSelectedPinId(prevStop.id); }, [prevStop]);
  const goToNext = useCallback(() => { if (nextStop) setSelectedPinId(nextStop.id); }, [nextStop]);
  const getZoom = useCallback(() => mapRef.current?.getZoom(), []);

  if (isUnknownTrip) return null;

  return (
    <div className="relative w-full h-full">
      <Map
        mapRef={mapRef}
        pins={pins}
        stopNumbers={stopNumbers}
        selectedPinId={selectedPin?.id ?? null}
        homeView={homeView}
        placementMode={placementMode}
        onLocationPick={handleLocationPick}
        onPinClick={(pin) => setSelectedPinId(pin.id)}
        // Clicking the open map closes the stop panel (desktop has no
        // backdrop to click)
        onMapClick={closeStop}
      />

      {!placementMode && (
        <TripSwitcher
          trips={trips}
          currentTripId={showOverview ? null : trip.id}
          onShowAllTrips={() => setOverlay("chooser")}
        />
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
          onClick={() => { setSelectedPinId(null); setModalOpen(true); }}
          className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium px-3 py-2 rounded-lg shadow-md border border-gray-200 transition-colors"
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
          className="absolute top-4 right-4 z-10 flex items-center justify-center w-9 h-9 bg-white hover:bg-gray-50 text-gray-500 hover:text-gray-700 rounded-full shadow-md border border-gray-200 transition-colors"
        >
          <HelpCircle size={18} />
        </button>
      )}

      {overlay === "summary" && (
        <TripSummary
          trip={trip}
          pinCount={tripPins.length}
          onClose={closeSummary}
          onShowAllTrips={trips.length > 1 ? () => { closeSummary(); setOverlay("chooser"); } : null}
        />
      )}

      {overlay === "chooser" && (
        <TripChooser
          trips={trips}
          pinsByTrip={pinsByTrip}
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

      {/* Stop detail — bottom sheet on mobile, right-hand panel on desktop */}
      {selectedPin && (
        <PinPopup
          pin={selectedPin}
          prev={prevStop}
          next={nextStop}
          onPrev={goToPrev}
          onNext={goToNext}
          onClose={closeStop}
          getZoom={getZoom}
          panelRef={panelRef}
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
