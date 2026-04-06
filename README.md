# East Coast Trip

An interactive road trip map for our summer drive from Ontario to Nova Scotia. Locations are displayed as map pins with photos, descriptions, and icons. An authenticated admin panel allows pins to be added, edited, and removed directly on the map.

## Stack

- **[Next.js 16](https://nextjs.org)** — App Router, server components, API route handlers
- **[MapLibre GL JS](https://maplibre.org)** — client-side interactive map
- **[Stadia Maps](https://stadiamaps.com)** — Outdoors tile style + geocoding API
- **[Sharp](https://sharp.pixelplumbing.com)** — server-side image resizing and WebP conversion
- **[Tailwind CSS v4](https://tailwindcss.com)** — styling
- **[Lucide React](https://lucide.dev)** — pin icons
- Data stored in `data/pins.json` — no database required

## Features

- Interactive map with coloured, categorised pins
- Photo popups with name, description, and icon
- Authenticated admin panel (single shared password)
- Add pins by searching for a place or clicking the map
- Image upload with automatic crop and resize (1200×800 WebP)
- API key kept server-side — never exposed to the client

## Development

### Prerequisites

- Node.js 22+
- A [Stadia Maps](https://stadiamaps.com) API key (free tier is sufficient)

### Setup

```bash
npm install
```

Create `.env.local` in the project root:

```env
STADIA_API_KEY=your_stadia_api_key
ADMIN_PASSWORD=your_admin_password
SESSION_SECRET=a_long_random_string
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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

Pin data is persisted in `./data/pins.json` and uploaded images in `./public/uploads/`, both bind-mounted from the host so they survive container rebuilds.

### Building from a Git remote

Once a remote is configured, replace the local build context in `docker-compose.yml`:

```yaml
build:
  context: https://github.com/mattcave/east-coast-trip.git
  dockerfile: Dockerfile
```

Then `docker compose up -d --build` pulls and builds directly from the repo — no local checkout required.
