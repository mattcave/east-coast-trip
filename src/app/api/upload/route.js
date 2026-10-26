import { writeFile, mkdir } from "fs/promises";
import path from "path";
import sharp from "sharp";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_INPUT_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// Photos keep their original aspect ratio — they're only scaled down so the
// long edge fits this size. Cropping happens at display time (see
// PhotoCarousel), so a portrait shot never loses pixels at upload.
const MAX_DIMENSION = 1600;

export async function POST(request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return Response.json({ error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" }, { status: 400 });
  }
  if (file.size > MAX_INPUT_BYTES) {
    return Response.json({ error: "File too large. Maximum size is 10MB" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const processed = await sharp(buffer)
    // Auto-orient based on the EXIF Orientation tag before resizing — phone
    // photos are often stored "sideways" with a tag saying how to rotate
    // them for display, and resizing before applying that tag bakes in the
    // wrong orientation.
    .rotate()
    .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();

  // Ensure the upload directory exists (created on first upload if missing)
  await mkdir(UPLOAD_DIR, { recursive: true });

  const filename = `${crypto.randomUUID()}.webp`;
  await writeFile(path.join(UPLOAD_DIR, filename), processed);

  return Response.json({ url: `/uploads/${filename}` });
}
