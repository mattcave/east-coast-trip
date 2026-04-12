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

    // 2. Fetch summaries in parallel; only keep articles that have coordinates
    const summaries = await Promise.all(
      titles.map((title) =>
        fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { headers: WP_HEADERS })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    );

    const results = summaries
      .filter((s) => s?.coordinates)
      .map((s) => ({
        title: s.title,
        extract: s.extract,
        url: s.content_urls.desktop.page,
        lat: s.coordinates.lat,
        lng: s.coordinates.lon,
      }));

    return Response.json(results, {
      headers: { "Cache-Control": "public, s-maxage=3600" },
    });
  } catch {
    return Response.json([]);
  }
}
