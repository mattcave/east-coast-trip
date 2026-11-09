import { describe, it, expect } from "vitest";
import { pinCategory, tripCategories, filterPinsByCategory } from "./categories";

const pins = [
  { id: "a", icon: "food" },
  { id: "b", icon: "home" },
  { id: "c", icon: "mystery" },
  { id: "d" },
  { id: "e", icon: "food" },
];

describe("pinCategory", () => {
  it("uses the pin's icon, falling back to default for missing or unknown icons", () => {
    expect(pinCategory(pins[0])).toBe("food");
    expect(pinCategory(pins[2])).toBe("default");
    expect(pinCategory(pins[3])).toBe("default");
  });
});

describe("tripCategories", () => {
  it("lists each used category once, in PIN_ICONS order", () => {
    expect(tripCategories(pins)).toEqual(["home", "food", "default"]);
  });

  it("is empty for a trip with no pins", () => {
    expect(tripCategories([])).toEqual([]);
  });
});

describe("filterPinsByCategory", () => {
  it("returns every pin when nothing is selected", () => {
    expect(filterPinsByCategory(pins, new Set())).toBe(pins);
    expect(filterPinsByCategory(pins, null)).toBe(pins);
  });

  it("keeps only the selected categories", () => {
    expect(filterPinsByCategory(pins, new Set(["food"])).map((p) => p.id)).toEqual(["a", "e"]);
    expect(filterPinsByCategory(pins, new Set(["food", "default"])).map((p) => p.id)).toEqual(["a", "c", "d", "e"]);
  });

  it("keeps the open stop even when its category is filtered out", () => {
    expect(filterPinsByCategory(pins, new Set(["food"]), "b").map((p) => p.id)).toEqual(["a", "b", "e"]);
  });
});
