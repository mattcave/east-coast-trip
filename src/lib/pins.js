import { readFile, writeFile } from "fs/promises";
import path from "path";

// Resolved at call time so tests can override via process.env.PINS_FILE
function getPinsFile() {
  return process.env.PINS_FILE ?? path.join(process.cwd(), "data", "pins.json");
}

export async function readPins() {
  try {
    const data = await readFile(getPinsFile(), "utf-8");
    // Guard against an empty file (e.g. a freshly bind-mounted volume)
    return JSON.parse(data.trim() || "[]");
  } catch (err) {
    // File missing on first deploy — start with an empty list
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

export async function writePins(pins) {
  await writeFile(getPinsFile(), JSON.stringify(pins, null, 2));
}
