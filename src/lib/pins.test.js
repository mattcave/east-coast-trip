import { describe, it, expect } from "vitest";
import { sortPins, nextOrder, applyOrder, moveItem, sanitizePinDate, formatPinDate, pinImages, matchesStopQuery, pinLinksToWikipedia, tripSummaryFacts, stopIdFromSearch, searchWithStop } from "./pins";

const ids = (pins) => pins.map((p) => p.id);

describe("sortPins", () => {
  it("sorts by order", () => {
    const pins = [{ id: "c", order: 3 }, { id: "a", order: 1 }, { id: "b", order: 2 }];
    expect(ids(sortPins(pins))).toEqual(["a", "b", "c"]);
  });

  it("puts pins without an order last, in file order", () => {
    const pins = [{ id: "x" }, { id: "b", order: 2 }, { id: "y" }, { id: "a", order: 1 }];
    expect(ids(sortPins(pins))).toEqual(["a", "b", "x", "y"]);
  });

  it("keeps file order for duplicate orders", () => {
    const pins = [{ id: "second", order: 1 }, { id: "first", order: 1 }, { id: "zero", order: 0 }];
    expect(ids(sortPins(pins))).toEqual(["zero", "second", "first"]);
  });

  it("treats a non-integer order as missing", () => {
    const pins = [{ id: "s", order: "1" }, { id: "n", order: null }, { id: "a", order: 5 }];
    expect(ids(sortPins(pins))).toEqual(["a", "s", "n"]);
  });

  it("returns pins in file order when none have an order", () => {
    expect(ids(sortPins([{ id: "b" }, { id: "a" }]))).toEqual(["b", "a"]);
  });

  it("doesn't mutate its input", () => {
    const pins = [{ id: "b", order: 2 }, { id: "a", order: 1 }];
    sortPins(pins);
    expect(ids(pins)).toEqual(["b", "a"]);
  });

  it("handles no pins", () => {
    expect(sortPins()).toEqual([]);
  });
});

describe("nextOrder", () => {
  it("is one past the highest order", () => {
    expect(nextOrder([{ order: 3 }, { order: 7 }, {}])).toBe(8);
  });

  it("falls back to the pin count when nothing is ordered", () => {
    expect(nextOrder([{}, {}])).toBe(3);
    expect(nextOrder([])).toBe(1);
  });
});

describe("applyOrder", () => {
  const pins = [{ id: "a", order: 1 }, { id: "b", order: 2 }, { id: "c", order: 3 }];

  it("renumbers 1..n in the given order, keeping file positions", () => {
    const result = applyOrder(pins, ["c", "a", "b"]);
    expect(result).toEqual([{ id: "a", order: 2 }, { id: "b", order: 3 }, { id: "c", order: 1 }]);
  });

  it("puts pins missing from the list after the listed ones", () => {
    const result = applyOrder([...pins, { id: "new" }], ["b", "a"]);
    expect(sortPins(result).map((p) => [p.id, p.order])).toEqual([["b", 1], ["a", 2], ["c", 3], ["new", 4]]);
  });

  it("ignores unknown and repeated ids", () => {
    const result = applyOrder(pins, ["ghost", "c", "c", "b"]);
    expect(sortPins(result).map((p) => [p.id, p.order])).toEqual([["c", 1], ["b", 2], ["a", 3]]);
  });

  it("fixes duplicate orders", () => {
    const dupes = [{ id: "a", order: 1 }, { id: "b", order: 1 }];
    expect(applyOrder(dupes, ["a", "b"]).map((p) => p.order)).toEqual([1, 2]);
  });
});

describe("moveItem", () => {
  it("moves an item down and up", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("clamps the target", () => {
    expect(moveItem(["a", "b", "c"], 0, 99)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, -5)).toEqual(["c", "a", "b"]);
  });

  it("returns the same list for a no-op or bad index", () => {
    const list = ["a", "b"];
    expect(moveItem(list, 1, 1)).toBe(list);
    expect(moveItem(list, 5, 0)).toBe(list);
  });
});

describe("sanitizePinDate", () => {
  it("accepts a YYYY-MM-DD date", () => {
    expect(sanitizePinDate({ date: "2026-07-14" })).toEqual({ date: "2026-07-14" });
  });

  it("clears with null or an empty string", () => {
    expect(sanitizePinDate({ date: null })).toEqual({ date: null });
    expect(sanitizePinDate({ date: "" })).toEqual({ date: null });
  });

  it("returns nothing when date isn't in the body", () => {
    expect(sanitizePinDate({ label: "x" })).toEqual({});
  });

  it("rejects other formats", () => {
    expect(sanitizePinDate({ date: "14/07/2026" }).error).toBeDefined();
    expect(sanitizePinDate({ date: 20260714 }).error).toBeDefined();
    expect(sanitizePinDate({ date: "2026-13-45" }).error).toBeDefined();
  });
});

