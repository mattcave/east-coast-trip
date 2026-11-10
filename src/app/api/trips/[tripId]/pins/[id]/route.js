import { mutatePins, readPins } from "@/lib/store";
import { sanitizePinDate } from "@/lib/pins";
import { lookupRegion, sameLngLat } from "@/lib/regions";

export async function PATCH(request, { params }) {
  const { tripId, id } = await params;
  // `order` is dropped: the pin editor sends the whole pin back, including
  // the order it had when the form opened, which would undo any reordering
  // done since. Order only changes through PUT .../pins/order.
  // `region` is dropped too: it's worked out here from lngLat, and the
  // copy the editor sends back is whatever the pin had when it opened.
  const { order: _order, region: _region, ...updates } = await request.json();

  const { date, error } = sanitizePinDate(updates);
  if (error) return Response.json({ error }, { status: 400 });
  if (date !== undefined) updates.date = date;

  // A move needs the new location's region. Looked up before the write so
  // the queue isn't held up by Mapbox; `moved` is null when lngLat didn't
  // change (the editor sends it back on every save).
  let moved = null;
  if (updates.lngLat !== undefined) {
    const current = (await readPins(tripId)).find((p) => p.id === id);
    if (current && !sameLngLat(current.lngLat, updates.lngLat)) {
      moved = { region: await lookupRegion(updates.lngLat) };
    }
  }

  const result = await mutatePins(tripId, (pins) => {
    const index = pins.findIndex((p) => p.id === id);
    if (index === -1) return { result: { error: "Pin not found", status: 404 } };

    const updated = { ...pins[index], ...updates, id };
    // The old region belongs to the old spot, so a failed lookup drops it
    if (moved) {
      if (moved.region) updated.region = moved.region;
      else delete updated.region;
    }
    const nextPins = [...pins];
    nextPins[index] = updated;
    return { pins: nextPins, result: { pin: updated } };
  });

  if (result.error) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result.pin);
}

export async function DELETE(_, { params }) {
  const { tripId, id } = await params;

  const result = await mutatePins(tripId, (pins) => {
    const index = pins.findIndex((p) => p.id === id);
    if (index === -1) return { result: { error: "Pin not found", status: 404 } };

    const nextPins = pins.toSpliced(index, 1);
    return { pins: nextPins, result: { ok: true } };
  });

  if (result.error) return Response.json({ error: result.error }, { status: result.status });
  return new Response(null, { status: 204 });
}
