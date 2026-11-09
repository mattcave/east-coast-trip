import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PUT } from "./route.js";
import { readPins } from "@/lib/store.js";
import { sortPins } from "@/lib/pins.js";
import { setupTempData, TEST_TRIP } from "@/test-utils/tempData.js";

const SAMPLE_PINS = [
  { id: "a", label: "A", lngLat: [-79, 44], order: 1 },
  { id: "b", label: "B", lngLat: [-70, 45], order: 2 },
  { id: "c", label: "C", lngLat: [-64, 44] },
];

let data;
beforeEach(async () => {
  data = await setupTempData({ pins: { [TEST_TRIP.id]: SAMPLE_PINS } });
});

afterEach(async () => {
  await data.cleanup();
});

const makeParams = (tripId = TEST_TRIP.id) => ({ params: Promise.resolve({ tripId }) });

function putRequest(body) {
  return new Request(`http://localhost/api/trips/${TEST_TRIP.id}/pins/order`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PUT /api/trips/[tripId]/pins/order", () => {
  it("renumbers every pin in the given order", async () => {
    const response = await PUT(putRequest({ ids: ["c", "a", "b"] }), makeParams());
    expect(response.status).toBe(200);

    const pins = await readPins(TEST_TRIP.id);
    expect(sortPins(pins).map((p) => [p.id, p.order])).toEqual([["c", 1], ["a", 2], ["b", 3]]);
    // File positions are unchanged; only the numbers move
    expect(pins.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("returns the updated pins", async () => {
    const response = await PUT(putRequest({ ids: ["b", "a", "c"] }), makeParams());
    expect((await response.json()).find((p) => p.id === "b").order).toBe(1);
  });

  it("rejects a body without an ids array", async () => {
    expect((await PUT(putRequest({ ids: "a,b" }), makeParams())).status).toBe(400);
    expect((await PUT(putRequest({ ids: [1, 2] }), makeParams())).status).toBe(400);
  });

  it("returns 404 for an unknown trip", async () => {
    const response = await PUT(putRequest({ ids: ["a"] }), makeParams("nope"));
    expect(response.status).toBe(404);
  });
});
