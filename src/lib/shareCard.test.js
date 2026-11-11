import { describe, it, expect } from "vitest";
import path from "path";
import { uploadPathFromUrl, tripShareSubtitle, siteShareSubtitle } from "./shareCard.js";

describe("uploadPathFromUrl", () => {
  it("maps an upload URL to the file in public/", () => {
    expect(uploadPathFromUrl("/uploads/8b3b2fd3-d9ec-4293-8443-314e05e2c138.webp"))
      .toBe(path.join(process.cwd(), "public", "uploads", "8b3b2fd3-d9ec-4293-8443-314e05e2c138.webp"));
  });

  it.each([
    "/uploads/../data/trips.json",
    "/uploads/a/b.webp",
    "/uploads/x.svg",
    "https://example.com/uploads/x.webp",
    "uploads/x.webp",
    "",
    null,
    undefined,
  ])("refuses %s", (url) => {
    expect(uploadPathFromUrl(url)).toBeNull();
  });
});

describe("tripShareSubtitle", () => {
  const trip = { startDate: "2026-07-28", endDate: "2026-08-03" };

  it("joins the dates and stop count", () => {
    expect(tripShareSubtitle(trip, [{}, {}, {}])).toBe("28 Jul – 3 Aug 2026 · 3 stops");
  });

  it("says 1 stop, not 1 stops", () => {
    expect(tripShareSubtitle(trip, [{}])).toBe("28 Jul – 3 Aug 2026 · 1 stop");
  });

  it("leaves out missing dates", () => {
    expect(tripShareSubtitle({}, [{}, {}])).toBe("2 stops");
  });

  it("shows the Planned tag for a trip with no stops", () => {
    expect(tripShareSubtitle({ startDate: "2027-06-01" }, [])).toBe("Planned · 2027");
  });
});

describe("siteShareSubtitle", () => {
  it("counts trips with stops and their stops", () => {
    expect(siteShareSubtitle({ a: [{}, {}], b: [{}], planned: [] })).toBe("2 road trips · 3 stops");
  });

  it("uses singulars", () => {
    expect(siteShareSubtitle({ a: [{}] })).toBe("1 road trip · 1 stop");
  });

  it("has a fallback when nothing has stops", () => {
    expect(siteShareSubtitle({ planned: [] })).toBe("Family road trips, on a map");
  });
});
