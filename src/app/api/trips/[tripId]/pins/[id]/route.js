import { mutatePins } from "@/lib/store";
import { sanitizePinDate } from "@/lib/pins";

export async function PATCH(request, { params }) {
  const { tripId, id } = await params;
  // `order` is dropped: the pin editor sends the whole pin back, including
  // the order it had when the form opened, which would undo any reordering
  // done since. Order only changes through PUT .../pins/order.
  const { order: _order, ...updates } = await request.json();

  const { date, error } = sanitizePinDate(updates);
  if (error) return Response.json({ error }, { status: 400 });
  if (date !== undefined) updates.date = date;

  const result = await mutatePins(tripId, (pins) => {
    const index = pins.findIndex((p) => p.id === id);
    if (index === -1) return { result: { error: "Pin not found", status: 404 } };

    const updated = { ...pins[index], ...updates, id };
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
