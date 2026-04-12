"use client";

import { useState, useRef } from "react";

export default function GeoSearch({ mapRef, onCancel }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchError, setSearchError] = useState(false);
  const debounceRef = useRef(null);

  const search = (text) => {
    setQuery(text);
    setSearchError(false);
    clearTimeout(debounceRef.current);

    if (!text.trim()) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(text)}`);
        if (res.ok) {
          setResults(await res.json());
        } else {
          setSearchError(true);
        }
      } catch {
        setSearchError(true);
      }
    }, 300);
  };

  const select = (feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 12 });
    setResults([]);
    setQuery(feature.properties.label);
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-96 max-w-[90vw]">
      <div className="relative">
        <input
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Search for a place…"
          className="w-full pl-4 pr-20 py-2.5 rounded-lg shadow-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        <button
          onClick={onCancel}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
        >
          Cancel
        </button>
        {searchError && (
          <div className="absolute mt-1 w-full bg-white rounded-lg shadow-lg border border-red-200 px-4 py-3 text-sm text-red-600">
            Search unavailable — click the map to place your pin manually.
          </div>
        )}
        {!searchError && results.length > 0 && (
          <ul className="absolute mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
            {results.slice(0, 6).map((f) => (
              <li
                key={f.properties.id}
                onClick={() => select(f)}
                className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer text-sm text-gray-800 border-b border-gray-100 last:border-0"
              >
                {f.properties.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
