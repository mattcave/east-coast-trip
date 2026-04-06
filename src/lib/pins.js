import { readFile, writeFile } from "fs/promises";
import path from "path";

// Resolved at call time so tests can override via process.env.PINS_FILE
function getPinsFile() {
  return process.env.PINS_FILE ?? path.join(process.cwd(), "data", "pins.json");
}

export async function readPins() {
  const data = await readFile(getPinsFile(), "utf-8");
  return JSON.parse(data);
}

export async function writePins(pins) {
  await writeFile(getPinsFile(), JSON.stringify(pins, null, 2));
}
