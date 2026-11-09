import { PIN_ICONS } from "./icons";

// The category a pin is shown as. Pins with a missing or unknown icon key
// render with the default marker, so they count as "default" here too.
export function pinCategory(pin) {
  return pin?.icon && PIN_ICONS[pin.icon] ? pin.icon : "default";
}

// The categories a trip actually uses, in the order PIN_ICONS lists them,
// so the filter chips keep a stable order from trip to trip
export function tripCategories(pins = []) {
  const used = new Set(pins.map(pinCategory));
  return Object.keys(PIN_ICONS).filter((key) => used.has(key));
}

// Pins whose category is selected. An empty selection means no filter.
// keepId is the open stop, kept even when its category is filtered out so
// the panel never describes a marker that isn't on the map.
export function filterPinsByCategory(pins, selected, keepId = null) {
  if (!selected || selected.size === 0) return pins;
  return pins.filter((pin) => selected.has(pinCategory(pin)) || pin.id === keepId);
}
