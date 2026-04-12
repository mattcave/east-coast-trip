// Wikipedia API requires a descriptive User-Agent for server-side requests
const WP_HEADERS = { "User-Agent": "east-coast-trip/1.0 (https://github.com/mattcave/east-coast-trip)" };

async function fetchSummary(title) {
  const res = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    { headers: WP_HEADERS }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return {
    title: data.title,
    extract: data.extract,
    url: data.content_urls.desktop.page,
    thumbnail: data.thumbnail?.source ?? null,
  };
}

export async function GET(request) {
  const { searchParams } = request.nextUrl;
  const url = searchParams.get("url");
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  try {
    if (url) {
      // Specific article — extract title from Wikipedia URL
      const title = decodeURIComponent(url.split("/wiki/").pop());
      const result = await fetchSummary(title);
      return Response.json(result, {
        headers: { "Cache-Control": "public, s-maxage=86400" },
      });
    }

    if (lat && lng) {
      // Find nearest Wikipedia article to these coordinates
      const geoUrl = new URL("https://en.wikipedia.org/w/api.php");
      geoUrl.searchParams.set("action", "query");
      geoUrl.searchParams.set("list", "geosearch");
      geoUrl.searchParams.set("gscoord", `${lat}|${lng}`);
      geoUrl.searchParams.set("gsradius", "10000");
      geoUrl.searchParams.set("gslimit", "1");
      geoUrl.searchParams.set("format", "json");

      const geoRes = await fetch(geoUrl, { headers: WP_HEADERS });
      if (!geoRes.ok) return Response.json(null);

      const geoData = await geoRes.json();
      const title = geoData.query?.geosearch?.[0]?.title;
      if (!title) return Response.json(null);

      const result = await fetchSummary(title);
      return Response.json(result, {
        headers: { "Cache-Control": "public, s-maxage=86400" },
      });
    }
  } catch {
    // fall through
  }

  return Response.json(null);
}
