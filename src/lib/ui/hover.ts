// Hovering a tab opens it. A short delay means passing the pointer across a row of tabs
// does not flick through them; leaving the tab cancels the pending switch.
let pending: ReturnType<typeof setTimeout> | undefined;

export function hoverEnter(fn: () => void, ms = 120) {
  clearTimeout(pending);
  pending = setTimeout(fn, ms);
}

export function hoverLeave() {
  clearTimeout(pending);
}
