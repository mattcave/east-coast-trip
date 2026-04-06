import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { PATCH, DELETE } from "./route.js";
import { readPins } from "@/lib/pins.js";

const TEMP_FILE = join(tmpdir(), "east-coast-trip-pins-id-route.test.json");

const SAMPLE_PINS = [
  { id: "1", label: "Home", description: "Starting point", lngLat: [-79.12, 44.1], icon: "home", image: "" },
  { id: "2", label: "Peggy's Cove", description: "Lighthouse", lngLat: [-63.9189, 44.4919], icon: "landmark", image: "" },
];

beforeEach(async () => {
  process.env.PINS_FILE = TEMP_FILE;
  await writeFile(TEMP_FILE, JSON.stringify(SAMPLE_PINS));
});

afterEach(async () => {
  delete process.env.PINS_FILE;
  await unlink(TEMP_FILE).catch(() => {});
});

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
});
