import {
  Home, Camera, Tent,
  Utensils, TreePine, Waves, Landmark, MapPin,
} from "lucide-react";

// Available pin icons. Add entries here to expand the set.
// Keys are stored in pins.json and used in the editor icon picker.
export const PIN_ICONS = {
  home:     { icon: Home,      label: "Home",     color: "#d97706" }, // amber
  landmark: { icon: Landmark,  label: "Landmark", color: "#7c3aed" }, // purple
  camera:   { icon: Camera,    label: "Scenic",   color: "#0d9488" }, // teal
  tent:     { icon: Tent,      label: "Camping",  color: "#92400e" }, // brown
  food:     { icon: Utensils,  label: "Food",     color: "#dc2626" }, // red
  nature:   { icon: TreePine,  label: "Nature",   color: "#16a34a" }, // green
  beach:    { icon: Waves,     label: "Beach",    color: "#0284c7" }, // sky blue
  default:  { icon: MapPin,    label: "Pin",      color: "#2563eb" }, // blue
};
