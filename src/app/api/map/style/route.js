export async function GET(request) {
  const res = await fetch(
    `https://tiles.stadiamaps.com/styles/outdoors.json?api_key=${process.env.STADIA_API_KEY}`,
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) return new Response("Failed to load map style", { status: 502 });

  const style = await res.json();

  // Build the public-facing origin from the Host header rather than
  // request.nextUrl.origin, which resolves to the bind address (0.0.0.0)
  // in Docker and breaks client-side tile and sprite requests.
  const host = request.headers.get("host") ?? "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const json = JSON.stringify(style)
    .replaceAll("https://tiles.stadiamaps.com/", `${origin}/api/map/proxy/`)
    .replace(/[?&]api_key=[^"& ]*/g, "");

  return new Response(json, {
    headers: {
      "content-type": "application/json",
      // No browser cache — the origin URL is request-dependent, and the
      // server-side fetch cache already avoids round-trips to Stadia.
      "cache-control": "no-store",
    },
  });
}
