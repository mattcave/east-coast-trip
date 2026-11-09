import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET, POST } from "./route.js";
import { PATCH, DELETE, GET as GET_ONE } from "./[tripId]/route.js";
import { readTripsConfig } from "@/lib/store.js";
import { setupTempData, TEST_TRIP, OTHER_TRIP } from "@/test-utils/tempData.js";

let data;
beforeEach(async () => {
  data = await setupTempData();
});

afterEach(async () => {
  await data.cleanup();
});

const makeParams = (tripId) => ({ params: Promise.resolve({ tripId }) });

function jsonRequest(method, body) {
  return new Request("http://localhost/api/trips", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/trips", () => {
  it("returns the default trip id and all trips", async () => {
    const body = await (await GET()).json();
    expect(body).toEqual({ defaultTripId: TEST_TRIP.id, trips: [TEST_TRIP, OTHER_TRIP] });
  });
});

describe("POST /api/trips", () => {
  it("creates a trip with a slug id from its name", async () => {
    const response = await POST(jsonRequest("POST", { name: "West Coast", startDate: "2027-06-01" }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ id: "west-coast", name: "West Coast", startDate: "2027-06-01", view: null });
    expect((await readTripsConfig()).trips).toHaveLength(3);
  });

  it("de-duplicates the id", async () => {
    const response = await POST(jsonRequest("POST", { name: "Test Trip" }));
    expect((await response.json()).id).toBe("test-trip-2");
  });

  it("returns 400 without a name", async () => {
    expect((await POST(jsonRequest("POST", { description: "x" }))).status).toBe(400);
  });

  it("returns 400 for invalid fields", async () => {
    expect((await POST(jsonRequest("POST", { name: "X", startDate: "soon" }))).status).toBe(400);
  });
});

describe("GET /api/trips/[tripId]", () => {
  it("returns the trip", async () => {
    expect(await (await GET_ONE(null, makeParams(OTHER_TRIP.id))).json()).toEqual(OTHER_TRIP);
  });

  it("returns 404 for an unknown trip", async () => {
    expect((await GET_ONE(null, makeParams("nope"))).status).toBe(404);
  });
});

describe("PATCH /api/trips/[tripId]", () => {
  it("updates fields but never the id", async () => {
    const response = await PATCH(jsonRequest("PATCH", { name: "Renamed", id: "hijack" }), makeParams(OTHER_TRIP.id));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: OTHER_TRIP.id, name: "Renamed" });
  });

  it("makes a trip the default", async () => {
    await PATCH(jsonRequest("PATCH", { isDefault: true }), makeParams(OTHER_TRIP.id));
    expect((await readTripsConfig()).defaultTripId).toBe(OTHER_TRIP.id);
  });

  it("leaves the default alone otherwise", async () => {
    await PATCH(jsonRequest("PATCH", { name: "Renamed" }), makeParams(OTHER_TRIP.id));
    expect((await readTripsConfig()).defaultTripId).toBe(TEST_TRIP.id);
  });

  it("returns 404 for an unknown trip", async () => {
    expect((await PATCH(jsonRequest("PATCH", { name: "x" }), makeParams("nope"))).status).toBe(404);
  });

  it("returns 400 for invalid fields", async () => {
    expect((await PATCH(jsonRequest("PATCH", { name: "" }), makeParams(OTHER_TRIP.id))).status).toBe(400);
  });
});

describe("DELETE /api/trips/[tripId]", () => {
  it("deletes a non-default trip", async () => {
    expect((await DELETE(null, makeParams(OTHER_TRIP.id))).status).toBe(204);
    expect((await readTripsConfig()).trips.map((t) => t.id)).toEqual([TEST_TRIP.id]);
  });

  it("refuses to delete the default trip", async () => {
    expect((await DELETE(null, makeParams(TEST_TRIP.id))).status).toBe(400);
  });

  it("returns 404 for an unknown trip", async () => {
    expect((await DELETE(null, makeParams("nope"))).status).toBe(404);
  });
});
