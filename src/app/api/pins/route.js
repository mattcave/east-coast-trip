import { readPins, writePins } from "@/lib/pins";

export async function GET() {
  const pins = await readPins();
  return Response.json(pins);
}

export async function POST(request) {
  const body = await request.json();
  const { label, description, lngLat, icon, image, wikipedia } = body;

  if (!label || !lngLat) {
    return Response.json({ error: "label and lngLat are required" }, { status: 400 });
  }

  const pins = await readPins();
  const newPin = {
    id: crypto.randomUUID(),
    label,
    description: description ?? "",
    lngLat,
    icon: icon ?? "default",
    image: image ?? "",
    wikipedia: wikipedia ?? null,
  };

  pins.push(newPin);
  await writePins(pins);

  return Response.json(newPin, { status: 201 });
}
