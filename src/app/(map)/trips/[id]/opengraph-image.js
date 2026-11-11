import { getTrip, readPins, readTripsConfig } from "@/lib/store";
import { SITE_NAME } from "@/lib/trips";
import { SHARE_CARD_SIZE, SHARE_CARD_CONTENT_TYPE, coverPhotoDataUri, tripShareSubtitle, siteShareSubtitle } from "@/lib/shareCard";
import { renderShareCard } from "@/lib/shareCardImage";

// The preview image shown when a trip's link is shared: its cover photo,
// name, dates and stop count.

export const alt = "A photo from the trip, with its name and dates";
export const size = SHARE_CARD_SIZE;
export const contentType = SHARE_CARD_CONTENT_TYPE;

// Rendered per request: trips, stops and photos change at any time, and the
// Docker build has no data/ folder, so a build-time image would be blank
export const dynamic = "force-dynamic";

export default async function Image({ params }) {
  const { id } = await params;
  const trip = await getTrip(id);

  // An unknown id 404s as a page; its image falls back to the site card
  // rather than erroring, in case a stale link is still being shared
  if (!trip) {
    const { trips } = await readTripsConfig();
    const pinsByTrip = Object.fromEntries(await Promise.all(trips.map(async (t) => [t.id, await readPins(t.id)])));
    return renderShareCard({ title: SITE_NAME, subtitle: siteShareSubtitle(pinsByTrip), photo: null });
  }

  const pins = await readPins(id);
  return renderShareCard({
    title: trip.name,
    subtitle: tripShareSubtitle(trip, pins),
    photo: await coverPhotoDataUri(pins),
  });
}
