import { describe, it, expect, afterEach } from "vitest";
import { readFile, writeFile, access, mkdir } from "fs/promises";
import { join } from "path";
import { readTripsConfig, readPins, mutatePins, mutateTrips, deleteTrip, SEED_TRIP } from "./store.js";
import { setupTempData, TEST_TRIP, OTHER_TRIP } from "@/test-utils/tempData.js";

let data;
afterEach(async () => {
  await data?.cleanup();
  data = null;
});

async function exists(file) {
  return access(file).then(() => true, () => false);
}

const SAMPLE_PINS = [
  { id: "1", label: "Home", description: "Starting point", lngLat: [-79.12, 44.1], icon: "home", images: [] },
  { id: "2", label: "Peggy's Cove", description: "Lighthouse", lngLat: [-63.9189, 44.4919], icon: "landmark", images: [] },
];

describe("migration from the single-trip layout", () => {
  it("moves a legacy pins.json into the seed trip", async () => {
    data = await setupTempData({ config: null });
    await writeFile(join(data.dir, "pins.json"), JSON.stringify(SAMPLE_PINS));

    const config = await readTripsConfig();

    expect(config.defaultTripId).toBe(SEED_TRIP.id);
    expect(config.trips).toEqual([SEED_TRIP]);
    expect(await readPins(SEED_TRIP.id)).toEqual(SAMPLE_PINS);
    expect(await exists(join(data.dir, "pins.json"))).toBe(false);
  });

  it("seeds the default trip with no pins on a fresh install", async () => {
    data = await setupTempData({ config: null });

    const config = await readTripsConfig();

    expect(config.trips.map((t) => t.id)).toEqual([SEED_TRIP.id]);
    expect(await readPins(SEED_TRIP.id)).toEqual([]);
  });

  it("handles an empty legacy pins.json", async () => {
    data = await setupTempData({ config: null });
    await writeFile(join(data.dir, "pins.json"), "");

    await readTripsConfig();

    expect(await readPins(SEED_TRIP.id)).toEqual([]);
  });

  it("leaves an existing trips.json alone", async () => {
    data = await setupTempData();
    await writeFile(join(data.dir, "pins.json"), JSON.stringify(SAMPLE_PINS));

    const config = await readTripsConfig();

    expect(config.trips.map((t) => t.id)).toEqual([TEST_TRIP.id, OTHER_TRIP.id]);
    expect(await exists(join(data.dir, "pins.json"))).toBe(true);
  });

  it("runs once when several requests arrive at the same time", async () => {
    data = await setupTempData({ config: null });
    await writeFile(join(data.dir, "pins.json"), JSON.stringify(SAMPLE_PINS));

    const results = await Promise.all([readTripsConfig(), readPins(SEED_TRIP.id), readTripsConfig()]);

    expect(results[1]).toEqual(SAMPLE_PINS);
    const written = JSON.parse(await readFile(join(data.dir, "trips.json"), "utf-8"));
    expect(written.trips).toHaveLength(1);
  });
});

describe("readPins", () => {
  it("returns a trip's pins", async () => {
    data = await setupTempData({ pins: { [TEST_TRIP.id]: SAMPLE_PINS } });
    expect(await readPins(TEST_TRIP.id)).toEqual(SAMPLE_PINS);
  });

  it("returns an empty array for a trip with no pin file yet", async () => {
    data = await setupTempData();
    expect(await readPins(OTHER_TRIP.id)).toEqual([]);
  });

  it("returns an empty array for an empty pin file", async () => {
    data = await setupTempData();
    await writeFile(join(data.dir, "pins", `${TEST_TRIP.id}.json`), "");
    expect(await readPins(TEST_TRIP.id)).toEqual([]);
  });

  it("rejects an id that isn't a valid slug", async () => {
    data = await setupTempData();
    await expect(readPins("../trips")).rejects.toThrow("Invalid trip id");
  });
});

describe("mutatePins", () => {
  it("writes the new pins for that trip only", async () => {
    data = await setupTempData({ pins: { [TEST_TRIP.id]: SAMPLE_PINS, [OTHER_TRIP.id]: [SAMPLE_PINS[0]] } });

    await mutatePins(TEST_TRIP.id, (pins) => ({ pins: pins.slice(1) }));

    expect(await readPins(TEST_TRIP.id)).toEqual([SAMPLE_PINS[1]]);
    expect(await readPins(OTHER_TRIP.id)).toEqual([SAMPLE_PINS[0]]);
  });

  it("returns a 404 result for an unknown trip", async () => {
    data = await setupTempData();
    const result = await mutatePins("nope", (pins) => ({ pins }));
    expect(result).toEqual({ error: "Trip not found", status: 404 });
  });

  it("serializes concurrent mutations so none are lost", async () => {
    data = await setupTempData();
    await Promise.all(
      ["a", "b", "c"].map((id) => mutatePins(TEST_TRIP.id, (pins) => ({ pins: [...pins, { id, images: [] }] })))
    );
    expect((await readPins(TEST_TRIP.id)).map((p) => p.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("keeps an upload that another trip still uses", async () => {
    data = await setupTempData({
      pins: {
        [TEST_TRIP.id]: [{ id: "1", images: ["/uploads/shared.webp"] }],
        [OTHER_TRIP.id]: [{ id: "2", images: ["/uploads/shared.webp"] }],
      },
    });
    const shared = join(data.uploadsDir, "shared.webp");
    await writeFile(shared, "x");

    await mutatePins(TEST_TRIP.id, () => ({ pins: [] }));

    expect(await exists(shared)).toBe(true);
  });
});

describe("mutateTrips", () => {
  it("only writes when a new config is returned", async () => {
    data = await setupTempData();
    const result = await mutateTrips(() => ({ result: "unchanged" }));
    expect(result).toBe("unchanged");
    expect((await readTripsConfig()).trips).toHaveLength(2);
  });
});

describe("deleteTrip", () => {
  it("removes the trip, its pin file, and its uploads", async () => {
    data = await setupTempData({ pins: { [OTHER_TRIP.id]: [{ id: "1", images: ["/uploads/gone.webp"] }] } });
    const photo = join(data.uploadsDir, "gone.webp");
    await writeFile(photo, "x");

    expect(await deleteTrip(OTHER_TRIP.id)).toEqual({ ok: true });

    expect((await readTripsConfig()).trips.map((t) => t.id)).toEqual([TEST_TRIP.id]);
    expect(await exists(join(data.dir, "pins", `${OTHER_TRIP.id}.json`))).toBe(false);
    expect(await exists(photo)).toBe(false);
  });

  it("refuses to delete the default trip", async () => {
    data = await setupTempData();
    const result = await deleteTrip(TEST_TRIP.id);
    expect(result.status).toBe(400);
    expect((await readTripsConfig()).trips).toHaveLength(2);
  });

  it("returns a 404 result for an unknown trip", async () => {
    data = await setupTempData();
    expect((await deleteTrip("nope")).status).toBe(404);
  });

  it("works for a trip that never had a pin file", async () => {
    data = await setupTempData();
    await mkdir(join(data.dir, "pins"), { recursive: true });
    expect(await deleteTrip(OTHER_TRIP.id)).toEqual({ ok: true });
  });
});
