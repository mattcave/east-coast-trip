---
name: road-trip
description: Add, edit, reorder and delete stops on the Cave Family Road Trips map, and attach photos to them, through the site's HTTP API. Use when asked to add a stop or place to a trip, update a stop's description, date or location, add photos to a stop, reorder stops, or create or edit a trip.
---

# Road trip map

The site is a photo map of family road trips. Each **trip** has an ordered list of **stops** (called *pins* in the API). Each stop has a location, an icon, a description and photos.

## Setup

Two environment variables must be set:

- `TRIP_API_URL`: base URL with no trailing slash. Inside the home Docker network this is `http://cave-family-road-trips:3000`. From outside, use the public site URL.
- `TRIP_API_TOKEN`: the site's `API_TOKEN`. Never print it, echo it, or include it in a message.

Reads (`GET`) need no token. Every write needs the header:

```
Authorization: Bearer $TRIP_API_TOKEN
```

A `401` response means the token is missing, wrong, or not enabled on the server. Report it. Do not retry.

## Data shapes

Trip:

```json
{ "id": "east-coast-2026", "name": "East Coast 2026", "description": "", "intro": "",
  "startDate": "2026-07-01", "endDate": "2026-07-28", "view": null }
```

Stop:

```json
{
  "id": "c36a8698-…",
  "label": "Hopewell Rocks",
  "description": "Plain text, the family's own voice.",
  "lngLat": [-64.5727, 45.8187],
  "icon": "nature",
  "date": "2026-07-14",
  "images": ["/uploads/79f5…webp"],
  "wikipedia": null,
  "order": 14,
  "region": "…"
}
```

- `lngLat` is **[longitude, latitude]**, in that order. In North America the longitude is negative. Swapping the two puts the stop in Antarctica.
- `icon` is one of: `home`, `landmark` (historic sites, museums, forts, heritage towns), `tent` (camping), `food`, `nature` (trails, waterfalls, scenic drives), `beach` (beaches and swim spots), `activity` (playgrounds, boardwalks, active family fun), `wildlife`, `attraction` (novelty sights, statues, ships, viewpoints), `default` (other).
- `date` is `YYYY-MM-DD` or `null`.
- `wikipedia`: `null` means auto-detect a nearby article, `"none"` means show none, and a Wikipedia URL links that article.
- `images` holds URLs returned by the upload endpoint. The first image is the cover.
- `order` and `region` are set by the server. Never send them.

## Endpoints

| Do | Request |
|---|---|
| List trips | `GET /api/trips`. Returns `{ defaultTripId, trips: [...] }` |
| Create a trip | `POST /api/trips` `{ name, description?, intro?, startDate?, endDate? }` |
| Edit a trip | `PATCH /api/trips/:tripId` (any trip fields) |
| List stops | `GET /api/trips/:tripId/pins`. Sort by `order` for visit order |
| Add a stop | `POST /api/trips/:tripId/pins` `{ label, lngLat, icon?, description?, date?, images?, wikipedia? }`. Returns the new stop, appended at the end |
| Edit a stop | `PATCH /api/trips/:tripId/pins/:id`. Send only the fields that change |
| Delete a stop | `DELETE /api/trips/:tripId/pins/:id` |
| Reorder stops | `PUT /api/trips/:tripId/pins/order` `{ ids: [every stop id, in visit order] }` |
| Upload a photo | `POST /api/upload` (multipart, field `file`). Returns `{ url }` |
| Find coordinates | `GET /api/geocode?q=<place>`. Returns `[{ geometry: { coordinates: [lng, lat] }, properties: { label } }]` |
| Find a Wikipedia article | `GET /api/wikipedia/search?q=<place>` |

The geocoder only searches the north-east US, Quebec and Maritime Canada. For a place outside that area, use coordinates you are confident of, or ask.

## Common tasks

Always `GET` the trip's stops first. That gives you real ids and the current state. Match a stop by its label. If more than one stop could match, ask which one.

### Add a stop

1. Geocode the place and take the best match's `coordinates`.
2. Pick an icon from the list above.
3. `POST` the stop.
4. A new stop is added at the end of the trip. If it belongs somewhere else, reorder.

```bash
curl -sS -X POST "$TRIP_API_URL/api/trips/east-coast-2026/pins" \
  -H "Authorization: Bearer $TRIP_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"label":"Hopewell Rocks","lngLat":[-64.5727,45.8187],"icon":"nature","date":"2026-07-14","description":"…"}'
```

### Add photos to a stop

There is no single "add photo" call. Upload each photo, then set the stop's whole `images` list:

1. Upload each file:
   ```bash
   curl -sS -X POST "$TRIP_API_URL/api/upload" \
     -H "Authorization: Bearer $TRIP_API_TOKEN" -F "file=@/path/to/photo.jpg"
   ```
   The server accepts JPEG, PNG, WebP and GIF up to 10 MB. It does not accept HEIC: convert HEIC files to JPEG first (for example with `magick` or `heif-convert`), or ask for a JPEG. The server resizes the photo and removes its EXIF data, location included.
2. `GET` the stops again and read the stop's current `images`.
3. `PATCH` the stop with `images` set to the current list plus the new URLs:
   ```bash
   curl -sS -X PATCH "$TRIP_API_URL/api/trips/east-coast-2026/pins/<id>" \
     -H "Authorization: Bearer $TRIP_API_TOKEN" -H "Content-Type: application/json" \
     -d '{"images":["/uploads/old.webp","/uploads/new1.webp","/uploads/new2.webp"]}'
   ```

`images` replaces the whole array. Always include the existing URLs, or the existing photos will drop off the stop. To make a different photo the cover, move it to the front of the array.

If a photo carries GPS data and no stop was named, you can read its location before uploading (for example with `exiftool -n -GPSLongitude -GPSLatitude`) to find the nearest stop, or to suggest a new one.

### Move a stop in the order

`PUT .../pins/order` with every stop id in the new order. Build the list from a fresh `GET` sorted by `order`, move the one id, then send the whole list.

### Edit or delete

- `PATCH` merges the fields you send into the stop. Send only the fields that change, and only the fields listed in the stop shape above.
- Before you `DELETE` a stop, confirm it with the user and say which stop it is. Deleting cannot be undone.

## Writing descriptions

Read a few existing descriptions on the trip first and match their voice: the family speaking in the first person, light and specific, usually two to four sentences. Write what the user says happened. Do not invent events. Facts about the place are fine if you are sure of them.

## After a change

Reply with a short confirmation: the stop's name, its position in the trip, and what changed. For example: "Added 3 photos to Hopewell Rocks (stop 14)." To give the user a link, use the public site, `https://roadtrip.home.ma.ttcave.ca/trips/<tripId>`, not the internal Docker URL.
