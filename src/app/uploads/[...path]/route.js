import { readFile } from "fs/promises";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

// The Next.js standalone server scans public/ at startup and only serves files
// that existed at that point. Uploads added afterwards (or copied in via scp)
// return 404. This route serves uploaded files directly from the filesystem on
// every request, bypassing the static file list entirely.
export async function GET(request, { params }) {
  const { path: parts } = await params;
  const filePath = path.join(UPLOADS_DIR, ...parts);

  // Prevent path traversal attacks
  if (!filePath.startsWith(UPLOADS_DIR + path.sep) && filePath !== UPLOADS_DIR) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const file = await readFile(filePath);
    return new Response(file, {
      headers: {
        "content-type": "image/webp",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
