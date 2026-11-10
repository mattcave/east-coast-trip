import { getTrip, readPins, mutatePins } from "@/lib/store";
import { lookupRegion, sameLngLat } from "@/lib/regions";

// Admin only (every non-GET /api request needs a session, see proxy.js).
// Fills `region` on every pin in the trip that doesn't have one yet: a
// one-off backfill for pins saved before regions existed, run on the live
// site after deploy. Safe to run again; pins that already have a region,
// or whose lookup fails, are left alone.
//
// The lookups happen before the write, not inside it, so a slow Mapbox
// doesn't hold up every other edit queued behind this one. The write then
// applies them in one mutatePins call, skipping any pin that was moved
// (or given a region) while the lookups ran.
export async function POST(_, { params }) {
  const { tripId } = await params;
  if (!(await getTrip(tripId))) return Response.json({ error: "Trip not found" }, { status: 404 });

  const missing = (await readPins(tripId)).filter((p) => !p.region);
  const found = new Map();
  let failed = 0;
  // One at a time: a trip has tens of pins, and this runs once
  for (const pin of missing) {
    const region = await lookupRegion(pin.lngLat);
    if (region) found.set(pin.id, { region, lngLat: pin.lngLat });
    else failed += 1;
  }

  const result = await mutatePins(tripId, (pins) => {
    let updated = 0;
    const nextPins = pins.map((pin) => {
      const hit = found.get(pin.id);
      if (!hit || pin.region || !sameLngLat(pin.lngLat, hit.lngLat)) return pin;
      updated += 1;
      return { ...pin, region: hit.region };
    });
    return updated ? { pins: nextPins, result: { updated } } : { result: { updated } };
  });

  if (result.error) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ updated: result.updated, failed });
}
