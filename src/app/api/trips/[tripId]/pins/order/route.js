import { mutatePins } from "@/lib/store";
import { applyOrder } from "@/lib/pins";

// Sets the stop order for a whole trip in one write. Body: { ids: [...] },
// every pin id in visit order. Done as one request rather than a PATCH per
// pin so a reorder can't half-apply and leave duplicate numbers behind.
export async function PUT(request, { params }) {
  const { tripId } = await params;
  const body = await request.json().catch(() => null);
  const ids = body?.ids;
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) {
    return Response.json({ error: "ids must be an array of pin ids" }, { status: 400 });
  }

  const result = await mutatePins(tripId, (pins) => {
    const nextPins = applyOrder(pins, ids);
    return { pins: nextPins, result: { pins: nextPins } };
  });

  if (result.error) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result.pins);
}
