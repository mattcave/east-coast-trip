import { readFile, writeFile, rename, unlink, mkdir, access } from "fs/promises";
import path from "path";
import { isValidTripId } from "./trips";

// Data layout under the data dir:
//   trips.json         { defaultTripId, trips: [{ id, name, ... }] }
//   pins/<tripId>.json  that trip's pins, same shape as the old pins.json

// Resolved at call time so tests can point these at temp directories
function getDataDir() {
  return process.env.DATA_DIR ?? path.join(process.cwd(), "data");
}

function getUploadsDir() {
  return process.env.UPLOADS_DIR ?? path.join(process.cwd(), "public", "uploads");
}

function tripsFile() {
  return path.join(getDataDir(), "trips.json");
}

function pinsFile(tripId) {
  // Route handlers already 404 on unknown trips; this is the last line of
  // defence against an id like "../trips" being turned into a file path
  if (!isValidTripId(tripId)) throw new Error(`Invalid trip id: ${tripId}`);
  return path.join(getDataDir(), "pins", `${tripId}.json`);
}

// The site's original (and, before multi-trip support, only) trip. Existing
// pin data is migrated into it.
export const SEED_TRIP = {
  id: "east-coast-2026",
  name: "East Coast Trip",
  description: "Ontario to Nova Scotia in our motorhome",
  intro:
    "We piled into our trusty motorhome, Fernando, and drove all the way from " +
    "Ontario to Nova Scotia this summer - this map is every place we stopped " +
    "along the way, pinned right where the memory happened.",
  startDate: null,
  endDate: null,
  // Toronto (west) to Sydney NS (east) - the map's old hardcoded default
  view: { center: [-69.8, 45.2], zoom: 5.5 },
};

async function exists(file) {
  return access(file).then(() => true, () => false);
}

async function readJson(file, fallback) {
  try {
    const data = await readFile(file, "utf-8");
    // Guard against an empty file (e.g. a freshly bind-mounted volume)
    return JSON.parse(data.trim() || "null") ?? fallback;
  } catch (err) {
    // File missing on first deploy, or a trip with no pins yet
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

// Write via a temp file + rename so a reader never observes a partially
// written file (rename is atomic on the same filesystem), and a crash
// mid-write can't leave the file truncated.
async function writeJson(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2));
  await rename(tmp, file);
}

// One-time upgrade from the single-trip layout (data/pins.json) to
// trips.json + pins/<tripId>.json. Runs on first access rather than as a
// separate deploy step, because production data lives on a bind-mounted
// volume the image can't see at build time. trips.json is written last, so
// a crash part-way through just re-runs the migration on the next request.
async function migrate(dir) {
  if (await exists(path.join(dir, "trips.json"))) return;

  const legacy = path.join(dir, "pins.json");
  const target = path.join(dir, "pins", `${SEED_TRIP.id}.json`);
  if ((await exists(legacy)) && !(await exists(target))) {
    await mkdir(path.dirname(target), { recursive: true });
    await rename(legacy, target);
  }
  await writeJson(path.join(dir, "trips.json"), { defaultTripId: SEED_TRIP.id, trips: [SEED_TRIP] });
}

// Memoised per data dir so concurrent first requests share one migration
// instead of racing each other. A failed attempt is forgotten so the next
// request retries it.
const migrations = new Map();
function ensureMigrated() {
  const dir = getDataDir();
  if (!migrations.has(dir)) {
    migrations.set(dir, migrate(dir).catch((err) => {
      migrations.delete(dir);
      throw err;
    }));
  }
  return migrations.get(dir);
}

export async function readTripsConfig() {
  await ensureMigrated();
  const config = await readJson(tripsFile(), null);
  return { defaultTripId: config?.defaultTripId ?? null, trips: config?.trips ?? [] };
}

export async function getTrip(tripId) {
  const { trips } = await readTripsConfig();
  return trips.find((t) => t.id === tripId) ?? null;
}

export async function readPins(tripId) {
  await ensureMigrated();
  return readJson(pinsFile(tripId), []);
}

