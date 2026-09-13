import { mutatePins } from "@/lib/pins";

export async function PATCH(request, { params }) {
  const { id } = await params;
  const updates = await request.json();

  const result = await mutatePins((pins) => {
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
  const { id } = await params;

  const result = await mutatePins((pins) => {
    const index = pins.findIndex((p) => p.id === id);
    if (index === -1) return { result: { error: "Pin not found", status: 404 } };

    const nextPins = pins.toSpliced(index, 1);
    return { pins: nextPins, result: { ok: true } };
  });

  if (result.error) return Response.json({ error: result.error }, { status: result.status });
  return new Response(null, { status: 204 });
}
