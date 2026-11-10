"use client";

import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
// maplibre-gl v6 ships ESM-only with no default export
import * as maplibregl from "maplibre-gl";
import Supercluster from "supercluster";
import "maplibre-gl/dist/maplibre-gl.css";
import { PIN_ICONS } from "@/lib/icons";
import { pinImages, clusterLabel } from "@/lib/pins";
import { flyToView, initialMapOptions } from "@/lib/trips";
import ClusterList from "./ClusterList";

// Trips can be anywhere, so the map only stops short of the whole-world view
// (where pins and clusters stop meaning much)
const MIN_ZOOM = 2;

// Pixel radius (at the current zoom) within which pins are grouped into a
// cluster, and the zoom past which they always render individually. 28 is
// about one marker's width with a little overlap allowed; the old 40 hid 39
// of the East Coast trip's 44 stops in clusters at its opening view.
const CLUSTER_RADIUS = 28;
const CLUSTER_MAX_ZOOM = 16;

// Clusters this small open a list of their stops instead of zooming in,
// since zooming often took two or three clicks to separate them
const CLUSTER_LIST_MAX = 6;

// Map source and layer id for the background dots (see backgroundPoints)
const BACKGROUND_SOURCE = "background-points";

// Shared by every marker <button>. Tailwind's preflight already strips the
// button chrome; this adds a visible keyboard focus ring. `map-marker` hooks
// up the hover growth in globals.css.
const MARKER_BUTTON_CLASS = "map-marker block rounded-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent";

// Palette values for inline marker styles (markers render into their own
// React roots with inline styles, so they can't use the Tailwind tokens)
const INK = "#1f2a2e";
const PAPER = "#fbf8f3";
const ACCENT = "#1f6f6b";
const MUTED = "#5b6b70";
// MapLibre's container sets its own Helvetica font, so marker text names
// the app's sans (Geist, loaded in layout.js) explicitly
const SANS = "var(--font-geist-sans), system-ui, sans-serif";

// A stop: a disc in its category colour. A dark badge with a number always
// means a stop number (clusters never look like this). A stop with photos
// gets a white ring and a soft shadow, like a small print, instead of a
// separate camera badge, so no stop carries more than one badge. The
// selected stop is enlarged with an accent ring.
function markerShadow({ selected, hasPhotos }) {
  if (selected) return `0 0 0 2px white, 0 0 0 5px ${ACCENT}, 0 3px 10px rgba(0,0,0,0.4)`;
  if (hasPhotos) return "0 0 0 2px white, 0 2px 6px rgba(0,0,0,0.35)";
  return "0 1px 3px rgba(0,0,0,0.3)";
}

function MarkerPin({ icon, number, selected, hasPhotos }) {
  const { icon: Icon, color } = PIN_ICONS[icon] ?? PIN_ICONS.default;
  return (
    <div
      data-marker-face=""
      data-selected={selected ? "" : undefined}
      style={{
        position: "relative",
        background: color,
        borderRadius: "50%",
        width: 34,
        height: 34,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: markerShadow({ selected, hasPhotos }),
        // Scaled here rather than on the marker element, whose transform
        // MapLibre owns for positioning
        transform: selected ? "scale(1.25)" : undefined,
      }}
    >
      <Icon size={17} color="white" />
      {number != null && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: -7,
            right: -9,
            minWidth: 18,
            height: 18,
            padding: "0 4px",
            borderRadius: 9,
            background: INK,
            color: "white",
            border: "1.5px solid white",
            fontFamily: SANS,
            fontSize: 10,
            fontWeight: 700,
            lineHeight: "15px",
            textAlign: "center",
          }}
        >
          {number}
        </span>
      )}
    </div>
  );
}

