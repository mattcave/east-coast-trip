import {
  Home, Tent,
  Utensils, TreePine, Waves, Landmark, MapPin,
  Zap, Bird, Star,
} from "lucide-react";

// Available pin icons. Add entries here to expand the set.
// Keys are stored on each pin (data/pins/<trip-id>.json) and used in the editor icon picker.
// Colours from the creative director's palette: each one is distinct on
// the map and gives at least 3:1 contrast with the white icon on it.
// Nature and Wildlife share a colour on purpose; the icon tells them apart.
export const PIN_ICONS = {
  home:       { icon: Home,      label: "Home",       color: "#a86a12" }, // gold
  landmark:   { icon: Landmark,  label: "Landmark",   color: "#9f3a22" }, // brick — historic sites, museums, forts, heritage towns
  tent:       { icon: Tent,      label: "Camping",    color: "#23523b" }, // pine
  food:       { icon: Utensils,  label: "Food",       color: "#e0662b" }, // orange
  nature:     { icon: TreePine,  label: "Nature",     color: "#5b9a2e" }, // leaf — trails, waterfalls, scenic drives
  beach:      { icon: Waves,     label: "Beach",      color: "#1d74b0" }, // ocean — beaches and swim spots
  activity:   { icon: Zap,       label: "Activity",   color: "#0e8a87" }, // teal — playgrounds, boardwalks, active family fun
  wildlife:   { icon: Bird,      label: "Wildlife",   color: "#5b9a2e" }, // leaf, as Nature
  attraction: { icon: Star,      label: "Attraction", color: "#d6336c" }, // raspberry — novelty sights, statues, ships, viewpoints
  default:    { icon: MapPin,    label: "Other",      color: "#64748b" }, // slate
};
