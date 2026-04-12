"use client";

import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { PIN_ICONS } from "@/lib/icons";

// Bounds: Toronto (west) to Sydney NS (east)
const DEFAULT_CENTER = [-69.8, 45.2];
const DEFAULT_ZOOM = 5.5;

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

export default function Map({ pins = [], placementMode = false, onLocationPick, onPinClick }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);      // MapLibre Marker instances
  const markerRootsRef = useRef([]);  // React roots rendered into each marker element
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

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "/api/map/style",
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: DEFAULT_ZOOM - 0.75,
    });

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
    map.on("styleimagemissing", (e) => {
      map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markerRootsRef.current.forEach((r) => r.unmount());
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Re-render pin markers whenever the pins array changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const addMarkers = () => {
      // Remove existing MapLibre markers from the map
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // Defer React root unmounting outside the current render cycle to avoid
      // the "synchronously unmount a root while React was already rendering" warning
      const rootsToUnmount = [...markerRootsRef.current];
      markerRootsRef.current = [];
      setTimeout(() => rootsToUnmount.forEach((r) => r.unmount()), 0);

      pins.forEach(({ id, lngLat, label, description, image, icon }) => {
        const el = document.createElement("div");
        const root = createRoot(el);
        root.render(<MarkerPin icon={icon} />);
        markerRootsRef.current.push(root);

        el.dataset.pinId = id;
        el.addEventListener("click", () => {
          // Ignore marker clicks during placement mode — user is picking a location
          if (!placementModeRef.current) {
            onPinClickRef.current?.({ id, lngLat, label, description, image, icon });
          }
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(lngLat)
          .addTo(map);
        markersRef.current.push(marker);
      });
    };

    if (map.isStyleLoaded()) {
      addMarkers();
    } else {
      map.once("load", addMarkers);
    }
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

  return <div ref={containerRef} className="w-full h-full" />;
}
