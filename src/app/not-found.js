import Link from "next/link";
import { MapPinOff, ChevronRight } from "lucide-react";
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
    <div className="min-h-screen flex items-center justify-center bg-paper p-4">
      <div className="bg-white rounded-2xl border border-line shadow-md p-6 w-full max-w-md">
        <span className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
          <MapPinOff size={20} className="text-accent" aria-hidden="true" />
        </span>
        <h1 className="mt-3 font-serif font-semibold text-ink text-[26px] leading-[1.15]">We took a wrong turn</h1>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          There&apos;s nothing at this address - the link may be mistyped, or the trip may have been removed.
        </p>

        {trips.length > 0 && (
          <ul className="mt-4 flex flex-col gap-1.5">
            {sortTrips(trips).map((trip) => {
              const dates = formatTripDates(trip);
              return (
                <li key={trip.id}>
                  {/* Blue name and a chevron so it reads as a link to the
                      trip; a plain grey outlined box looked like a text field */}
                  <Link
                    href={`/trips/${trip.id}`}
                    className="press group flex items-center gap-3 px-3 py-2 rounded-lg bg-accent/5 hover:bg-accent/10"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-accent group-hover:text-accent-hover group-hover:underline underline-offset-2">{trip.name}</span>
                      {dates && <span className="block text-xs text-muted">{dates}</span>}
                    </span>
                    <ChevronRight size={16} className="flex-shrink-0 text-accent motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <Link
          href="/"
          className="press mt-5 block w-full text-center bg-accent hover:bg-accent-hover text-white text-sm font-medium py-2.5 rounded-lg"
        >
          Go to {SITE_NAME}
        </Link>
      </div>
    </div>
  );
}
