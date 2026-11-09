# Cave Family Road Trips

Interactive maps of our family road trips, starting with our summer drive from Ontario to Nova Scotia. Each trip is its own set of map pins with photos, descriptions, and icons, and one trip is shown at a time. An authenticated admin panel allows trips and pins to be added, edited, and removed directly on the map.

## Stack

- **[Next.js 16](https://nextjs.org)** — App Router, server components, API route handlers
- **[MapLibre GL JS](https://maplibre.org)** — client-side interactive map
- **[Stadia Maps](https://stadiamaps.com)** — Outdoors tile style, sprites, and fonts
- **[Mapbox Geocoding API](https://docs.mapbox.com/api/search/geocoding/)** — place-name search when adding/editing a pin
- **[Sharp](https://sharp.pixelplumbing.com)** — server-side image resizing and WebP conversion
- **[Tailwind CSS v4](https://tailwindcss.com)** — styling
- **[Lucide React](https://lucide.dev)** — pin icons
- Data stored as JSON files in `data/` — no database required

## Features

- Multiple trips, each at its own URL (`/trips/<id>`), with a switcher to jump between them
- Home page trip chooser, and a short intro the first time someone opens each trip
- Interactive map with coloured, categorised pins
- Photo popups with name, description, and icon
- Authenticated admin panel (single shared password)
- Add pins by searching for a place or clicking the map
- Image upload with automatic resize to WebP (original aspect ratio kept)
- API keys kept server-side — never exposed to the client

## Development

### Prerequisites

- Node.js 22+
- A [Stadia Maps](https://stadiamaps.com) API key (free tier is sufficient)
- A [Mapbox](https://account.mapbox.com/access-tokens/) access token (free tier is sufficient) — used only for place-name search; adding pins by clicking the map still works without it

### Setup

```bash
npm install
```

Create `.env.local` in the project root:

```env
STADIA_API_KEY=your_stadia_api_key
MAPBOX_TOKEN=your_mapbox_token
ADMIN_PASSWORD=your_admin_password
SESSION_SECRET=a_long_random_string
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Data

```
data/
  trips.json              { defaultTripId, trips: [{ id, name, description, intro, startDate, endDate, view }] }
  pins/<trip-id>.json     that trip's pins
```

The default trip is the one shown behind the trip chooser at `/`. A trip's `view` (`{ center, zoom }`) is where the map starts for it; when it's `null` the map fits all of the trip's pins. Both are set from the admin panel's Trips tab.

`data/` and `public/uploads/` aren't committed. To develop against the real trips, pins, and photos, copy them from production:

```bash
npm run fixtures:pull             # data, plus any photos not already downloaded
npm run fixtures:pull -- --force  # re-download every photo
```

It only reads the public GET endpoints, so no login is needed. Set `PROD_URL` to pull from a different host. Without any data the app still starts, with the default trip and no pins.

Older installs kept everything in a single `data/pins.json`. On first request the app moves that file to `data/pins/east-coast-2026.json` and creates `trips.json` around it, so no manual migration step is needed.

### Tests

```bash
npm test
```

## Deployment

### Docker Compose

Create a `.env` file in the project root with the same variables as above, then:

```bash
docker compose up -d --build
```

Trip and pin data is persisted in `./data/` and uploaded images in `./public/uploads/`, both bind-mounted from the host so they survive container rebuilds.

### Building from a Git remote

Once a remote is configured, replace the local build context in `docker-compose.yml`:

```yaml
build:
  context: https://github.com/mattcave/east-coast-trip.git
  dockerfile: Dockerfile
```

Then `docker compose up -d --build` pulls and builds directly from the repo — no local checkout required.
