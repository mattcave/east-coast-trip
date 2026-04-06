import { readPins, writePins } from "@/lib/pins";

export async function PATCH(request, { params }) {
  const { id } = await params;
  const updates = await request.json();

  const pins = await readPins();
  const index = pins.findIndex((p) => p.id === id);

  if (index === -1) {
    return Response.json({ error: "Pin not found" }, { status: 404 });
  }

  pins[index] = { ...pins[index], ...updates, id };
  await writePins(pins);

  return Response.json(pins[index]);
}

export async function DELETE(_, { params }) {
  const { id } = await params;

  const pins = await readPins();
  const index = pins.findIndex((p) => p.id === id);

  if (index === -1) {
    return Response.json({ error: "Pin not found" }, { status: 404 });
  }

  pins.splice(index, 1);
  await writePins(pins);

  return new Response(null, { status: 204 });
}
