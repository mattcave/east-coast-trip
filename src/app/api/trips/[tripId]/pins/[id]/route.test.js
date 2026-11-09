import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, access } from "fs/promises";
import { join } from "path";
import { PATCH, DELETE } from "./route.js";
import { readPins } from "@/lib/store.js";
import { setupTempData, TEST_TRIP } from "@/test-utils/tempData.js";

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
});

async function exists(filePath) {
  return access(filePath).then(() => true, () => false);
}

// Next.js 16 passes params as a Promise
const makeParams = (id, tripId = TEST_TRIP.id) => ({ params: Promise.resolve({ tripId, id }) });

function patchRequest(id, body) {
  return new Request(`http://localhost/api/trips/${TEST_TRIP.id}/pins/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/trips/[tripId]/pins/[id]", () => {
  it("updates an existing pin and returns 200", async () => {
    const response = await PATCH(patchRequest("1", { label: "Updated Home" }), makeParams("1"));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.label).toBe("Updated Home");
    expect(body.id).toBe("1");
  });

  it("persists the update to the file", async () => {
    await PATCH(patchRequest("1", { label: "Updated Home" }), makeParams("1"));
    const pins = await readPins(TEST_TRIP.id);
    expect(pins.find((p) => p.id === "1").label).toBe("Updated Home");
  });

  it("does not allow overwriting the id", async () => {
    await PATCH(patchRequest("1", { id: "999", label: "Hijack" }), makeParams("1"));
    const pins = await readPins(TEST_TRIP.id);
    expect(pins.find((p) => p.id === "1")).toBeDefined();
    expect(pins.find((p) => p.id === "999")).toBeUndefined();
  });

  it("returns 404 for an unknown id", async () => {
    const response = await PATCH(patchRequest("999", { label: "x" }), makeParams("999"));
    expect(response.status).toBe(404);
  });

  it("returns 404 for an unknown trip", async () => {
    const response = await PATCH(patchRequest("1", { label: "x" }), makeParams("1", "nope"));
    expect(response.status).toBe(404);
  });

  it("deletes an uploaded image file once removed from the pin", async () => {
    const imagePath = join(data.uploadsDir, "kept.webp");
    const removedPath = join(data.uploadsDir, "removed.webp");
    await writeFile(imagePath, "kept");
    await writeFile(removedPath, "removed");
    await PATCH(patchRequest("1", { images: ["/uploads/kept.webp", "/uploads/removed.webp"] }), makeParams("1"));

    await PATCH(patchRequest("1", { images: ["/uploads/kept.webp"] }), makeParams("1"));

    expect(await exists(imagePath)).toBe(true);
    expect(await exists(removedPath)).toBe(false);
  });

  it("does not delete an image still referenced by another pin", async () => {
    const sharedPath = join(data.uploadsDir, "shared.webp");
    await writeFile(sharedPath, "shared");
    await PATCH(patchRequest("1", { images: ["/uploads/shared.webp"] }), makeParams("1"));
    await PATCH(patchRequest("2", { images: ["/uploads/shared.webp"] }), makeParams("2"));

    await PATCH(patchRequest("1", { images: [] }), makeParams("1"));

    expect(await exists(sharedPath)).toBe(true);
  });

  it("never deletes an external (non-uploaded) image URL", async () => {
    await PATCH(patchRequest("1", { images: ["https://example.com/photo.jpg"] }), makeParams("1"));
    // Should simply not throw when the "removed" URL isn't a local upload
    await expect(PATCH(patchRequest("1", { images: [] }), makeParams("1"))).resolves.toBeDefined();
  });
});

describe("DELETE /api/trips/[tripId]/pins/[id]", () => {
  it("deletes an existing pin and returns 204", async () => {
    const response = await DELETE(null, makeParams("1"));
    expect(response.status).toBe(204);
  });

  it("persists the deletion to the file", async () => {
    await DELETE(null, makeParams("1"));
    const pins = await readPins(TEST_TRIP.id);
    expect(pins).toHaveLength(1);
    expect(pins[0].id).toBe("2");
  });

  it("returns 404 for an unknown id", async () => {
    const response = await DELETE(null, makeParams("999"));
    expect(response.status).toBe(404);
  });

  it("returns 404 for an unknown trip", async () => {
    const response = await DELETE(null, makeParams("1", "nope"));
    expect(response.status).toBe(404);
  });

  it("deletes the pin's uploaded image files", async () => {
    const imagePath = join(data.uploadsDir, "gone.webp");
    await writeFile(imagePath, "gone");
    await PATCH(patchRequest("1", { images: ["/uploads/gone.webp"] }), makeParams("1"));

    await DELETE(null, makeParams("1"));

    expect(await exists(imagePath)).toBe(false);
  });
});

describe("PATCH stop order and date", () => {
  it("ignores order, so a stale editor form can't undo a reorder", async () => {
    await data.cleanup();
    data = await setupTempData({ pins: { [TEST_TRIP.id]: [{ ...SAMPLE_PINS[0], order: 2 }, { ...SAMPLE_PINS[1], order: 1 }] } });

    await PATCH(patchRequest("1", { label: "Home!", order: 1 }), makeParams("1"));
    const pins = await readPins(TEST_TRIP.id);
    expect(pins[0]).toMatchObject({ label: "Home!", order: 2 });
  });

  it("sets, clears and validates the date", async () => {
    await PATCH(patchRequest("1", { date: "2026-07-14" }), makeParams("1"));
    expect((await readPins(TEST_TRIP.id))[0].date).toBe("2026-07-14");

    await PATCH(patchRequest("1", { date: "" }), makeParams("1"));
    expect((await readPins(TEST_TRIP.id))[0].date).toBeNull();

    const bad = await PATCH(patchRequest("1", { date: "tomorrow" }), makeParams("1"));
    expect(bad.status).toBe(400);
  });
});
