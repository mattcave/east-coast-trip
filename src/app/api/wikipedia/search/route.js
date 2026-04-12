// Wikipedia API requires a descriptive User-Agent for server-side requests
const WP_HEADERS = { "User-Agent": "east-coast-trip/1.0 (https://github.com/mattcave/east-coast-trip)" };

export async function GET(request) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q?.trim()) return Response.json([]);

  try {
    // 1. Search Wikipedia for matching page titles
    const searchUrl = new URL("https://en.wikipedia.org/w/api.php");
    searchUrl.searchParams.set("action", "query");
    searchUrl.searchParams.set("list", "search");
    searchUrl.searchParams.set("srsearch", q);
    searchUrl.searchParams.set("srlimit", "5");
    searchUrl.searchParams.set("format", "json");

    const searchRes = await fetch(searchUrl, { headers: WP_HEADERS });
    if (!searchRes.ok) return Response.json([]);

    const searchData = await searchRes.json();
    const titles = searchData.query?.search?.map((r) => r.title) ?? [];
    if (titles.length === 0) return Response.json([]);

    // 2. Fetch summaries + batch coordinate lookup in parallel.
    //    The REST summary API only returns coordinates for articles that use
    //    {{coord|...|display=title}}. Many infoboxes (artwork, building, etc.)
    //    use a bare {{coord}} which the summary API ignores. The MediaWiki
    //    prop=coordinates endpoint with coprimary=all reads all coord templates,
    //    so we use it as a fallback for articles the summary API misses.
    const coordsUrl = new URL("https://en.wikipedia.org/w/api.php");
    coordsUrl.searchParams.set("action", "query");
    coordsUrl.searchParams.set("titles", titles.join("|"));
    coordsUrl.searchParams.set("prop", "coordinates");
    coordsUrl.searchParams.set("coprimary", "all");
    coordsUrl.searchParams.set("format", "json");

    const [summaries, coordsRes] = await Promise.all([
      Promise.all(
        titles.map((title) =>
          fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { headers: WP_HEADERS })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        )
      ),
      fetch(coordsUrl, { headers: WP_HEADERS })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);

    // Build title → {lat, lng} map from the MediaWiki batch lookup
    const coordsByTitle = {};
    if (coordsRes?.query?.pages) {
      for (const page of Object.values(coordsRes.query.pages)) {
        if (page.coordinates?.length > 0) {
          coordsByTitle[page.title] = { lat: page.coordinates[0].lat, lng: page.coordinates[0].lon };
        }
      }
    }

    const results = summaries
      .filter((s) => s)
      .map((s) => {
        // Prefer REST API coords; fall back to MediaWiki infobox coords
        const coords = s.coordinates
          ? { lat: s.coordinates.lat, lng: s.coordinates.lon }
          : (coordsByTitle[s.title] ?? { lat: null, lng: null });
        return {
          title: s.title,
          extract: s.extract,
          url: s.content_urls.desktop.page,
          lat: coords.lat,
          lng: coords.lng,
        };
      });

    return Response.json(results, {
      headers: { "Cache-Control": "public, s-maxage=3600" },
    });
  } catch {
    return Response.json([]);
  }
}
