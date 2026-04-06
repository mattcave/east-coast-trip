// Proxies all MapLibre tile/sprite/glyph requests to Stadia Maps, adding the
// API key server-side so it is never exposed in the client bundle or network requests.
export async function GET(request, { params }) {
  const { path } = await params;
  const pathStr = path.join("/");

  const url = new URL(`https://tiles.stadiamaps.com/${pathStr}`);
  // Forward any query params from the original request (e.g. language, format hints)
  request.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));
  url.searchParams.set("api_key", process.env.STADIA_API_KEY);

  const res = await fetch(url, {
    next: { revalidate: 86400 }, // Cache tiles for 24 hours
  });

  const headers = new Headers();
  const ct = res.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  headers.set("cache-control", "public, max-age=86400, stale-while-revalidate=604800");

  return new Response(res.body, { status: res.status, headers });
}
