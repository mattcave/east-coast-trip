import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { lookupRegion, sameLngLat } from "./regions";

const mapboxReply = (features) => ({ ok: true, json: async () => ({ features }) });

beforeEach(() => vi.stubEnv("MAPBOX_TOKEN", "test-key"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("lookupRegion", () => {
  it("asks Mapbox for the region at the point and returns its name", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mapboxReply([{ text: "New Brunswick" }]));
    expect(await lookupRegion([-66.06, 45.27])).toBe("New Brunswick");
    const url = new URL(spy.mock.calls[0][0]);
    expect(url.pathname).toBe("/geocoding/v5/mapbox.places/-66.06,45.27.json");
    expect(url.searchParams.get("types")).toBe("region");
    expect(url.searchParams.get("access_token")).toBe("test-key");
  });

  it("returns null when there's no region at the point", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mapboxReply([]));
    expect(await lookupRegion([-60, 40])).toBeNull();
  });

  it("returns null when the lookup fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, json: async () => ({}) });
    expect(await lookupRegion([-66, 45])).toBeNull();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    expect(await lookupRegion([-66, 45])).toBeNull();
  });

  it("doesn't call Mapbox without a token or a valid point", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    expect(await lookupRegion(null)).toBeNull();
    expect(await lookupRegion([1])).toBeNull();
    vi.stubEnv("MAPBOX_TOKEN", "");
    expect(await lookupRegion([-66, 45])).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("sameLngLat", () => {
  it("compares two points", () => {
    expect(sameLngLat([1, 2], [1, 2])).toBe(true);
    expect(sameLngLat([1, 2], [1, 3])).toBe(false);
    expect(sameLngLat(null, [1, 2])).toBe(false);
  });
});
