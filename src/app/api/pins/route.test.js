import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { GET, POST } from "./route.js";

const TEMP_FILE = join(tmpdir(), "east-coast-trip-pins-route.test.json");

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
  vi.restoreAllMocks();
});

function postRequest(body) {
  return new Request("http://localhost/api/pins", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/pins", () => {
  it("returns all pins", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(SAMPLE_PINS);
  });

  it("returns an empty array when no pins exist", async () => {
    await writeFile(TEMP_FILE, "[]");
    const response = await GET();
    expect(await response.json()).toEqual([]);
  });
});

describe("POST /api/pins", () => {
  it("creates a new pin and returns 201", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValueOnce("new-id");

    const response = await POST(postRequest({ label: "New Place", lngLat: [-70, 45], icon: "camera", description: "Nice view" }));
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body).toMatchObject({ id: "new-id", label: "New Place", lngLat: [-70, 45], icon: "camera" });
  });

  it("persists the new pin to the file", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValueOnce("new-id");

    await POST(postRequest({ label: "New Place", lngLat: [-70, 45] }));

    const allResponse = await GET();
    const all = await allResponse.json();
    expect(all).toHaveLength(3);
    expect(all[2].id).toBe("new-id");
  });

  it("returns 400 when label is missing", async () => {
    const response = await POST(postRequest({ lngLat: [-70, 45] }));
    expect(response.status).toBe(400);
  });

  it("returns 400 when lngLat is missing", async () => {
    const response = await POST(postRequest({ label: "New Place" }));
    expect(response.status).toBe(400);
  });
});
