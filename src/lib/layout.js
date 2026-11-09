// When the stop panel and stops list dock to the right of the map instead
// of being a bottom sheet: a wide screen in landscape. Width alone isn't
// enough: a 13-inch iPad is 1024px wide in portrait, and docking there
// split a tall, narrow screen into half map, half panel.
//
// Mirrored by the `dock:` and `dock-wide:` Tailwind variants in
// globals.css; keep them in step.
export const DOCKED_PANEL_QUERY = "(min-width: 1024px) and (orientation: landscape)";
