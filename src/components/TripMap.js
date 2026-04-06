"use client";

import { useState, useRef } from "react";
import { Pencil } from "lucide-react";
import Map from "./Map";
import GeoSearch from "./GeoSearch";
import EditorModal from "./EditorModal";

export default function TripMap({ initialPins, isAuthenticated }) {
  const [pins, setPins] = useState(initialPins);
  const [modalOpen, setModalOpen] = useState(false);
  const [placementMode, setPlacementMode] = useState(false);
  const [editTargetId, setEditTargetId] = useState(null);

  // Stored callback from the form's "Pick on map" button.
  // Called with the picked lngLat when the user clicks the map.
  const onPickCallbackRef = useRef(null);
  const pickingPinIdRef = useRef(null);

  const refreshPins = async () => {
    const res = await fetch("/api/pins");
    setPins(await res.json());
  };

  const startPlacement = (callback, pinId = null) => {
    onPickCallbackRef.current = callback;
    pickingPinIdRef.current = pinId;
    setPlacementMode(true);
    setModalOpen(false);
  };

  const handleLocationPick = (lngLat) => {
    onPickCallbackRef.current?.(lngLat);
    onPickCallbackRef.current = null;

    // Optimistically reposition the pin on the map before the form is saved,
    // so the marker moves immediately instead of waiting for the API round-trip.
    const pinId = pickingPinIdRef.current;
    if (pinId) {
      const lngLatArray = [lngLat.lng, lngLat.lat];
      setPins((prev) => prev.map((p) => p.id === pinId ? { ...p, lngLat: lngLatArray } : p));
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

  return (
    <div className="relative w-full h-full">
      <Map
        pins={pins}
        placementMode={placementMode}
        onLocationPick={handleLocationPick}
        onEditPin={(id) => { setEditTargetId(id); setModalOpen(true); }}
      />

      {/* Floating search box shown during placement mode */}
      {placementMode && (
        <GeoSearch
          mapRef={Map.mapRef}
          onCancel={cancelPlacement}
        />
      )}

      {/* Admin button — top-right, aligned with the panel it opens */}
      {isAuthenticated && !placementMode && (
        <button
          onClick={() => setModalOpen(true)}
          className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium px-3 py-2 rounded-lg shadow-md border border-gray-200 transition-colors"
        >
          <Pencil size={14} />
          Admin
        </button>
      )}

      {/* Editor side panel — kept mounted during placement mode so form state
          (including partially-filled fields) survives the pick flow */}
      {(modalOpen || placementMode) && (
        <div className={placementMode ? "hidden" : undefined}>
          <EditorModal
            pins={pins}
            onClose={() => setModalOpen(false)}
            onStartPlacement={startPlacement}
            onRefresh={refreshPins}
            onFlyTo={(lngLat) => Map.mapRef.current?.flyTo({ center: lngLat, zoom: 12 })}
            editTargetId={editTargetId}
            onEditTargetConsumed={() => setEditTargetId(null)}
          />
        </div>
      )}
    </div>
  );
}
