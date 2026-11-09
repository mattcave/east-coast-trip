import { describe, it, expect } from "vitest";
import {
  isValidTripId,
  slugify,
  uniqueTripId,
  sanitizeTripFields,
  sortTrips,
  tripHomeView,
  formatTripDates,
  tripCoverImage,
} from "./trips.js";

describe("isValidTripId", () => {
  it("accepts lowercase hyphenated slugs", () => {
    expect(isValidTripId("east-coast-2026")).toBe(true);
  });

  it.each(["", "../x", "East", "a--b", "-a", "a-", "a/b", "a.json", null, 5])("rejects %j", (id) => {
    expect(isValidTripId(id)).toBe(false);
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("East Coast Trip 2026!")).toBe("east-coast-trip-2026");
  });

  it("strips accents", () => {
    expect(slugify("Québec & Montréal")).toBe("quebec-montreal");
  });

  it("falls back to 'trip' when nothing usable is left", () => {
    expect(slugify("🚐🚐")).toBe("trip");
  });

  it("produces a valid trip id even when truncated", () => {
    expect(isValidTripId(slugify("a ".repeat(60)))).toBe(true);
  });
});

describe("uniqueTripId", () => {
  it("adds a numeric suffix when the slug is taken", () => {
    expect(uniqueTripId("West", ["west", "west-2"])).toBe("west-3");
  });

  it("uses the bare slug when free", () => {
    expect(uniqueTripId("West", ["east"])).toBe("west");
  });
});

describe("sanitizeTripFields", () => {
  it("keeps known fields, trims strings and drops unknown keys", () => {
    const { fields } = sanitizeTripFields({ name: " West ", id: "hijack", extra: 1, startDate: "2027-06-01" });
    expect(fields).toEqual({ name: "West", startDate: "2027-06-01" });
  });

  it("turns empty dates into null", () => {
    expect(sanitizeTripFields({ endDate: "" }).fields).toEqual({ endDate: null });
  });

  it.each([
    [{ name: "" }],
    [{ name: 5 }],
    [{ startDate: "June 2027" }],
    [{ view: { center: [1], zoom: 3 } }],
    [{ view: { center: [1, "2"], zoom: 3 } }],
    [null],
  ])("rejects %j", (body) => {
    expect(sanitizeTripFields(body).error).toBeTruthy();
  });

  it("accepts and normalizes a view", () => {
    const { fields } = sanitizeTripFields({ view: { center: [-70, 45], zoom: 5, junk: true } });
    expect(fields.view).toEqual({ center: [-70, 45], zoom: 5 });
  });
});

describe("sortTrips", () => {
  it("puts newest first and undated trips last", () => {
    const sorted = sortTrips([
      { id: "undated" },
      { id: "old", startDate: "2020-01-01" },
      { id: "new", startDate: "2027-01-01" },
    ]);
    expect(sorted.map((t) => t.id)).toEqual(["new", "old", "undated"]);
  });
});

describe("tripHomeView", () => {
  const pins = [{ lngLat: [-79, 44] }, { lngLat: [-63, 46] }, { lngLat: [-70, 43] }];

  it("prefers the trip's saved view", () => {
    expect(tripHomeView({ view: { center: [1, 2], zoom: 7 } }, pins)).toEqual({ center: [1, 2], zoom: 7 });
  });

  it("fits the pins otherwise", () => {
    expect(tripHomeView({ view: null }, pins)).toEqual({ bounds: [[-79, 43], [-63, 46]] });
  });

  it("centres on a lone pin instead of fitting zero-size bounds", () => {
    expect(tripHomeView({}, [{ lngLat: [-79, 44] }])).toEqual({ center: [-79, 44], zoom: 10 });
  });

  it("returns null with no view and no pins", () => {
    expect(tripHomeView({}, [])).toBeNull();
  });
});

describe("formatTripDates", () => {
  it.each([
    [{}, null],
    [{ startDate: "2026-07-01" }, "July 2026"],
    [{ startDate: "2026-07-01", endDate: "2026-07-31" }, "July 2026"],
    [{ startDate: "2026-07-01", endDate: "2026-08-15" }, "July – August 2026"],
    [{ startDate: "2025-12-20", endDate: "2026-01-05" }, "December 2025 – January 2026"],
  ])("%j → %j", (trip, expected) => {
    expect(formatTripDates(trip)).toBe(expected);
  });
});

describe("tripCoverImage", () => {
  it("returns the first photo across pins, including legacy single images", () => {
    expect(tripCoverImage([{ images: [] }, { image: "" }, { image: "/uploads/a.webp" }, { images: ["/uploads/b.webp"] }]))
      .toBe("/uploads/a.webp");
  });

  it("returns null when no pin has a photo", () => {
    expect(tripCoverImage([{ images: [] }])).toBeNull();
  });
});