// A cluster: a paper circle with an ink ring and the count or stop range.
// Every cluster is the same size, so big clusters don't loom over their
// neighbours, and every label is the same size: shrinking only the longer
// ones made "9–10" look smaller than "5–7". 40px is the smallest circle
// that holds the widest label ("38–41") at a readable 11px with a little
// room inside the ring, a few px larger than a stop. The dash's side
// bearings are pulled in, since an en dash carries a lot of space.
// Light where stops are coloured, and with no badge, so it never reads as
// a stop.
function ClusterBadge({ text }) {
  return (
    <div data-marker-face="" style={{
      background: PAPER,
      color: INK,
      borderRadius: "50%",
      width: 40,
      height: 40,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: `2px solid ${INK}`,
      boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
      fontFamily: SANS,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "-0.02em",
      fontVariantNumeric: "tabular-nums",
    }}>
      {text.includes("–") ? (
        <>
          {text.split("–")[0]}
          <span style={{ margin: "0 -0.12em" }}>–</span>
          {text.split("–")[1]}
        </>
      ) : text}
    </div>
  );
}

function pinAriaLabel(pin, number, hasPhotos) {
  const category = (PIN_ICONS[pin.icon] ?? PIN_ICONS.default).label;
  const name = number != null ? `Stop ${number}: ${pin.label}, ${category}` : `${pin.label}, ${category}`;
  return hasPhotos ? `${name}, has photos` : name;
}

