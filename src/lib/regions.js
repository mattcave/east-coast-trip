// A stop's province or state ("New Brunswick", "New York"), looked up on
// the server with Mapbox reverse geocoding. Shown on postcards and the
// finish card. Server-only: it reads MAPBOX_TOKEN.

// A slow lookup mustn't hold up saving a pin for long
const LOOKUP_TIMEOUT_MS = 5000;

// The region at [lng, lat], or null when there isn't one (out at sea) or
// the lookup fails for any reason. Callers save the pin without a region
// then, so a Mapbox outage never blocks an edit.
export async function lookupRegion(lngLat) {
  if (!Array.isArray(lngLat) || lngLat.length !== 2 || !lngLat.every(Number.isFinite)) return null;
  const token = process.env.MAPBOX_TOKEN;
  if (!token) return null;
  const [lng, lat] = lngLat;
  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("types", "region");
  // English names, so it's "Quebec" next to "New Brunswick", not "Québec"
  url.searchParams.set("language", "en");
  url.searchParams.set("limit", "1");
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
    if (!res.ok) return null;
    const data = await res.json();
    const name = data?.features?.[0]?.text;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  } catch {
    return null;
  }
}

export const sameLngLat = (a, b) =>
  Array.isArray(a) && Array.isArray(b) && a.length === 2 && b.length === 2 && a[0] === b[0] && a[1] === b[1];
