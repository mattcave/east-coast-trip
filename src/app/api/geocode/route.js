export async function GET(request) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q?.trim()) return Response.json([]);

  const encoded = encodeURIComponent(q);
  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json`);
  url.searchParams.set("access_token", process.env.MAPBOX_TOKEN);
  url.searchParams.set("autocomplete", "true");
  // Bounding box: NE US + Maritime Canada + Quebec corridor
  // SW corner: ~Boston/NY latitude, ~Lake Ontario longitude
  // NE corner: ~northern NB/NS, ~Cape Breton
  url.searchParams.set("bbox", "-80,40,-52,52");
  url.searchParams.set("limit", "6");

  try {
    const res = await fetch(url);
    if (!res.ok) return Response.json([]);
    const data = await res.json();
    // Normalize to the shape GeoSearch expects: geometry.coordinates + properties.{id,label}
    return Response.json(
      (data.features ?? []).map((f) => ({
        geometry: f.geometry,
        properties: { id: f.id, label: f.place_name },
      }))
    );
  } catch {
    return Response.json([]);
  }
}
