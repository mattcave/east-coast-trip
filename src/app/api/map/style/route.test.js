import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route.js";

const SAMPLE_STYLE = {
  version: 8,
  sprite: "https://tiles.stadiamaps.com/sprites/outdoors",
  glyphs: "https://tiles.stadiamaps.com/fonts/{fontstack}/{range}.pbf?api_key=SECRET",
  sources: {
    openmaptiles: {
      tiles: ["https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}.pbf?api_key=SECRET"],
    },
  },
};

function makeRequest() {
  return new NextRequest("http://localhost/api/map/style");
}

beforeEach(() => {
  vi.stubEnv("STADIA_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/map/style", () => {
  it("fetches the Stadia style with the API key server-side", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => SAMPLE_STYLE,
    });
    await GET(makeRequest());
    const [calledUrl] = spy.mock.calls[0];

    expect(calledUrl).toContain("tiles.stadiamaps.com/styles/outdoors.json");
    expect(calledUrl).toContain("api_key=test-key");
  });

  it("rewrites Stadia tile URLs to go through the local proxy", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => SAMPLE_STYLE,
    });
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(JSON.stringify(body)).toContain("http://localhost:3000/api/map/proxy/");
    expect(JSON.stringify(body)).not.toContain("tiles.stadiamaps.com");
  });

  it("strips api_key from the rewritten URLs", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => SAMPLE_STYLE,
    });
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("api_key");
  });

  it("returns 502 when upstream fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: false });
    const res = await GET(makeRequest());
    expect(res.status).toBe(502);
  });

  it("sets content-type and cache-control headers", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => SAMPLE_STYLE,
    });
    const res = await GET(makeRequest());
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
