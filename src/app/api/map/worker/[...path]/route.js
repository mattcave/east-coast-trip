import { readFile } from "fs/promises";
import path from "path";

const WORKER_DIR = path.join(process.cwd(), "node_modules", "maplibre-gl", "dist");

// maplibre-gl v6 resolves its tile-processing worker (and the shared chunk it
// imports) via `new URL(..., import.meta.url)` inside its own bundled code,
// which Turbopack can't statically detect and bundle — the worker silently
// fails to load and no vector tiles ever get requested. Serve the files
// directly from node_modules instead; Map.js points maplibregl.setWorkerUrl()
// at this route before creating the map.
export async function GET(request, { params }) {
  const { path: parts } = await params;
  const filePath = path.join(WORKER_DIR, ...parts);

  // Prevent path traversal attacks
  if (!filePath.startsWith(WORKER_DIR + path.sep)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const file = await readFile(filePath);
    return new Response(file, {
      headers: {
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
