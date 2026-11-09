"use client";

import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
// maplibre-gl v6 ships ESM-only with no default export
import * as maplibregl from "maplibre-gl";
import Supercluster from "supercluster";
import "maplibre-gl/dist/maplibre-gl.css";
import { PIN_ICONS } from "@/lib/icons";
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

// Shared by every marker <button>. Tailwind's preflight already strips the
// button chrome; this adds a visible keyboard focus ring.
const MARKER_BUTTON_CLASS = "block rounded-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

function MarkerPin({ icon, number, selected }) {
  const { icon: Icon, color } = PIN_ICONS[icon] ?? PIN_ICONS.default;
  return (
    <div
      style={{
        position: "relative",
        background: color,
        borderRadius: "50%",
        width: 36,
        height: 36,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "2px solid white",
        boxShadow: selected ? "0 0 0 3px rgba(37,99,235,0.6), 0 3px 10px rgba(0,0,0,0.45)" : "0 2px 6px rgba(0,0,0,0.35)",
        // Scaled here rather than on the marker element, whose transform
        // MapLibre owns for positioning
        transform: selected ? "scale(1.25)" : undefined,
        transition: "transform 150ms ease-out",
      }}
    >
      <Icon size={18} color="white" />
      {number != null && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: -6,
            right: -8,
            minWidth: 18,
            height: 18,
            padding: "0 4px",
            borderRadius: 9,
            background: "#1f2937",
            color: "white",
            border: "1.5px solid white",
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

function ClusterBadge({ count }) {
  // Same size as a pin marker, whatever the count. Scaling the badge with
  // the count made big clusters loom over the pins around them; the number
  // already says how many stops are inside.
  const size = 36;
  return (
    <div style={{
      background: "#1f2937",
      color: "white",
      borderRadius: "50%",
      width: size,
      height: size,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: "2px solid white",
      boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
      fontSize: 13,
      fontWeight: 600,
    }}>
      {count}
    </div>
  );
}

function pinAriaLabel(pin, number) {
  const category = (PIN_ICONS[pin.icon] ?? PIN_ICONS.default).label;
  return number != null ? `Stop ${number}: ${pin.label}, ${category}` : `${pin.label}, ${category}`;
}

// homeView is the current trip's view (see tripHomeView): where the map
// starts, and where the Home button returns to. Moving the map when the trip
// changes is up to the parent, since only it knows a switch happened.
//
// pins arrive in stop order; stopNumbers maps pin id -> stop number (kept
// separate so a filtered list doesn't renumber). The selected pin is always
// drawn on its own, highlighted, never inside a cluster, so stepping
// through stops can't land on one hidden in a bubble.
export default function Map({
  mapRef, pins = [], stopNumbers = null, selectedPinId = null, homeView = null,
  placementMode = false, onLocationPick, onPinClick, onMapClick,
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

  useEffect(() => {
    if (mapRef.current) return;

    // Turbopack can't statically bundle the worker maplibre-gl resolves
    // internally via new URL(...); without this, the tile-processing worker
    // silently fails to load and no vector tiles ever get requested.
    maplibregl.setWorkerUrl("/api/map/worker/maplibre-gl-worker.mjs");

    let map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: "/api/map/style",
        ...initialMapOptions(homeViewRef.current),
        minZoom: MIN_ZOOM,
      });
    } catch {
      // MapLibre throws synchronously when WebGL is unavailable, and that's
      // only discoverable by trying, so the fallback has to be set from here
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInitError("The map couldn't start, possibly because WebGL is disabled or unavailable.");
      return;
    }

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-left");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    // Home button — returns the map to the current trip's view
    const homeBtn = document.createElement("button");
    homeBtn.className = "maplibregl-ctrl-icon";
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
    const index = new Supercluster({ radius: CLUSTER_RADIUS, maxZoom: CLUSTER_MAX_ZOOM }).load(
      pins
        .filter((pin) => pin !== selectedPin)
        .map((pin) => ({
          type: "Feature",
          properties: { pinId: pin.id },
          geometry: { type: "Point", coordinates: pin.lngLat },
        }))
    );
    clusterStateRef.current = { index, pins, pinsById };
    const markers = markersRef.current;

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
          const { cluster_id: clusterId, point_count: count } = feature.properties;
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
          const signature = JSON.stringify([count, lngLat]);
          if (entry.signature !== signature) {
            entry.marker.setLngLat(lngLat);
            entry.el.setAttribute("aria-label", `Cluster of ${count} stops`);
            entry.root.render(<ClusterBadge count={count} />);
            entry.signature = signature;
          }
          continue;
        }

        const pin = pinsById.get(feature.properties.pinId);
        if (pin) wanted.add(syncPin(pin, false));
      }

      // The selected pin isn't in the index, so it's added separately.
      // Always kept, even when off screen, so it doesn't flicker out while
      // the map eases towards it.
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
      const signature = JSON.stringify([pin.icon, pin.label, pin.lngLat, number, selected]);
      if (entry.signature !== signature) {
        entry.marker.setLngLat(pin.lngLat);
        entry.el.setAttribute("aria-label", pinAriaLabel(pin, number));
        if (selected) entry.el.setAttribute("aria-current", "true");
        else entry.el.removeAttribute("aria-current");
        // Lifts the selected marker above its neighbours. MapLibre doesn't
        // set z-index on marker elements, so this is safe to own here.
        entry.el.style.zIndex = selected ? "2" : "";
        entry.root.render(<MarkerPin icon={pin.icon} number={number} selected={selected} />);
        entry.signature = signature;
      }
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
  }, [mapRef, pins, stopNumbers, selectedPinId]);

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
      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-600 text-center p-6">
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
