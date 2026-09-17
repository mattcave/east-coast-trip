import { readFile, writeFile, rename, unlink } from "fs/promises";
import path from "path";

// Resolved at call time so tests can override via process.env.PINS_FILE
function getPinsFile() {
  return process.env.PINS_FILE ?? path.join(process.cwd(), "data", "pins.json");
}

// Resolved at call time so tests can override via process.env.UPLOADS_DIR
function getUploadsDir() {
  return process.env.UPLOADS_DIR ?? path.join(process.cwd(), "public", "uploads");
}

function collectImageUrls(pins) {
  const urls = new Set();
  for (const pin of pins) {
    for (const url of pin.images ?? (pin.image ? [pin.image] : [])) {
      urls.add(url);
    }
  }
  return urls;
}

// Removes uploaded image files that no longer appear on any pin, e.g. after a
// photo is removed from a pin or the pin itself is deleted. Only ever touches
// files under public/uploads (matched by the exact /uploads/<name> URL
// shape) — an external image URL (e.g. a linked Wikipedia photo) never
// matches and is left alone.
async function deleteOrphanedImages(oldPins, newPins) {
  const before = collectImageUrls(oldPins);
  const after = collectImageUrls(newPins);
  const uploadsDir = getUploadsDir();

  for (const url of before) {
    if (after.has(url)) continue;

    const match = /^\/uploads\/([^/]+)$/.exec(url);
    if (!match) continue;

    const filePath = path.join(uploadsDir, match[1]);
    if (!filePath.startsWith(uploadsDir + path.sep)) continue;

    await unlink(filePath).catch(() => {});
  }
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

// Write via a temp file + rename so a reader never observes a partially
// written file (rename is atomic on the same filesystem), and a crash
// mid-write can't leave pins.json truncated.
export async function writePins(pins) {
  const file = getPinsFile();
  const tmp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(pins, null, 2));
  await rename(tmp, file);
}

// Serializes read-modify-write access to pins.json within this process.
// Route handlers that need to read pins, change them, and write them back
// (create/update/delete) should go through here instead of calling
// readPins/writePins directly — otherwise two concurrent requests can both
// read the same starting state and the second write silently clobbers the
// first (e.g. an image upload racing an unrelated edit and losing the
// image field).
let queue = Promise.resolve();
export function mutatePins(mutate) {
  const run = queue.then(async () => {
    const pins = await readPins();
    const { pins: nextPins, result } = await mutate(pins);
    if (nextPins) {
      await writePins(nextPins);
      await deleteOrphanedImages(pins, nextPins);
    }
    return result;
  });
  // Keep the queue alive even if this mutation failed, so later callers
  // aren't blocked forever by one bad request.
  queue = run.then(() => {}, () => {});
  return run;
}
