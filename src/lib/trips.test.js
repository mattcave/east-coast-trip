import { describe, it, expect, vi, afterEach } from "vitest";
import {
  isValidTripId,
  slugify,
  uniqueTripId,
  sanitizeTripFields,
  sortTrips,
  tripHomeView,
  overviewHomeView,
  formatTripDates,
  formatTripDayRange,
  tripCoverImage,
  flyToView,
  easeToPoint,
  setMapInset,
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

  it("fits the pins, even when the trip has a saved view", () => {
    expect(tripHomeView({ view: { center: [1, 2], zoom: 7 } }, pins)).toEqual({ bounds: [[-79, 43], [-63, 46]] });
    expect(tripHomeView({ view: null }, pins)).toEqual({ bounds: [[-79, 43], [-63, 46]] });
  });

  it("uses the saved view for a trip with no pins", () => {
    expect(tripHomeView({ view: { center: [1, 2], zoom: 7 } }, [])).toEqual({ center: [1, 2], zoom: 7 });
  });

  it("ignores pins without usable coordinates", () => {
    expect(tripHomeView({ view: { center: [1, 2], zoom: 7 } }, [{ lngLat: null }])).toEqual({ center: [1, 2], zoom: 7 });
  });

  it("centres on a lone pin instead of fitting zero-size bounds", () => {
    expect(tripHomeView({}, [{ lngLat: [-79, 44] }])).toEqual({ center: [-79, 44], zoom: 10 });
  });

  it("returns null with no view and no pins", () => {
    expect(tripHomeView({}, [])).toBeNull();
  });
});

