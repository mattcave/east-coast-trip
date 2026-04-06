export async function GET(request) {
  const res = await fetch(
    `https://tiles.stadiamaps.com/styles/outdoors.json?api_key=${process.env.STADIA_API_KEY}`,
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) return new Response("Failed to load map style", { status: 502 });

  const style = await res.json();

  // Rewrite all Stadia URLs in the style to go through our tile proxy so the
  // API key is never sent to the client — it's added server-side in /api/map/[...path].
  const origin = request.nextUrl.origin;
  const json = JSON.stringify(style)
    .replaceAll("https://tiles.stadiamaps.com/", `${origin}/api/map/proxy/`)
    .replace(/[?&]api_key=[^"& ]*/g, "");

  return new Response(json, {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=3600",
    },
  });
}
