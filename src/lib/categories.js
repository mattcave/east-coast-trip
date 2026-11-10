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
// keep is a pin id, or a list of them: the open stop and its neighbours,
// kept even when their category is filtered out, so the panel never
// describes a marker that isn't on the map and Previous/Next always lead
// to one that is.
export function filterPinsByCategory(pins, selected, keep = null) {
  if (!selected || selected.size === 0) return pins;
  const keepIds = new Set([keep].flat().filter(Boolean));
  return pins.filter((pin) => selected.has(pinCategory(pin)) || keepIds.has(pin.id));
}
