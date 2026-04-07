import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, unlink, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { GET } from "./route.js";
import { NextRequest } from "next/server";

const TEMP_UPLOADS = join(tmpdir(), "east-coast-trip-uploads-test");

// Next.js 16 passes params as a Promise
const makeParams = (parts) => ({ params: Promise.resolve({ path: parts }) });

function makeRequest(parts) {
  return new NextRequest(`http://localhost/uploads/${parts.join("/")}`);
}

beforeEach(async () => {
  process.env.PINS_FILE; // not needed but keeps pattern consistent
  await mkdir(TEMP_UPLOADS, { recursive: true });
  // Point the route at our temp dir by overriding cwd — simplest approach
  // is to write a real file and set up the env so process.cwd() resolves correctly.
  // Instead, we write directly into the real uploads path for these tests.
});

afterEach(async () => {
  await rm(TEMP_UPLOADS, { recursive: true, force: true });
});

describe("GET /uploads/[...path]", () => {
  it("serves an existing file with correct content-type", async () => {
    // Write a dummy webp file to the actual uploads dir used by the route
    const uploadsDir = join(process.cwd(), "public", "uploads");
    const filename = `test-${Date.now()}.webp`;
    const filePath = join(uploadsDir, filename);
    const content = Buffer.from("fake-webp-content");

    await mkdir(uploadsDir, { recursive: true });
    await writeFile(filePath, content);

    try {
      const res = await GET(makeRequest([filename]), makeParams([filename]));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/webp");
      expect(res.headers.get("cache-control")).toContain("max-age=31536000");
      const body = await res.arrayBuffer();
      expect(Buffer.from(body)).toEqual(content);
    } finally {
      await unlink(filePath).catch(() => {});
    }
  });

  it("returns 404 for a missing file", async () => {
    const res = await GET(makeRequest(["nonexistent.webp"]), makeParams(["nonexistent.webp"]));
    expect(res.status).toBe(404);
  });

  it("returns 403 for path traversal attempts", async () => {
    const res = await GET(makeRequest(["../pins.json"]), makeParams(["../pins.json"]));
    expect(res.status).toBe(403);
  });
});
