export async function GET(request) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q?.trim()) return Response.json([]);

  const url = new URL("https://api.stadiamaps.com/geocoding/v1/autocomplete");
  url.searchParams.set("text", q);
  url.searchParams.set("api_key", process.env.STADIA_API_KEY);

  try {
    const res = await fetch(url);
    if (!res.ok) return Response.json([]);
    const data = await res.json();
    return Response.json(data.features ?? []);
  } catch {
    return Response.json([]);
  }
}
