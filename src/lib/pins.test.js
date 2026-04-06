import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFile, writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { readPins, writePins } from "./pins.js";

const TEMP_FILE = join(tmpdir(), "east-coast-trip-pins.test.json");

beforeEach(() => {
  process.env.PINS_FILE = TEMP_FILE;
});

afterEach(async () => {
  delete process.env.PINS_FILE;
  await unlink(TEMP_FILE).catch(() => {});
});

const SAMPLE_PINS = [
  { id: "1", label: "Home", description: "Starting point", lngLat: [-79.12, 44.1], icon: "home", image: "" },
  { id: "2", label: "Peggy's Cove", description: "Lighthouse", lngLat: [-63.9189, 44.4919], icon: "landmark", image: "" },
];

describe("readPins", () => {
  it("returns parsed pins from file", async () => {
    await writeFile(TEMP_FILE, JSON.stringify(SAMPLE_PINS));
    expect(await readPins()).toEqual(SAMPLE_PINS);
  });

  it("returns an empty array for an empty JSON array", async () => {
    await writeFile(TEMP_FILE, "[]");
    expect(await readPins()).toEqual([]);
  });

  it("returns an empty array when the file does not exist", async () => {
    // No file written — simulates a freshly bind-mounted Docker volume
    expect(await readPins()).toEqual([]);
  });

  it("returns an empty array when the file is empty", async () => {
    await writeFile(TEMP_FILE, "");
    expect(await readPins()).toEqual([]);
  });
});

describe("writePins", () => {
  it("round-trips pins correctly through the filesystem", async () => {
    await writeFile(TEMP_FILE, "[]");
    await writePins(SAMPLE_PINS);
    const raw = await readFile(TEMP_FILE, "utf-8");
    expect(JSON.parse(raw)).toEqual(SAMPLE_PINS);
  });

  it("overwrites existing content", async () => {
    await writeFile(TEMP_FILE, JSON.stringify(SAMPLE_PINS));
    await writePins([]);
    expect(await readPins()).toEqual([]);
  });
});
