"use client";

import { useState, useRef } from "react";

export default function GeoSearch({ mapRef, onCancel, onAutoPlace }) {
  const [query, setQuery] = useState("");
  const [placeResults, setPlaceResults] = useState([]);
  const [wikiResults, setWikiResults] = useState([]);
  const [searchError, setSearchError] = useState(false);
  const debounceRef = useRef(null);

  const search = (text) => {
    setQuery(text);
    setSearchError(false);
    clearTimeout(debounceRef.current);

    if (!text.trim()) {
      setPlaceResults([]);
      setWikiResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const [placeRes, wikiRes] = await Promise.all([
          fetch(`/api/geocode?q=${encodeURIComponent(text)}`),
          fetch(`/api/wikipedia/search?q=${encodeURIComponent(text)}`),
        ]);

        if (placeRes.ok) setPlaceResults(await placeRes.json());
        if (wikiRes.ok) setWikiResults(await wikiRes.json());
        if (!placeRes.ok && !wikiRes.ok) setSearchError(true);
      } catch {
        setSearchError(true);
      }
    }, 300);
  };

  const clearResults = () => { setPlaceResults([]); setWikiResults([]); };

  const selectPlace = (feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 12 });
    clearResults();
    setQuery(feature.properties.label);
  };

  const selectWiki = (result) => {
    mapRef.current?.flyTo({ center: [result.lng, result.lat], zoom: 12 });
    clearResults();
    setQuery(result.title);
    // Auto-place the pin, pre-filling label and wikipedia URL from the article
    onAutoPlace?.({ lng: result.lng, lat: result.lat }, {
      label: result.title,
      wikipedia: result.url,
    });
  };

  const hasResults = placeResults.length > 0 || wikiResults.length > 0;

  return (
    <div className="absolute top-4 left-12 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-96 z-20">
      <div className="relative">
        <input
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Search places or Wikipedia…"
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
          <div className="absolute top-full mt-1 w-full bg-white rounded-lg shadow-lg border border-red-200 px-4 py-3 text-sm text-red-600">
            Search unavailable — click the map to place your pin manually.
          </div>
        )}

        {!searchError && hasResults && (
          <div className="absolute top-full mt-1 w-full z-30 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
            {placeResults.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                  Places
                </div>
                {placeResults.slice(0, 5).map((f) => (
                  <button
                    key={f.properties.id}
                    onClick={() => selectPlace(f)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-800 border-b border-gray-100 last:border-0 transition-colors"
                  >
                    {f.properties.label}
                  </button>
                ))}
              </>
            )}

            {wikiResults.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                  Wikipedia
                </div>
                {wikiResults.map((r) => (
                  <button
                    key={r.url}
                    onClick={() => selectWiki(r)}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors"
                  >
                    <div className="text-sm font-medium text-gray-800">{r.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">{r.extract}</div>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