// Serializes every read-modify-write of trips.json and the pin files within
// this process. Route handlers that change data should go through
// mutateTrips/mutatePins/deleteTrip instead of writing directly - otherwise
// two concurrent requests can both read the same starting state and the
// second write silently clobbers the first (e.g. an image upload racing an
// unrelated edit and losing the image field). One queue for everything keeps
// trip deletion from racing a pin edit in the same trip.
let queue = Promise.resolve();
function serialize(task) {
  const run = queue.then(task);
  // Keep the queue alive even if this task failed, so later callers aren't
  // blocked forever by one bad request.
  queue = run.then(() => {}, () => {});
  return run;
}

// mutate(config) returns { config?: nextConfig, result }; the config is only
// written when one is returned.
export function mutateTrips(mutate) {
  return serialize(async () => {
    const config = await readTripsConfig();
    const { config: nextConfig, result } = await mutate(config);
    if (nextConfig) await writeJson(tripsFile(), nextConfig);
    return result;
  });
}

// mutate(pins) returns { pins?: nextPins, result }. Resolves to
// { error, status } if the trip doesn't exist.
export function mutatePins(tripId, mutate) {
  return serialize(async () => {
    // Checked inside the queue: a request queued ahead of this one may have
    // deleted the trip after the route handler's own existence check
    const { trips } = await readTripsConfig();
    if (!trips.some((t) => t.id === tripId)) return { error: "Trip not found", status: 404 };

    const pins = await readPins(tripId);
    const { pins: nextPins, result } = await mutate(pins);
    if (nextPins) {
      await writeJson(pinsFile(tripId), nextPins);
      await deleteOrphanedImages(pins, nextPins);
    }
    return result;
  });
}

// Removes a trip, its pin file, and its uploaded photos. The default trip
// can't be deleted - that's also what stops the last trip being deleted.
export function deleteTrip(tripId) {
  return serialize(async () => {
    const config = await readTripsConfig();
    if (!config.trips.some((t) => t.id === tripId)) return { error: "Trip not found", status: 404 };
    if (config.defaultTripId === tripId) {
      return { error: "The default trip can't be deleted. Make another trip the default first.", status: 400 };
    }

    const pins = await readPins(tripId);
    // trips.json first: if the process dies after this, the leftover pin
    // file is unreachable but harmless, whereas the reverse would leave a
    // trip pointing at missing pins
    await writeJson(tripsFile(), { ...config, trips: config.trips.filter((t) => t.id !== tripId) });
    await unlink(pinsFile(tripId)).catch(() => {});
    await deleteOrphanedImages(pins, []);
    return { ok: true };
  });
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

const UPLOAD_URL_RE = /^\/uploads\/([^/]+)$/;

// Removes uploaded image files that no longer appear on any pin, e.g. after a
// photo is removed from a pin or the pin itself is deleted. Only ever touches
// files under public/uploads (matched by the exact /uploads/<name> URL
// shape) — an external image URL (e.g. a linked Wikipedia photo) never
// matches and is left alone. Must run inside the queue, after the new state
// has been written, so the "other trips" check below sees current data.
async function deleteOrphanedImages(oldPins, newPins) {
  const after = collectImageUrls(newPins);
  const candidates = [...collectImageUrls(oldPins)].filter((url) => !after.has(url) && UPLOAD_URL_RE.test(url));
  if (candidates.length === 0) return;

  // The UI never shares an upload between trips, but a hand-edited data
  // file could, so check every trip before deleting anything. The trip just
  // written is included; its new pins are already in `after` anyway.
  const { trips } = await readTripsConfig();
  for (const trip of trips) {
    for (const url of collectImageUrls(await readPins(trip.id))) after.add(url);
  }

  const uploadsDir = getUploadsDir();
  for (const url of candidates) {
    if (after.has(url)) continue;
    // Uploads are runtime data on a mounted volume, so tell Turbopack not to
    // trace this path; otherwise it bundles the whole project into the build
    const filePath = path.join(/*turbopackIgnore: true*/ uploadsDir, UPLOAD_URL_RE.exec(url)[1]);
    if (!filePath.startsWith(uploadsDir + path.sep)) continue;
    await unlink(filePath).catch(() => {});
  }
}
