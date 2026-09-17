import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, unlink, mkdir, rm, access } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { PATCH, DELETE } from "./route.js";
import { readPins } from "@/lib/pins.js";

const TEMP_FILE = join(tmpdir(), "east-coast-trip-pins-id-route.test.json");
const TEMP_UPLOADS_DIR = join(tmpdir(), "east-coast-trip-pins-id-route-uploads.test");

const SAMPLE_PINS = [
  { id: "1", label: "Home", description: "Starting point", lngLat: [-79.12, 44.1], icon: "home", images: [] },
  { id: "2", label: "Peggy's Cove", description: "Lighthouse", lngLat: [-63.9189, 44.4919], icon: "landmark", images: [] },
];

beforeEach(async () => {
  process.env.PINS_FILE = TEMP_FILE;
  process.env.UPLOADS_DIR = TEMP_UPLOADS_DIR;
  await writeFile(TEMP_FILE, JSON.stringify(SAMPLE_PINS));
  await mkdir(TEMP_UPLOADS_DIR, { recursive: true });
});

afterEach(async () => {
  delete process.env.PINS_FILE;
  delete process.env.UPLOADS_DIR;
  await unlink(TEMP_FILE).catch(() => {});
  await rm(TEMP_UPLOADS_DIR, { recursive: true, force: true });
});

async function exists(filePath) {
  return access(filePath).then(() => true, () => false);
}

// Next.js 16 passes params as a Promise
const makeParams = (id) => ({ params: Promise.resolve({ id }) });

function patchRequest(id, body) {
  return new Request(`http://localhost/api/pins/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/pins/[id]", () => {
  it("updates an existing pin and returns 200", async () => {
    const response = await PATCH(patchRequest("1", { label: "Updated Home" }), makeParams("1"));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.label).toBe("Updated Home");
    expect(body.id).toBe("1");
  });

  it("persists the update to the file", async () => {
    await PATCH(patchRequest("1", { label: "Updated Home" }), makeParams("1"));
    const pins = await readPins();
    expect(pins.find((p) => p.id === "1").label).toBe("Updated Home");
  });

  it("does not allow overwriting the id", async () => {
    await PATCH(patchRequest("1", { id: "999", label: "Hijack" }), makeParams("1"));
    const pins = await readPins();
    expect(pins.find((p) => p.id === "1")).toBeDefined();
    expect(pins.find((p) => p.id === "999")).toBeUndefined();
  });

  it("returns 404 for an unknown id", async () => {
    const response = await PATCH(patchRequest("999", { label: "x" }), makeParams("999"));
    expect(response.status).toBe(404);
  });

  it("deletes an uploaded image file once removed from the pin", async () => {
    const imagePath = join(TEMP_UPLOADS_DIR, "kept.webp");
    const removedPath = join(TEMP_UPLOADS_DIR, "removed.webp");
    await writeFile(imagePath, "kept");
    await writeFile(removedPath, "removed");
    await PATCH(patchRequest("1", { images: ["/uploads/kept.webp", "/uploads/removed.webp"] }), makeParams("1"));

    await PATCH(patchRequest("1", { images: ["/uploads/kept.webp"] }), makeParams("1"));

    expect(await exists(imagePath)).toBe(true);
    expect(await exists(removedPath)).toBe(false);
  });

  it("does not delete an image still referenced by another pin", async () => {
    const sharedPath = join(TEMP_UPLOADS_DIR, "shared.webp");
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

describe("DELETE /api/pins/[id]", () => {
  it("deletes an existing pin and returns 204", async () => {
    const response = await DELETE(null, makeParams("1"));
    expect(response.status).toBe(204);
  });

  it("persists the deletion to the file", async () => {
    await DELETE(null, makeParams("1"));
    const pins = await readPins();
    expect(pins).toHaveLength(1);
    expect(pins[0].id).toBe("2");
  });

  it("returns 404 for an unknown id", async () => {
    const response = await DELETE(null, makeParams("999"));
    expect(response.status).toBe(404);
  });

  it("deletes the pin's uploaded image files", async () => {
    const imagePath = join(TEMP_UPLOADS_DIR, "gone.webp");
    await writeFile(imagePath, "gone");
    await PATCH(patchRequest("1", { images: ["/uploads/gone.webp"] }), makeParams("1"));

    await DELETE(null, makeParams("1"));

    expect(await exists(imagePath)).toBe(false);
  });
});
