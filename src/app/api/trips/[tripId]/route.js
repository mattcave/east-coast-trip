import { getTrip, mutateTrips, deleteTrip } from "@/lib/store";
import { sanitizeTripFields } from "@/lib/trips";

export async function GET(_, { params }) {
  const { tripId } = await params;
  const trip = await getTrip(tripId);
  if (!trip) return Response.json({ error: "Trip not found" }, { status: 404 });
  return Response.json(trip);
}

// Accepts any editable trip field, plus `isDefault: true` to make this the
// trip shown at the site root. (There's no `isDefault: false` - the default
// moves by making a different trip the default.)
export async function PATCH(request, { params }) {
  const { tripId } = await params;
  const body = await request.json().catch(() => null);
  const { fields, error } = sanitizeTripFields(body);
  if (error) return Response.json({ error }, { status: 400 });

  const result = await mutateTrips((config) => {
    const index = config.trips.findIndex((t) => t.id === tripId);
    if (index === -1) return { result: { error: "Trip not found", status: 404 } };

    const updated = { ...config.trips[index], ...fields, id: tripId };
    const trips = config.trips.with(index, updated);
    const defaultTripId = body.isDefault === true ? tripId : config.defaultTripId;
    return { config: { ...config, defaultTripId, trips }, result: { trip: updated } };
  });

  if (result.error) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result.trip);
}

export async function DELETE(_, { params }) {
  const { tripId } = await params;
  const result = await deleteTrip(tripId);
  if (result.error) return Response.json({ error: result.error }, { status: result.status });
  return new Response(null, { status: 204 });
}