describe("formatPinDate", () => {
  it("formats as month and day", () => {
    expect(formatPinDate("2026-07-14")).toBe("July 14");
  });

  it("doesn't shift across timezones at the start of a month", () => {
    expect(formatPinDate("2026-08-01")).toBe("August 1");
  });

  it("returns null for missing or bad dates", () => {
    expect(formatPinDate(null)).toBeNull();
    expect(formatPinDate("soon")).toBeNull();
  });
});

describe("pinImages", () => {
  it("prefers images, falling back to the legacy image field", () => {
    expect(pinImages({ images: ["a"], image: "b" })).toEqual(["a"]);
    expect(pinImages({ image: "b" })).toEqual(["b"]);
    expect(pinImages({})).toEqual([]);
  });
});

describe("matchesStopQuery", () => {
  const pin = { label: "Chéticamp Harbour" };

  it("matches everything for a blank query", () => {
    expect(matchesStopQuery(pin, "")).toBe(true);
    expect(matchesStopQuery(pin, "   ")).toBe(true);
  });

  it("ignores case and accents", () => {
    expect(matchesStopQuery(pin, "CHETICAMP")).toBe(true);
    expect(matchesStopQuery({ label: "Cheticamp" }, "chéti")).toBe(true);
  });

  it("needs every word, in any order", () => {
    expect(matchesStopQuery(pin, "harbour chet")).toBe(true);
    expect(matchesStopQuery(pin, "harbour beach")).toBe(false);
  });
});

describe("pinLinksToWikipedia", () => {
  it("is true for auto lookup (null) and a specific article", () => {
    expect(pinLinksToWikipedia({ wikipedia: null })).toBe(true);
    expect(pinLinksToWikipedia({})).toBe(true);
    expect(pinLinksToWikipedia({ wikipedia: "https://en.wikipedia.org/wiki/Halifax" })).toBe(true);
  });

  it("is false when switched off", () => {
    expect(pinLinksToWikipedia({ wikipedia: "none" })).toBe(false);
    expect(pinLinksToWikipedia(null)).toBe(false);
  });
});

describe("tripSummaryFacts", () => {
  const photo = { images: ["/uploads/a.jpg"], wikipedia: "none" };
  const bare = { images: [], wikipedia: "none" };

  it("shows the photo line when at least half the stops have photos", () => {
    expect(tripSummaryFacts([photo, bare]).photos).toBe(true);
    expect(tripSummaryFacts([photo, bare, bare]).photos).toBe(false);
    expect(tripSummaryFacts([{ image: "/uploads/b.jpg" }]).photos).toBe(true);
  });

  it("shows neither line for a trip with no pins", () => {
    expect(tripSummaryFacts([])).toEqual({ photos: false, wikipedia: false });
    expect(tripSummaryFacts()).toEqual({ photos: false, wikipedia: false });
  });

  it("shows the Wikipedia line when any stop links to Wikipedia", () => {
    expect(tripSummaryFacts([bare, bare]).wikipedia).toBe(false);
    expect(tripSummaryFacts([bare, { wikipedia: null }]).wikipedia).toBe(true);
  });
});

describe("stopIdFromSearch", () => {
  const stops = [{ id: "a" }, { id: "b" }];

  it("returns a known stop id", () => {
    expect(stopIdFromSearch("?stop=b", stops)).toBe("b");
    expect(stopIdFromSearch("stop=a&x=1", stops)).toBe("a");
  });

  it("ignores missing and unknown ids", () => {
    expect(stopIdFromSearch("", stops)).toBe(null);
    expect(stopIdFromSearch("?stop=", stops)).toBe(null);
    expect(stopIdFromSearch("?stop=zzz", stops)).toBe(null);
    expect(stopIdFromSearch("?stop=a", [])).toBe(null);
    expect(stopIdFromSearch(undefined, stops)).toBe(null);
  });
});

describe("searchWithStop", () => {
  it("sets, replaces and removes the stop param", () => {
    expect(searchWithStop("", "a")).toBe("?stop=a");
    expect(searchWithStop("?stop=a", "b")).toBe("?stop=b");
    expect(searchWithStop("?stop=a", null)).toBe("");
    expect(searchWithStop("", null)).toBe("");
  });

  it("keeps other params", () => {
    expect(searchWithStop("?x=1&stop=a", null)).toBe("?x=1");
    expect(searchWithStop("?x=1", "a")).toBe("?x=1&stop=a");
  });
});
