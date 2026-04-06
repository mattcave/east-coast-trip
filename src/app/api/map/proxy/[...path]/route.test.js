import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route.js";

// Next.js 16 passes params as a Promise
const makeParams = (path) => ({ params: Promise.resolve({ path }) });

function makeRequest(path, queryString = "") {
  return new NextRequest(`http://localhost/api/map/proxy/${path}${queryString}`);
}

function mockUpstream({ ok = true, status = 200, contentType = "application/x-protobuf", body = "tile-data" } = {}) {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
    ok,
    status,
    headers: new Headers(contentType ? { "content-type": contentType } : {}),
    body,
  });
}

beforeEach(() => {
  vi.stubEnv("STADIA_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/map/proxy/[...path]", () => {
  it("forwards the path to Stadia Maps", async () => {
    const spy = mockUpstream();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true, status: 200,
      headers: new Headers({ "content-type": "application/x-protobuf" }),
      body: null,
    });
    await GET(makeRequest("tiles/outdoors/5/10/20.pbf"), makeParams(["tiles", "outdoors", "5", "10", "20.pbf"]));
    const [calledUrl] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(calledUrl.toString()).toContain("tiles.stadiamaps.com/tiles/outdoors/5/10/20.pbf");
  });

  it("adds the API key to the upstream request", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true, status: 200,
      headers: new Headers({ "content-type": "application/x-protobuf" }),
      body: null,
    });
    await GET(makeRequest("tiles/outdoors/5/10/20.pbf"), makeParams(["tiles", "outdoors", "5", "10", "20.pbf"]));
    const [calledUrl] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(calledUrl.toString()).toContain("api_key=test-key");
  });

  it("forwards query params from the original request", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true, status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      body: null,
    });
    await GET(makeRequest("sprites/outdoors.json", "?language=en"), makeParams(["sprites", "outdoors.json"]));
    const [calledUrl] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(calledUrl.toString()).toContain("language=en");
  });

  it("passes through the upstream content-type", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true, status: 200,
      headers: new Headers({ "content-type": "application/x-protobuf" }),
      body: null,
    });
    const res = await GET(makeRequest("tiles/outdoors/5/10/20.pbf"), makeParams(["tiles", "outdoors", "5", "10", "20.pbf"]));
    expect(res.headers.get("content-type")).toBe("application/x-protobuf");
  });

  it("sets long-lived cache-control headers", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true, status: 200,
      headers: new Headers({ "content-type": "application/x-protobuf" }),
      body: null,
    });
    const res = await GET(makeRequest("tiles/outdoors/5/10/20.pbf"), makeParams(["tiles", "outdoors", "5", "10", "20.pbf"]));
    expect(res.headers.get("cache-control")).toContain("max-age=86400");
  });

  it("passes through non-OK upstream status codes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false, status: 404,
      headers: new Headers({}),
      body: null,
    });
    const res = await GET(makeRequest("tiles/outdoors/99/99/99.pbf"), makeParams(["tiles", "outdoors", "99", "99", "99.pbf"]));
    expect(res.status).toBe(404);
  });
});
