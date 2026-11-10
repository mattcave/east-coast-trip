import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST } from "./route.js";
import { readPins } from "@/lib/store.js";
import { setupTempData, TEST_TRIP } from "@/test-utils/tempData.js";

const SAMPLE_PINS = [
  { id: "a", label: "Home", lngLat: [-79, 44] },
  { id: "b", label: "Saint John", lngLat: [-66, 45], region: "New Brunswick" },
  { id: "c", label: "Sea", lngLat: [-60, 40] },
];

// Mapbox, mocked: Ontario at -79, nothing out at sea
const REGIONS = { "-79,44": "Ontario" };

let data;
beforeEach(async () => {
  data = await setupTempData({ pins: { [TEST_TRIP.id]: SAMPLE_PINS } });
  vi.stubEnv("MAPBOX_TOKEN", "test-key");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    const point = new URL(url).pathname.split("/").pop().replace(".json", "");
    const name = REGIONS[point];
    return { ok: true, json: async () => ({ features: name ? [{ text: name }] : [] }) };
  });
});

afterEach(async () => {
  await data.cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const makeParams = (tripId = TEST_TRIP.id) => ({ params: Promise.resolve({ tripId }) });

describe("POST /api/trips/[tripId]/pins/regions", () => {
  it("fills in the region on pins that don't have one", async () => {
    const response = await POST(null, makeParams());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ updated: 1, failed: 1 });

    const pins = await readPins(TEST_TRIP.id);
    expect(pins.map((p) => p.region ?? null)).toEqual(["Ontario", "New Brunswick", null]);
  });

  it("only looks up pins that are missing a region", async () => {
    await POST(null, makeParams());
    const looked = globalThis.fetch.mock.calls.map(([url]) => new URL(url).pathname.split("/").pop());
    expect(looked).toEqual(["-79,44.json", "-60,40.json"]);
  });

  it("returns 404 for an unknown trip", async () => {
    expect((await POST(null, makeParams("nope"))).status).toBe(404);
  });
});
