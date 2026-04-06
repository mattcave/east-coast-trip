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
  vi.stubEnv("STADIA_API_KEY", "test-key");
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

  it("calls Stadia autocomplete with the query text", async () => {
    mockFetch([]);
    await GET(makeRequest("Halifax"));
    const [calledUrl] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(calledUrl.toString()).toContain("api.stadiamaps.com/geocoding/v1/autocomplete");
    expect(calledUrl.toString()).toContain("text=Halifax");
  });

  it("includes the API key from env — never from client", async () => {
    mockFetch([]);
    await GET(makeRequest("Halifax"));
    const [calledUrl] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(calledUrl.toString()).toContain("api_key=test-key");
  });

  it("returns the features array from the upstream response", async () => {
    const features = [{ properties: { label: "Halifax, NS" } }];
    mockFetch(features);
    const res = await GET(makeRequest("Halifax"));
    expect(await res.json()).toEqual(features);
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
