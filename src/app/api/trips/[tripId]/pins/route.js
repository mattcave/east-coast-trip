import { getTrip, readPins, mutatePins } from "@/lib/store";

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

  const newPin = {
    id: crypto.randomUUID(),
    label,
    description: description ?? "",
    lngLat,
    icon: icon ?? "default",
    images: images ?? [],
    wikipedia: wikipedia ?? null,
  };

  const result = await mutatePins(tripId, (pins) => ({ pins: [...pins, newPin], result: { pin: newPin } }));

  if (result.error) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(newPin, { status: 201 });
}
