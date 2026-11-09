import { notFound } from "next/navigation";
import { getTrip } from "@/lib/store";

// The map itself is rendered by the shared (map) layout, which reads the trip
// id from the URL on the client. This page only supplies per-trip metadata
// (so shared links preview with the trip's name) and handles unknown ids.

export async function generateMetadata({ params }) {
  const { id } = await params;
  const trip = await getTrip(id);
  if (!trip) return {};
  return { title: trip.name, description: trip.description || undefined };
}

export default async function TripPage({ params }) {
  const { id } = await params;
  // A deleted or mistyped trip gets the site's 404 page (src/app/not-found.js),
  // which lists the trips that do exist
  if (!(await getTrip(id))) notFound();
  return null;
}
