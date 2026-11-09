import { redirect } from "next/navigation";
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
  // A deleted or mistyped trip goes to the site root (trip chooser) rather
  // than a bare 404, which would render underneath the full-screen map
  if (!(await getTrip(id))) redirect("/");
  return null;
}
