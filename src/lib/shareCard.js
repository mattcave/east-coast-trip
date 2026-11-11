// Data for the link-preview cards (Open Graph images) that messaging apps and
// social sites show when someone shares a link. Server-only: reads uploaded
// photos and fonts from disk. The drawing itself is in shareCardImage.js.

import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { formatTripDayRange, plannedTripTag, tripCoverImage } from "./trips";

export const SHARE_CARD_SIZE = { width: 1200, height: 630 };
// JPEG rather than ImageResponse's PNG: see renderShareCard
export const SHARE_CARD_CONTENT_TYPE = "image/jpeg";

const PUBLIC_DIR = path.join(process.cwd(), "public");

// Only names the upload route itself produces (a UUID plus an image
// extension), so a hand-edited pin can't point the card at any other file
const UPLOAD_URL_RE = /^\/uploads\/[A-Za-z0-9-]+\.(webp|jpe?g|png|gif)$/;

export function uploadPathFromUrl(url) {
  if (typeof url !== "string" || !UPLOAD_URL_RE.test(url)) return null;
  return path.join(PUBLIC_DIR, url);
}

// "28 Jul – 3 Aug 2026 · 32 stops". A trip with no stops yet gets its
// "Planned" tag instead, as in the trip chooser.
export function tripShareSubtitle(trip, pins = []) {
  if (pins.length === 0) return plannedTripTag(trip);
  const stops = `${pins.length} ${pins.length === 1 ? "stop" : "stops"}`;
  return [formatTripDayRange(trip), stops].filter(Boolean).join(" · ");
}

// "2 road trips · 60 stops", for the site-wide card. Only trips that have
// stops count, so a planned trip doesn't inflate the number.
export function siteShareSubtitle(pinsByTrip) {
  const counts = Object.values(pinsByTrip).map((pins) => pins.length).filter((n) => n > 0);
  const stops = counts.reduce((sum, n) => sum + n, 0);
  if (counts.length === 0) return "Family road trips, on a map";
  const trips = `${counts.length} road ${counts.length === 1 ? "trip" : "trips"}`;
  return `${trips} · ${stops} ${stops === 1 ? "stop" : "stops"}`;
}

// The trip's cover photo (the same one the trip chooser shows), cropped to
// the card's shape and inlined as a JPEG data URI. Satori, which draws the
// card, can't decode WebP, and every upload is WebP, so sharp converts it.
// "attention" cropping keeps the busiest part of the photo (usually the
// people) when a portrait photo is cut down to a wide card. Null when there
// is no photo or it can't be read, and the card is drawn without one.
export async function coverPhotoDataUri(pins) {
  const file = uploadPathFromUrl(tripCoverImage(pins));
  if (!file) return null;
  try {
    const jpeg = await sharp(file)
      .resize(SHARE_CARD_SIZE.width, SHARE_CARD_SIZE.height, { fit: "cover", position: "attention" })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

// Satori only reads ttf, otf and woff (not the woff2 next/font serves), so
// static woff copies of the site's fonts live in public/fonts. They're read
// from public/ rather than imported because the Docker image copies public/
// as-is, which a bundler-traced path wouldn't guarantee. Loaded once per
// server process.
let fontsPromise;
export function loadShareCardFonts() {
  fontsPromise ??= Promise.all([
    ["Newsreader", "newsreader-latin-600-normal.woff", 600],
    ["Geist", "geist-sans-latin-400-normal.woff", 400],
    ["Geist", "geist-sans-latin-600-normal.woff", 600],
  ].map(async ([name, file, weight]) => ({
    name,
    weight,
    style: "normal",
    data: await readFile(path.join(PUBLIC_DIR, "fonts", file)),
  }))).catch((err) => {
    // Don't cache a failure: the next request tries again
    fontsPromise = undefined;
    throw err;
  });
  return fontsPromise;
}
