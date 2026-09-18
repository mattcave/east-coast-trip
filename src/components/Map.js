"use client";

import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
// maplibre-gl v6 ships ESM-only with no default export
import * as maplibregl from "maplibre-gl";
import Supercluster from "supercluster";
import "maplibre-gl/dist/maplibre-gl.css";
import { PIN_ICONS } from "@/lib/icons";

// Bounds: Toronto (west) to Sydney NS (east)
const DEFAULT_CENTER = [-69.8, 45.2];
const DEFAULT_ZOOM = 5.5;

// Pixel radius (at the current zoom) within which pins are grouped into a
// cluster, and the zoom past which they always render individually.
const CLUSTER_RADIUS = 40;
const CLUSTER_MAX_ZOOM = 16;

function MarkerPin({ icon }) {
  const { icon: Icon, color } = PIN_ICONS[icon] ?? PIN_ICONS.default;
  return (
    <div style={{
      background: color,
      borderRadius: "50%",
      width: 36,
      height: 36,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: "2px solid white",
      boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
      cursor: "pointer",
    }}>
      <Icon size={18} color="white" />
    </div>
  );
}

function ClusterBadge({ count }) {
  // Bigger badge for bigger clusters, capped so it doesn't get absurd
  const size = Math.min(36 + Math.log2(count) * 6, 60);
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
      cursor: "pointer",
      fontSize: 13,
      fontWeight: 600,
    }}>
      {count}
    </div>
  );
}

export default function Map({ pins = [], placementMode = false, onLocationPick, onPinClick }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [initError, setInitError] = useState(null);
  const markersRef = useRef([]);      // MapLibre Marker instances
  const markerRootsRef = useRef([]);  // React roots rendered into each marker element
  const clusterIndexRef = useRef(null);
  const previewMarkerRef = useRef(null);
  // Refs so marker clicks always call the latest callbacks without re-creating markers
  const onPinClickRef = useRef(onPinClick);
  useEffect(() => { onPinClickRef.current = onPinClick; });
  const placementModeRef = useRef(placementMode);
  useEffect(() => { placementModeRef.current = placementMode; });

  // Expose mapRef so parent components can call flyTo etc.
  Map.mapRef = mapRef;

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
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        minZoom: DEFAULT_ZOOM - 0.75,
      });
    } catch {
      setInitError("The map couldn't start, possibly because WebGL is disabled or unavailable.");
      return;
    }

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-left");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    // Home button — returns the map to the default center and zoom
    const homeBtn = document.createElement("button");
    homeBtn.className = "maplibregl-ctrl-icon";
    homeBtn.title = "Reset view";
    homeBtn.style.cssText = "display:flex; align-items:center; justify-content:center;";
    homeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`;
    homeBtn.addEventListener("click", () => {
      map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
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

    return () => {
      markersRef.current.forEach((m) => m.remove());
      // Deferred (not synchronous) for the same reason as the marker
      // re-render effect below: unmounting a React root synchronously
      // while React is still mid-render (e.g. during Fast Refresh teardown)
      // triggers "Attempted to synchronously unmount a root..." warnings.
      const rootsToUnmount = [...markerRootsRef.current];
      markerRootsRef.current = [];
      setTimeout(() => rootsToUnmount.forEach((r) => r.unmount()), 0);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Rebuild the cluster index whenever the pins array changes. Pins that are
  // close together (or at the same coordinates) get grouped into a single
  // bubble showing how many are there, instead of fully overlapping and
  // hiding each other with no indication more than one pin exists.
  useEffect(() => {
    clusterIndexRef.current = new Supercluster({
      radius: CLUSTER_RADIUS,
      maxZoom: CLUSTER_MAX_ZOOM,
    }).load(
      pins.map((pin) => ({
        type: "Feature",
        properties: { pinId: pin.id },
        geometry: { type: "Point", coordinates: pin.lngLat },
      }))
    );
  }, [pins]);

  // Re-render markers (clusters + individual pins) whenever the pins array
  // changes or the map's viewport changes, since cluster membership depends
  // on both.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const renderMarkers = () => {
      const index = clusterIndexRef.current;
      if (!index) return;

      // Remove existing MapLibre markers from the map
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // Defer React root unmounting outside the current render cycle to avoid
      // the "synchronously unmount a root while React was already rendering" warning
      const rootsToUnmount = [...markerRootsRef.current];
      markerRootsRef.current = [];
      setTimeout(() => rootsToUnmount.forEach((r) => r.unmount()), 0);

      const bounds = map.getBounds();
      const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
      const zoom = Math.floor(map.getZoom());
      const clusters = index.getClusters(bbox, zoom);

      clusters.forEach((feature) => {
        const [lng, lat] = feature.geometry.coordinates;
        const el = document.createElement("div");
        const root = createRoot(el);
        markerRootsRef.current.push(root);

        if (feature.properties.cluster) {
          const { cluster_id: clusterId, point_count: count } = feature.properties;
          root.render(<ClusterBadge count={count} />);
          el.addEventListener("click", () => {
            if (placementModeRef.current) return;
            const expansionZoom = Math.min(index.getClusterExpansionZoom(clusterId), CLUSTER_MAX_ZOOM + 1);
            map.flyTo({ center: [lng, lat], zoom: expansionZoom });
          });
        } else {
          const pin = pins.find((p) => p.id === feature.properties.pinId);
          if (!pin) return;
          root.render(<MarkerPin icon={pin.icon} />);
          el.dataset.pinId = pin.id;
          el.addEventListener("click", () => {
            // Ignore marker clicks during placement mode — user is picking a location
            if (!placementModeRef.current) {
              onPinClickRef.current?.(pin);
            }
          });
        }

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(map);
        markersRef.current.push(marker);
      });
    };

    if (map.isStyleLoaded()) {
      renderMarkers();
    } else {
      map.once("load", renderMarkers);
    }

    map.on("moveend", renderMarkers);
    return () => map.off("moveend", renderMarkers);
  }, [pins]);

  // Handle placement mode: crosshair cursor, preview marker, click to pick
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
  }, [placementMode, onLocationPick]);

  if (initError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-600 text-center p-6">
        <p>{initError}</p>
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full" />;
}
