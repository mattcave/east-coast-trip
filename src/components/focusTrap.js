// Keeps Tab and Shift+Tab inside a modal dialog. Used as the dialog's
// onKeyDown, so it only sees keys while focus is already inside it; the
// dialogs move focus in when they open. Layers on top (the photo viewer)
// are siblings rather than children, so their keys never reach this.
const FOCUSABLE = [
  "a[href]", "button:not([disabled])", "input:not([disabled])", "select:not([disabled])",
  "textarea:not([disabled])", "[tabindex]:not([tabindex='-1'])",
].join(",");

export function trapTabKey(e, container) {
  if (e.key !== "Tab" || !container) return;
  const items = [...container.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
  if (items.length === 0) {
    e.preventDefault();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  // The dialog itself holds focus right after opening (tabIndex -1), so
  // Shift+Tab from there wraps to the end as well
  if (e.shiftKey && (active === first || active === container)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}
