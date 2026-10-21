import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route.js";

function makeRequest(q) {
  const url = q !== undefined
    ? `http://localhost/api/geocode?q=${encodeURIComponent(q)}`
    : "http://localhost/api/geocode";
  return new NextRequest(url);
}

function mockFetch(features, { ok = true } = {}) {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
    ok,
    json: async () => ({ features }),
  });
}

beforeEach(() => {
  vi.stubEnv("MAPBOX_TOKEN", "test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/geocode", () => {
  it("returns [] immediately for a missing query — no fetch", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const res = await GET(makeRequest(undefined));
    expect(await res.json()).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns [] immediately for a whitespace-only query — no fetch", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const res = await GET(makeRequest("   "));
    expect(await res.json()).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("calls Mapbox places autocomplete with the query text, limited to the trip bbox", async () => {
    mockFetch([]);
    await GET(makeRequest("Halifax"));
    const [calledUrl] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(calledUrl.toString()).toContain("api.mapbox.com/geocoding/v5/mapbox.places/Halifax.json");
    expect(calledUrl.searchParams.get("autocomplete")).toBe("true");
    expect(calledUrl.searchParams.get("bbox")).toBe("-80,40,-52,52");
  });

  it("includes the API key from env — never from client", async () => {
    mockFetch([]);
    await GET(makeRequest("Halifax"));
    const [calledUrl] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(calledUrl.toString()).toContain("access_token=test-key");
  });

  it("normalizes Mapbox features to { geometry, properties: { id, label } }", async () => {
    const geometry = { type: "Point", coordinates: [-63.57, 44.65] };
    mockFetch([{ id: "place.123", place_name: "Halifax, Nova Scotia, Canada", geometry, text: "Halifax" }]);
    const res = await GET(makeRequest("Halifax"));
    expect(await res.json()).toEqual([
      { geometry, properties: { id: "place.123", label: "Halifax, Nova Scotia, Canada" } },
    ]);
  });

  it("returns [] when upstream responds with a non-OK status", async () => {
    mockFetch([], { ok: false });
    const res = await GET(makeRequest("Halifax"));
    expect(await res.json()).toEqual([]);
  });

  it("returns [] on a network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network error"));
    const res = await GET(makeRequest("Halifax"));
    expect(await res.json()).toEqual([]);
  });
});
