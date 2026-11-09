import { mkdtemp, mkdir, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

export const TEST_TRIP = { id: "test-trip", name: "Test Trip", description: "", intro: "", startDate: null, endDate: null, view: null };
export const OTHER_TRIP = { id: "other-trip", name: "Other Trip", description: "", intro: "", startDate: null, endDate: null, view: null };

// Points the store at a fresh temp data dir (and uploads dir) for one test.
// Pass `config: null` to leave trips.json out, e.g. to exercise migration.
// Each call gets a unique dir, which also sidesteps the store's per-dir
// migration memo.
export async function setupTempData({
  config = { defaultTripId: TEST_TRIP.id, trips: [TEST_TRIP, OTHER_TRIP] },
  pins = {},
} = {}) {
  const dir = await mkdtemp(join(tmpdir(), "road-trips-test-"));
  const uploadsDir = join(dir, "uploads");
  await mkdir(join(dir, "pins"), { recursive: true });
  await mkdir(uploadsDir, { recursive: true });

  if (config) await writeFile(join(dir, "trips.json"), JSON.stringify(config));
  for (const [tripId, tripPins] of Object.entries(pins)) {
    await writeFile(join(dir, "pins", `${tripId}.json`), JSON.stringify(tripPins));
  }

  process.env.DATA_DIR = dir;
  process.env.UPLOADS_DIR = uploadsDir;

  return {
    dir,
    uploadsDir,
    async cleanup() {
      delete process.env.DATA_DIR;
      delete process.env.UPLOADS_DIR;
      await rm(dir, { recursive: true, force: true });
    },
  };
}
