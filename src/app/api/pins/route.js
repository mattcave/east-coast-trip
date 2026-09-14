import { readPins, mutatePins } from "@/lib/pins";

export async function GET() {
  const pins = await readPins();
  return Response.json(pins);
}

export async function POST(request) {
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

  await mutatePins((pins) => ({ pins: [...pins, newPin] }));

  return Response.json(newPin, { status: 201 });
}