describe("overviewHomeView", () => {
  it("fits all trips' pins, using a saved view centre for trips without pins", () => {
    const trips = [
      { id: "a", view: { center: [0, 0], zoom: 9 } },
      { id: "b", view: { center: [50, 50], zoom: 9 } },
      { id: "c", view: null },
    ];
    const pinsByTrip = { a: [{ lngLat: [-79, 44] }, { lngLat: [-63, 46] }], c: [{ lngLat: [-123, 49] }] };
    expect(overviewHomeView(trips, pinsByTrip)).toEqual({ bounds: [[-123, 44], [50, 50]] });
  });

  it("returns null when no trip has pins or a saved view", () => {
    expect(overviewHomeView([{ id: "a", view: null }], {})).toBeNull();
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

describe("formatTripDayRange", () => {
  it("shows a day range within one month", () => {
    expect(formatTripDayRange({ startDate: "2026-08-14", endDate: "2026-08-31" })).toBe("14–31 Aug 2026");
  });

  it("shows both months across a month boundary", () => {
    expect(formatTripDayRange({ startDate: "2026-07-28", endDate: "2026-08-03" })).toBe("28 Jul – 3 Aug 2026");
  });

  it("shows both years across a year boundary", () => {
    expect(formatTripDayRange({ startDate: "2025-12-28", endDate: "2026-01-03" })).toBe("28 Dec 2025 – 3 Jan 2026");
  });

  it("shows a single day once", () => {
    expect(formatTripDayRange({ startDate: "2026-08-14", endDate: "2026-08-14" })).toBe("14 Aug 2026");
  });

  it("shows the month and year with only one date", () => {
    expect(formatTripDayRange({ startDate: "2026-08-14" })).toBe("Aug 2026");
    expect(formatTripDayRange({ startDate: "2027-09-02", endDate: null })).toBe("Sep 2027");
    expect(formatTripDayRange({ endDate: "2026-08-31" })).toBe("Aug 2026");
  });

  it("leaves the date out with neither, or with bad dates", () => {
    expect(formatTripDayRange({})).toBe(null);
    expect(formatTripDayRange(null)).toBe(null);
    expect(formatTripDayRange({ startDate: "soon" })).toBe(null);
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

// Records camera calls instead of moving a real map
function fakeMap({ width = 1000, height = 600 } = {}) {
  return {
    calls: [],
    fitBounds(...args) { this.calls.push(["fitBounds", ...args]); },
    flyTo(...args) { this.calls.push(["flyTo", ...args]); },
    easeTo(...args) { this.calls.push(["easeTo", ...args]); },
    jumpTo(...args) { this.calls.push(["jumpTo", ...args]); },
    getCanvas: () => ({ clientWidth: width, clientHeight: height }),
    // Pixel coordinates stand in for lng/lat so the maths is easy to check
    unproject: ([x, y]) => ({ x, y }),
  };
}

function stubReducedMotion(reduce) {
  vi.stubGlobal("window", { matchMedia: () => ({ matches: reduce }) });
}

describe("camera helpers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fits bounds with padding, animated by default", () => {
    stubReducedMotion(false);
    const map = fakeMap();
    flyToView(map, { bounds: [[0, 0], [1, 1]] });
    const [name, bounds, options] = map.calls[0];
    expect(name).toBe("fitBounds");
    expect(bounds).toEqual([[0, 0], [1, 1]]);
    expect(options).toMatchObject({ animate: true, maxZoom: 12 });
    expect(options.padding.top).toBeGreaterThan(0);
  });

  it("jumps instead of flying when reduced motion is on", () => {
    stubReducedMotion(true);
    const map = fakeMap();
    flyToView(map, { center: [1, 2], zoom: 5 });
    flyToView(map, { bounds: [[0, 0], [1, 1]] });
    easeToPoint(map, [3, 4]);
    expect(map.calls.map((c) => c[0])).toEqual(["jumpTo", "fitBounds", "jumpTo"]);
    expect(map.calls[1][2].animate).toBe(false);
  });

  it("eases to a point with an optional inset and zoom", () => {
    stubReducedMotion(false);
    const map = fakeMap();
    easeToPoint(map, [3, 4], { inset: { right: 400 }, zoom: 9 });
    expect(map.calls[0]).toEqual(["easeTo", { center: [3, 4], padding: { right: 400 }, zoom: 9 }]);
  });

  it("fits into the strip above a sheet when given an inset", () => {
    stubReducedMotion(false);
    const map = fakeMap();
    flyToView(map, { bounds: [[0, 0], [1, 1]] }, { inset: { top: 60, bottom: 400 } });
    const { padding } = map.calls[0][2];
    expect(padding.top).toBe(76);
    expect(padding.bottom).toBe(424);
    expect(padding.left).toBeGreaterThan(0);
  });

  it("ignores an inset that leaves no room to fit into", () => {
    stubReducedMotion(false);
    const map = fakeMap({ width: 375, height: 667 });
    flyToView(map, { bounds: [[0, 0], [1, 1]] }, { inset: { top: 66, bottom: 567 } });
    expect(map.calls[0][2].padding.bottom).toBe(48);
  });

  it("always sets padding on a single-spot view, so an old inset is cleared", () => {
    stubReducedMotion(false);
    const map = fakeMap();
    flyToView(map, { center: [1, 2], zoom: 5 });
    expect(map.calls[0]).toEqual(["flyTo", { center: [1, 2], zoom: 5, padding: { top: 0, right: 0, bottom: 0, left: 0 } }]);
    flyToView(map, { center: [1, 2], zoom: 5 }, { inset: { bottom: 300 } });
    expect(map.calls[1][1].padding).toEqual({ top: 0, right: 0, bottom: 300, left: 0 });
  });

  it("clears padding left over from an earlier ease before fitting", () => {
    stubReducedMotion(false);
    const map = { ...fakeMap({ width: 1000, height: 600 }), getPadding: () => ({ top: 0, right: 400, bottom: 0, left: 0 }) };
    map.calls = [];
    flyToView(map, { bounds: [[0, 0], [1, 1]] });
    expect(map.calls.map((c) => c[0])).toEqual(["jumpTo", "fitBounds"]);
  });

  it("does nothing without a map or target", () => {
    expect(() => flyToView(null, { center: [0, 0], zoom: 1 })).not.toThrow();
    expect(() => easeToPoint(fakeMap(), null)).not.toThrow();
  });

  it("clears the inset while keeping the same spot in the middle of the screen", () => {
    const map = fakeMap({ width: 1000, height: 600 });
    setMapInset(map);
    expect(map.calls[0]).toEqual(["jumpTo", { center: { x: 500, y: 300 }, padding: { top: 0, right: 0, bottom: 0, left: 0 } }]);
  });

  it("sets an inset, picking the centre of the uncovered area", () => {
    const map = fakeMap({ width: 1000, height: 600 });
    setMapInset(map, { right: 400 });
    expect(map.calls[0][1].center).toEqual({ x: 300, y: 300 });
  });
});
