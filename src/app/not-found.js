import Link from "next/link";
import { MapPinOff } from "lucide-react";
import { readTripsConfig } from "@/lib/store";
import { SITE_NAME, formatTripDates, sortTrips } from "@/lib/trips";

export const metadata = { title: "Page not found" };

// Shown for any URL that doesn't match a route, and for /trips/<id> with an
// unknown id. It's a real 404 page rather than a redirect to "/": sending
// bad links to the home page with a 200 status (a "soft 404") hides the
// broken link from the visitor and from search engines. Listing the trips
// gives people the useful next step a redirect would have.
export default async function NotFound() {
  const { trips } = await readTripsConfig().catch(() => ({ trips: [] }));

  return (
    // A div, not <main>: for an unknown trip this renders inside the (map)
    // layout's <main>
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-md p-6 w-full max-w-md">
        <span className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
          <MapPinOff size={20} className="text-blue-600" />
        </span>
        <h1 className="mt-3 font-semibold text-gray-900 text-xl">We took a wrong turn</h1>
        <p className="mt-1 text-sm text-gray-600 leading-relaxed">
          There&apos;s nothing at this address - the link may be mistyped, or the trip may have been removed.
        </p>

        {trips.length > 0 && (
          <ul className="mt-4 flex flex-col gap-1.5">
            {sortTrips(trips).map((trip) => {
              const dates = formatTripDates(trip);
              return (
                <li key={trip.id}>
                  <Link
                    href={`/trips/${trip.id}`}
                    className="block px-3 py-2 rounded-lg border border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <span className="block text-sm font-medium text-gray-800">{trip.name}</span>
                    {dates && <span className="block text-xs text-gray-400">{dates}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <Link
          href="/"
          className="mt-5 block w-full text-center bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
        >
          Go to {SITE_NAME}
        </Link>
      </div>
    </div>
  );
}