// homeView is the current trip's view (see tripHomeView): where the map
// starts, and where the Home button returns to. Moving the map when the trip
// changes is up to the parent, since only it knows a switch happened.
//
// pins arrive in stop order; stopNumbers maps pin id -> stop number (kept
// separate so a filtered list doesn't renumber). The selected pin is always
// drawn on its own, highlighted, never inside a cluster, so stepping
// through stops can't land on one hidden in a bubble. `pinnedPinIds` (the
// open stop's previous and next stops) are also drawn on their own, so
// hovering Previous/Next always has a marker to light up.
export default function Map({
  mapRef, pins = [], stopNumbers = null, selectedPinId = null, homeView = null,
  placementMode = false, onLocationPick, onPinClick, onMapClick,
  previewPinId = null, backgroundPoints = null, pinnedPinIds = null,
}) {
  const containerRef = useRef(null);
  const [initError, setInitError] = useState(null);
  // Small cluster's stop list: { pins, x, y } in container pixels, or null
  const [clusterList, setClusterList] = useState(null);
  // key ("pin:<id>" / "cluster:<id>") -> { marker, root, el, signature }
  const markersRef = useRef(new globalThis.Map());
  // The current cluster index and pin lookup. Markers outlive the effect run
  // that created them, so their click handlers read these at click time
  // rather than closing over a stale index (cluster ids from an old index
  // can name a different cluster in the new one).
  const clusterStateRef = useRef({ index: null, pins: [], pinsById: new globalThis.Map() });
  // Refs so marker clicks always call the latest callbacks without re-creating markers
  const onPinClickRef = useRef(onPinClick);
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => { onPinClickRef.current = onPinClick; onMapClickRef.current = onMapClick; });
  const placementModeRef = useRef(placementMode);
  useEffect(() => { placementModeRef.current = placementMode; });
  const homeViewRef = useRef(homeView);
  useEffect(() => { homeViewRef.current = homeView; });
  // A string so the marker effect only re-runs when the ids change, not
  // whenever the parent hands over a new array
  const pinnedKey = (pinnedPinIds ?? []).filter(Boolean).join(",");

  useEffect(() => {
    if (mapRef.current) return;

    // Turbopack can't statically bundle the worker maplibre-gl resolves
    // internally via new URL(...); without this, the tile-processing worker
    // silently fails to load and no vector tiles ever get requested.
    maplibregl.setWorkerUrl("/api/map/worker/maplibre-gl-worker.mjs");

    // Phones and tablets: people pinch to zoom, so the +/- buttons are
    // clutter, and a stray two-finger twist or tilt would leave the map
    // rotated with no compass to put it back. So on a touch-first device
    // rotation and pitch are off and the zoom/compass control isn't added.
    // "pointer: coarse" is the primary input, so a laptop with a
    // touchscreen still counts as a mouse device.
    const isTouch = window.matchMedia?.("(pointer: coarse)").matches ?? false;

    let map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: "/api/map/style",
        ...initialMapOptions(homeViewRef.current),
        minZoom: MIN_ZOOM,
        dragRotate: !isTouch,
        touchPitch: !isTouch,
        // Added below as a compact (collapsible) control instead
        attributionControl: false,
      });
    } catch {
      // MapLibre throws synchronously when WebGL is unavailable, and that's
      // only discoverable by trying, so the fallback has to be set from here
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInitError("The map couldn't start, possibly because WebGL is disabled or unavailable.");
      return;
    }

    mapRef.current = map;
    if (isTouch) map.touchZoomRotate.disableRotation();
    else map.addControl(new maplibregl.NavigationControl(), "top-left");

    // Compact attribution: on a phone the full credits wrap to two lines
    // across the bottom of the map. MapLibre's compact control still starts
    // expanded, and only folds into its (i) button after the first drag, so
    // it's folded once the map first settles. Desktop (wider than 640px)
    // keeps the full one-line credits, as MapLibre does by default.
    // `compact` is left unset on purpose: unset means "compact only when the
    // map is 640px wide or less", where `true` would fold it on desktop too.
    // Passing any options replaces MapLibre's defaults, so its own credit
    // link is repeated here.
    map.addControl(new maplibregl.AttributionControl({
      customAttribution: '<a href="https://maplibre.org/" target="_blank">MapLibre</a>',
    }), "bottom-right");
    map.once("idle", () => {
      const attrib = map.getContainer().querySelector(".maplibregl-ctrl-attrib.maplibregl-compact");
      if (!attrib) return;
      attrib.classList.remove("maplibregl-compact-show");
      attrib.removeAttribute("open");
    });
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    // Home button — returns the map to the current trip's view
    const homeBtn = document.createElement("button");
    homeBtn.className = "maplibregl-ctrl-icon reset-view-button";
    homeBtn.title = "Reset view";
    homeBtn.setAttribute("aria-label", "Reset view");
    homeBtn.style.cssText = "display:flex; align-items:center; justify-content:center;";
    homeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`;
    homeBtn.addEventListener("click", () => {
      flyToView(map, homeViewRef.current);
    });
    const homeControl = document.createElement("div");
    homeControl.className = "maplibregl-ctrl maplibregl-ctrl-group";
    homeControl.appendChild(homeBtn);
    map.addControl({ onAdd: () => homeControl, onRemove: () => {} }, "top-left");

    // The Stadia Outdoors style references sprite icons (e.g. shelter_11) that
    // are missing from its sprite sheet. Substitute a transparent 1x1 pixel to
    // prevent MapLibre from logging warnings for each missing image.
    // (v6: the "styleimagemissing" event listener can no longer resolve the
    // request via addImage — that must go through setMissingStyleImageResolver.)
    map.setMissingStyleImageResolver((id) => {
      map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
    });

    // Marker <button>s live inside MapLibre's canvas container, so a click
    // on one bubbles up and fires the map's own click event too. Without
    // this check, clicking a second pin would open it and immediately close
    // it again as a "click on the map".
    map.on("click", (e) => {
      if (e.originalEvent?.target?.closest?.(".maplibregl-marker")) return;
      if (placementModeRef.current) return;
      onMapClickRef.current?.();
    });

    // The cluster list is placed once in screen pixels, so any camera move
    // would leave it pointing at the wrong spot
    map.on("movestart", () => setClusterList(null));

    const markers = markersRef.current;
    return () => {
      const roots = [...markers.values()].map((entry) => {
        entry.marker.remove();
        return entry.root;
      });
      markers.clear();
      // Deferred (not synchronous) for the same reason as in the marker
      // effect below: unmounting a React root synchronously while React is
      // still mid-render (e.g. during Fast Refresh teardown) triggers
      // "Attempted to synchronously unmount a root..." warnings.
      setTimeout(() => roots.forEach((r) => r.unmount()), 0);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [mapRef]);

  // Markers (clusters + individual pins), updated whenever the pins, the
  // selection or the viewport change. Existing markers are kept and only
  // re-rendered when what they show changes, and only markers that come or
  // go are created or removed: rebuilding them all on every move would drop
  // keyboard focus from a marker as soon as the map eased after it was
  // activated.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const selectedPin = pins.find((p) => p.id === selectedPinId) ?? null;
    const pinsById = new globalThis.Map(pins.map((p) => [p.id, p]));
    const pinned = (pinnedKey ? pinnedKey.split(",") : [])
      .map((id) => pinsById.get(id))
      .filter((pin) => pin && pin !== selectedPin);
    const unclustered = new Set([selectedPin, ...pinned]);
    // Each cluster carries the lowest and highest stop numbers inside it:
    // the lowest sets its place in the keyboard tab order (see
    // placeInStopOrder), and both give its range label (see clusterLabel)
    const index = new Supercluster({
      radius: CLUSTER_RADIUS,
      maxZoom: CLUSTER_MAX_ZOOM,
      map: (props) => ({ firstStop: props.stopNumber, lastStop: props.stopNumber }),
      reduce: (acc, props) => {
        acc.firstStop = Math.min(acc.firstStop, props.firstStop);
        acc.lastStop = Math.max(acc.lastStop, props.lastStop);
      },
    }).load(
      pins
        .filter((pin) => !unclustered.has(pin))
        .map((pin) => ({
          type: "Feature",
          properties: { pinId: pin.id, stopNumber: stopNumbers?.[pin.id] ?? Number.MAX_SAFE_INTEGER },
          geometry: { type: "Point", coordinates: pin.lngLat },
        }))
    );
    clusterStateRef.current = { index, pins, pinsById };
    const markers = markersRef.current;

    // Markers are tabbed through in DOM order, and MapLibre appends each new
    // one at the end, so after a few zooms the order would be whatever came
    // into view last. Each marker is slotted in by stop number instead
    // (clusters by their first stop). Moving a node in the DOM drops its
    // focus, so a focused marker is never moved.
    const placeInStopOrder = (el, sortKey) => {
      if (el.dataset.sortKey === String(sortKey)) return;
      el.dataset.sortKey = String(sortKey);
      if (el === document.activeElement) return;
      const parent = el.parentNode;
      const before = [...parent.children].find(
        (sibling) => sibling !== el && sibling.dataset.sortKey !== undefined && Number(sibling.dataset.sortKey) > sortKey
      );
      if (before) parent.insertBefore(el, before);
      else if (el !== parent.lastElementChild) parent.appendChild(el);
    };

    const createMarker = (key, lngLat, build) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = MARKER_BUTTON_CLASS;
      const root = createRoot(el);
      build(el);
      const marker = new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map);
      const entry = { marker, root, el, signature: null };
      markers.set(key, entry);
      return entry;
    };

    const renderMarkers = () => {
      const bounds = map.getBounds();
      const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
      const zoom = Math.floor(map.getZoom());
      const features = index.getClusters(bbox, zoom);
      const wanted = new Set();

      for (const feature of features) {
        const lngLat = feature.geometry.coordinates;

        if (feature.properties.cluster) {
          const { cluster_id: clusterId, point_count: count, firstStop, lastStop } = feature.properties;
          const label = clusterLabel({ count, firstStop, lastStop });
          const key = `cluster:${clusterId}`;
          wanted.add(key);
          const entry = markers.get(key) ?? createMarker(key, lngLat, (el) => {
            el.addEventListener("click", () => {
              if (placementModeRef.current) return;
              const { index: current, pins: allPins, pinsById: byId } = clusterStateRef.current;
              const at = entry.marker.getLngLat().toArray();
              const size = current.getLeaves(clusterId, Infinity).length;
              if (size <= CLUSTER_LIST_MAX) {
                const leaves = current.getLeaves(clusterId, CLUSTER_LIST_MAX)
                  .map((leaf) => byId.get(leaf.properties.pinId))
                  .filter(Boolean)
                  // Leaves come back in index order; show them as stops
                  .sort((a, b) => allPins.indexOf(a) - allPins.indexOf(b));
                const point = map.project(at);
                const container = map.getContainer();
                setClusterList({
                  pins: leaves, x: point.x, y: point.y, returnFocusTo: el,
                  width: container.clientWidth, height: container.clientHeight,
                });
                return;
              }
              const expansionZoom = Math.min(current.getClusterExpansionZoom(clusterId), CLUSTER_MAX_ZOOM + 1);
              flyToView(map, { center: at, zoom: expansionZoom });
            });
          });
          const signature = JSON.stringify([label.text, lngLat]);
          if (entry.signature !== signature) {
            entry.marker.setLngLat(lngLat);
            entry.el.setAttribute("aria-label", label.ariaLabel);
            entry.root.render(<ClusterBadge text={label.text} />);
            entry.signature = signature;
          }
          placeInStopOrder(entry.el, feature.properties.firstStop);
          continue;
        }

        const pin = pinsById.get(feature.properties.pinId);
        if (pin) wanted.add(syncPin(pin, false));
      }

      // The selected pin and its neighbours aren't in the index, so they're
      // added separately. Always kept, even when off screen, so they don't
      // flicker out while the map eases towards them.
      for (const pin of pinned) wanted.add(syncPin(pin, false));
      if (selectedPin) wanted.add(syncPin(selectedPin, true));

      const removedRoots = [];
      for (const [key, entry] of markers) {
        if (wanted.has(key)) continue;
        entry.marker.remove();
        removedRoots.push(entry.root);
        markers.delete(key);
      }
      // Defer React root unmounting outside the current render cycle to avoid
      // the "synchronously unmount a root while React was already rendering" warning
      if (removedRoots.length) setTimeout(() => removedRoots.forEach((r) => r.unmount()), 0);
    };

    // Creates or updates one pin's marker and returns its key
    function syncPin(pin, selected) {
      const key = `pin:${pin.id}`;
      const number = stopNumbers?.[pin.id] ?? null;
      const entry = markers.get(key) ?? createMarker(key, pin.lngLat, (el) => {
        el.dataset.pinId = pin.id;
        el.addEventListener("click", () => {
          // Ignore marker clicks during placement mode — user is picking a location
          if (placementModeRef.current) return;
          onPinClickRef.current?.(clusterStateRef.current.pinsById.get(pin.id) ?? pin);
        });
      });
      const hasPhotos = pinImages(pin).length > 0;
      const signature = JSON.stringify([pin.icon, pin.label, pin.lngLat, number, selected, hasPhotos]);
      if (entry.signature !== signature) {
        entry.marker.setLngLat(pin.lngLat);
        entry.el.setAttribute("aria-label", pinAriaLabel(pin, number, hasPhotos));
        if (selected) entry.el.setAttribute("aria-current", "true");
        else entry.el.removeAttribute("aria-current");
        // Lifts the selected marker above every other marker and cluster
        // (they're all siblings with no z-index of their own). MapLibre
        // doesn't set z-index on marker elements, so this is safe to own.
        entry.el.style.zIndex = selected ? "10" : "";
        entry.root.render(<MarkerPin icon={pin.icon} number={number} selected={selected} hasPhotos={hasPhotos} />);
        entry.signature = signature;
      }
      placeInStopOrder(entry.el, number ?? Number.MAX_SAFE_INTEGER);
      return key;
    }

    if (map.loaded() || map.isStyleLoaded()) {
      renderMarkers();
    } else {
      map.once("load", renderMarkers);
    }

    map.on("moveend", renderMarkers);
    return () => {
      map.off("moveend", renderMarkers);
      map.off("load", renderMarkers);
    };
  }, [mapRef, pins, stopNumbers, selectedPinId, pinnedKey]);

  // The stop the visitor is about to step to (hovering Previous/Next) shows
  // its marker in the hover state, so they can see where they're going.
  // When that stop is inside a cluster, the cluster lights up instead.
  // Re-applied when markers change, since a marker can be rebuilt.
  useEffect(() => {
    const markers = markersRef.current;
    let target = previewPinId && markers.has(`pin:${previewPinId}`) ? `pin:${previewPinId}` : null;
    if (previewPinId && !target) {
      const { index } = clusterStateRef.current;
      for (const key of markers.keys()) {
        if (!key.startsWith("cluster:") || !index) continue;
        let leaves = [];
        try {
          leaves = index.getLeaves(Number(key.slice("cluster:".length)), Infinity);
        } catch {
          // Supercluster throws for an id that isn't in the current index
          // (a marker from before the pins changed); just skip it
        }
        if (leaves.some((leaf) => leaf.properties.pinId === previewPinId)) {
          target = key;
          break;
        }
      }
    }
    for (const [key, entry] of markers) entry.el.toggleAttribute("data-preview", key === target);
  }, [previewPinId, pins, selectedPinId, pinnedKey]);

  // Small, quiet dots for points that aren't markers: every trip's stops
  // behind the trip chooser on the landing page, so the map isn't empty
  // there. A map layer rather than DOM markers: there can be a lot of them,
  // and they're not meant to be clicked.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const data = {
      type: "FeatureCollection",
      features: (backgroundPoints ?? []).map((coordinates) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates } })),
    };
    const apply = () => {
      const source = map.getSource(BACKGROUND_SOURCE);
      if (source) {
        source.setData(data);
        return;
      }
      map.addSource(BACKGROUND_SOURCE, { type: "geojson", data });
      map.addLayer({
        id: BACKGROUND_SOURCE,
        type: "circle",
        source: BACKGROUND_SOURCE,
        paint: { "circle-radius": 3, "circle-color": MUTED, "circle-opacity": 0.7 },
      });
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
    return () => map.off("load", apply);
  }, [mapRef, backgroundPoints]);

  // Handle placement mode: crosshair cursor, preview marker, click to pick
  const previewMarkerRef = useRef(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!placementMode) {
      map.getCanvas().style.cursor = "";
      previewMarkerRef.current?.remove();
      previewMarkerRef.current = null;
      return;
    }

    map.getCanvas().style.cursor = "crosshair";

    // Ghost marker that follows the cursor so the user can see where the pin will land
    previewMarkerRef.current = new maplibregl.Marker({ color: "#2563eb", opacity: "0.5" })
      .setLngLat(map.getCenter())
      .addTo(map);

    const onMouseMove = (e) => previewMarkerRef.current?.setLngLat(e.lngLat);
    const onClick = (e) => onLocationPick?.(e.lngLat);

    map.on("mousemove", onMouseMove);
    map.on("click", onClick);

    return () => {
      map.off("mousemove", onMouseMove);
      map.off("click", onClick);
      map.getCanvas().style.cursor = "";
      previewMarkerRef.current?.remove();
      previewMarkerRef.current = null;
    };
  }, [mapRef, placementMode, onLocationPick]);

  if (initError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-paper text-muted text-center p-6">
        <p>{initError}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {clusterList && (
        <ClusterList
          pins={clusterList.pins}
          stopNumbers={stopNumbers}
          x={clusterList.x}
          y={clusterList.y}
          containerWidth={clusterList.width}
          containerHeight={clusterList.height}
          onPick={(pin) => {
            setClusterList(null);
            onPinClickRef.current?.(pin);
          }}
          onClose={() => {
            clusterList.returnFocusTo?.focus();
            setClusterList(null);
          }}
        />
      )}
    </div>
  );
}
