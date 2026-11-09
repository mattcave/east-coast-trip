import { readTripsConfig, mutateTrips } from "@/lib/store";
import { sanitizeTripFields, uniqueTripId } from "@/lib/trips";

export async function GET() {
  return Response.json(await readTripsConfig());
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const { fields, error } = sanitizeTripFields(body);
  if (error) return Response.json({ error }, { status: 400 });
  if (!fields.name) return Response.json({ error: "name is required" }, { status: 400 });

  const trip = await mutateTrips((config) => {
    const newTrip = {
      id: uniqueTripId(fields.name, config.trips.map((t) => t.id)),
      description: "",
      intro: "",
      startDate: null,
      endDate: null,
      view: null,
      ...fields,
    };
    return { config: { ...config, trips: [...config.trips, newTrip] }, result: newTrip };
  });

  return Response.json(trip, { status: 201 });
}
