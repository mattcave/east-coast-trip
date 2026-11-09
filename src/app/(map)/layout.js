import { cookies } from "next/headers";
import { readTripsConfig, readPins } from "@/lib/store";
import { isValidToken } from "@/lib/auth";
import TripMap from "@/components/TripMap";

// Shared by "/" and "/trips/[id]". The map lives here rather than in the
// pages because layouts stay mounted across navigations between their child
// routes - switching trips re-renders the (empty) page but keeps the MapLibre
// instance, so the map animates to the new trip instead of being rebuilt.
// The flip side is that this only runs on a full page load; after that,
// TripMap keeps trips and pins in client state and refreshes them from the
// API after edits.
export default async function MapLayout({ children }) {
  const { defaultTripId, trips } = await readTripsConfig();
  // Every trip's pins up front: the data is small, and it makes switching
  // trips instant and gives the trip chooser its pin counts and cover photos
  const pinsByTrip = Object.fromEntries(
    await Promise.all(trips.map(async (trip) => [trip.id, await readPins(trip.id)]))
  );

  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const isAuthenticated = await isValidToken(token).catch(() => false);

  return (
    <main className="w-full h-screen">
      <TripMap
        initialTrips={trips}
        initialDefaultTripId={defaultTripId}
        initialPinsByTrip={pinsByTrip}
        isAuthenticated={isAuthenticated}
      />
      {children}
    </main>
  );
}
