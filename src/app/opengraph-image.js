import { readPins, readTripsConfig } from "@/lib/store";
import { SITE_NAME } from "@/lib/trips";
import { SHARE_CARD_SIZE, SHARE_CARD_CONTENT_TYPE, coverPhotoDataUri, siteShareSubtitle } from "@/lib/shareCard";
import { renderShareCard } from "@/lib/shareCardImage";

// The site-wide preview image, used for "/" and any page without its own:
// the site name over the default trip's cover photo. Trip pages have their
// own in (map)/trips/[id].

export const alt = `${SITE_NAME}: our family road trips on a map`;
export const size = SHARE_CARD_SIZE;
export const contentType = SHARE_CARD_CONTENT_TYPE;

// See the trip image: rendered per request so it reflects current data
export const dynamic = "force-dynamic";

export default async function Image() {
  const { defaultTripId, trips } = await readTripsConfig();
  const pinsByTrip = Object.fromEntries(await Promise.all(trips.map(async (t) => [t.id, await readPins(t.id)])));
  return renderShareCard({
    title: SITE_NAME,
    subtitle: siteShareSubtitle(pinsByTrip),
    photo: await coverPhotoDataUri(pinsByTrip[defaultTripId] ?? []),
  });
}
