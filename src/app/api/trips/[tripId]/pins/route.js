import { getTrip, readPins, mutatePins } from "@/lib/store";
import { nextOrder, sanitizePinDate } from "@/lib/pins";

export async function GET(_, { params }) {
  const { tripId } = await params;
  if (!(await getTrip(tripId))) return Response.json({ error: "Trip not found" }, { status: 404 });
  return Response.json(await readPins(tripId));
}

export async function POST(request, { params }) {
  const { tripId } = await params;
  const body = await request.json();
  const { label, description, lngLat, icon, images, wikipedia } = body;

  if (!label || !lngLat) {
    return Response.json({ error: "label and lngLat are required" }, { status: 400 });
  }
  const { date = null, error } = sanitizePinDate(body);
  if (error) return Response.json({ error }, { status: 400 });

  const pinFields = {
    label,
    description: description ?? "",
    lngLat,
    icon: icon ?? "default",
    images: images ?? [],
    wikipedia: wikipedia ?? null,
    date,
  };

  // The id and order are assigned inside the queue: order is "one past the
  // current last stop", and reading the pins outside it could hand two
  // concurrent adds the same number
  const result = await mutatePins(tripId, (pins) => {
    const newPin = { id: crypto.randomUUID(), ...pinFields, order: nextOrder(pins) };
    return { pins: [...pins, newPin], result: { pin: newPin } };
  });

  if (result.error) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result.pin, { status: 201 });
}
