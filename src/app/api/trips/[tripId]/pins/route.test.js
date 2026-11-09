import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET, POST } from "./route.js";
import { readPins } from "@/lib/store.js";
import { setupTempData, TEST_TRIP, OTHER_TRIP } from "@/test-utils/tempData.js";

const SAMPLE_PINS = [
  { id: "1", label: "Home", description: "Starting point", lngLat: [-79.12, 44.1], icon: "home", images: [] },
  { id: "2", label: "Peggy's Cove", description: "Lighthouse", lngLat: [-63.9189, 44.4919], icon: "landmark", images: [] },
];

let data;
beforeEach(async () => {
  data = await setupTempData({ pins: { [TEST_TRIP.id]: SAMPLE_PINS } });
});

afterEach(async () => {
  await data.cleanup();
  vi.restoreAllMocks();
});

// Next.js 16 passes params as a Promise
const makeParams = (tripId) => ({ params: Promise.resolve({ tripId }) });

function postRequest(body) {
  return new Request("http://localhost/api/trips/x/pins", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/trips/[tripId]/pins", () => {
  it("returns the trip's pins", async () => {
    const response = await GET(null, makeParams(TEST_TRIP.id));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(SAMPLE_PINS);
  });

  it("returns an empty array for a trip with no pins", async () => {
    const response = await GET(null, makeParams(OTHER_TRIP.id));
    expect(await response.json()).toEqual([]);
  });

  it("returns 404 for an unknown trip", async () => {
    const response = await GET(null, makeParams("nope"));
    expect(response.status).toBe(404);
  });
});

describe("POST /api/trips/[tripId]/pins", () => {
  it("creates a new pin and returns 201", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValueOnce("new-id");

    const response = await POST(postRequest({ label: "New Place", lngLat: [-70, 45], icon: "camera", description: "Nice view" }), makeParams(TEST_TRIP.id));
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body).toMatchObject({ id: "new-id", label: "New Place", lngLat: [-70, 45], icon: "camera" });
  });

  it("persists the new pin to that trip only", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValueOnce("new-id");

    await POST(postRequest({ label: "New Place", lngLat: [-70, 45] }), makeParams(TEST_TRIP.id));

    const pins = await readPins(TEST_TRIP.id);
    expect(pins).toHaveLength(3);
    expect(pins[2].id).toBe("new-id");
    expect(await readPins(OTHER_TRIP.id)).toEqual([]);
  });

  it("returns 404 for an unknown trip", async () => {
    const response = await POST(postRequest({ label: "New Place", lngLat: [-70, 45] }), makeParams("nope"));
    expect(response.status).toBe(404);
  });

  it("returns 400 when label is missing", async () => {
    const response = await POST(postRequest({ lngLat: [-70, 45] }), makeParams(TEST_TRIP.id));
    expect(response.status).toBe(400);
  });

  it("returns 400 when lngLat is missing", async () => {
    const response = await POST(postRequest({ label: "New Place" }), makeParams(TEST_TRIP.id));
    expect(response.status).toBe(400);
  });
});

describe("POST stop order and date", () => {
  it("puts a new pin after the last stop", async () => {
    await data.cleanup();
    data = await setupTempData({ pins: { [TEST_TRIP.id]: [{ ...SAMPLE_PINS[0], order: 4 }, { ...SAMPLE_PINS[1], order: 9 }] } });

    const response = await POST(postRequest({ label: "New Place", lngLat: [-70, 45] }), makeParams(TEST_TRIP.id));
    expect((await response.json()).order).toBe(10);
  });

  it("numbers the first pin of an unordered trip after the existing ones", async () => {
    const response = await POST(postRequest({ label: "New Place", lngLat: [-70, 45] }), makeParams(TEST_TRIP.id));
    expect((await response.json()).order).toBe(3);
  });

  it("ignores an order sent by the client", async () => {
    const response = await POST(postRequest({ label: "New Place", lngLat: [-70, 45], order: 1 }), makeParams(TEST_TRIP.id));
    expect((await response.json()).order).toBe(3);
  });

  it("saves a valid date and rejects a bad one", async () => {
    const ok = await POST(postRequest({ label: "A", lngLat: [-70, 45], date: "2026-07-14" }), makeParams(TEST_TRIP.id));
    expect((await ok.json()).date).toBe("2026-07-14");

    const bad = await POST(postRequest({ label: "B", lngLat: [-70, 45], date: "July 14" }), makeParams(TEST_TRIP.id));
    expect(bad.status).toBe(400);
  });
});
