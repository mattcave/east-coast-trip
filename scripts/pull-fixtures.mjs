// Pulls the live trips, pins, and uploaded photos from production into the
// local data/ and public/uploads/ folders, so local dev runs against real
// content without that content being committed (both folders are gitignored).
//
//   npm run fixtures:pull             fetch data, download photos not already here
//   npm run fixtures:pull -- --force  re-download every photo
//
// Only uses the public GET endpoints, so no credentials are needed. Set
// PROD_URL to pull from somewhere other than the default host.
//
// The npm script passes --disable-warning=MODULE_TYPELESS_PACKAGE_JSON because
// src/lib/trips.js is ESM in a package without "type": "module". Node 22
// detects and loads it fine but prints a warning on every run.

import { mkdir, writeFile, rename, access } from "fs/promises";
import path from "path";
import { isValidTripId } from "../src/lib/trips.js";

const PROD_URL = (process.env.PROD_URL ?? "https://roadtrip.home.ma.ttcave.ca").replace(/\/+$/, "");
const FORCE = process.argv.includes("--force");
const CONCURRENCY = 6;

const root = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(root, "data");
const pinsDir = path.join(dataDir, "pins");
const uploadsDir = path.join(root, "public", "uploads");

async function fetchJson(urlPath) {
  const res = await fetch(PROD_URL + urlPath);
  if (!res.ok) throw new Error(`GET ${urlPath} -> ${res.status} ${res.statusText}`);
  return res.json();
}

// Temp file + rename, same as the app's store, so a running dev server never
// reads a half-written file and a failed download leaves nothing behind
async function writeAtomic(file, contents) {
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, contents);
  await rename(tmp, file);
}

// Matches the app's own formatting (JSON.stringify with 2 spaces) so a file
// the admin panel later rewrites doesn't show spurious whitespace changes
const toJson = (data) => JSON.stringify(data, null, 2);

const exists = (file) => access(file).then(() => true, () => false);

// Pins store photos as "/uploads/<file>.webp"; older pins used a single
// `image` string. Anything else (e.g. a linked Wikipedia photo URL) lives
// off-site and isn't ours to mirror.
function uploadFilesFor(pin) {
  const urls = [...(pin.images ?? []), ...(pin.image ? [pin.image] : [])];
  return urls
    .filter((u) => typeof u === "string" && u.startsWith("/uploads/"))
    // basename() stops a crafted path like "/uploads/../../x" escaping uploadsDir
    .map((u) => path.basename(u));
}

async function downloadUpload(name) {
  const dest = path.join(uploadsDir, name);
  if (!FORCE && (await exists(dest))) return "skipped";
  const res = await fetch(`${PROD_URL}/uploads/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  await writeAtomic(dest, Buffer.from(await res.arrayBuffer()));
  return "downloaded";
}

// Runs fn over items with at most `limit` requests in flight, so we don't open
// dozens of connections at once to a home server
async function pool(items, limit, fn) {
  const results = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]).then(
        (status) => ({ item: items[i], status }),
        (err) => ({ item: items[i], status: "failed", error: err.message }),
      );
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function main() {
  console.log(`Pulling fixtures from ${PROD_URL}`);

  // Fetch everything before writing anything, so a prod outage part-way
  // through can't leave trips.json pointing at trips with no pin file
  const config = await fetchJson("/api/trips");
  const pinsByTrip = new Map();
  for (const trip of config.trips ?? []) {
    if (!isValidTripId(trip.id)) throw new Error(`Refusing unsafe trip id from prod: ${JSON.stringify(trip.id)}`);
    pinsByTrip.set(trip.id, await fetchJson(`/api/trips/${trip.id}/pins`));
  }

  await mkdir(pinsDir, { recursive: true });
  await mkdir(uploadsDir, { recursive: true });

  for (const [tripId, pins] of pinsByTrip) {
    await writeAtomic(path.join(pinsDir, `${tripId}.json`), toJson(pins));
    console.log(`  ${tripId}: ${pins.length} pins`);
  }
  // Written last, like the app's migration: it's what makes the trips visible
  await writeAtomic(path.join(dataDir, "trips.json"), toJson(config));

  const uploads = [...new Set([...pinsByTrip.values()].flat().flatMap(uploadFilesFor))];
  const results = await pool(uploads, CONCURRENCY, downloadUpload);
  const count = (s) => results.filter((r) => r.status === s).length;
  console.log(`  photos: ${count("downloaded")} downloaded, ${count("skipped")} already present`);

  const failed = results.filter((r) => r.status === "failed");
  for (const f of failed) console.error(`  failed: ${f.item} (${f.error})`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`Fixture pull failed: ${err.message}`);
  process.exitCode = 1;
});
