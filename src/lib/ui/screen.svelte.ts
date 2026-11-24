/** A media query as reactive state.
 *
 *  The app hides things with CSS that a control elsewhere still offers: the 3D cube panel is
 *  `display:none` under 900px, and Settings → Screen layout kept a toggle for it, so the phone carried
 *  two switches that could not do anything. Rendering the control only where the layout allows it keeps
 *  the promise the UI makes — every control the user can see, they can use.
 *
 *  Usage is one line at component init: `const cubeOk = media('(min-width:900px)')`, then `cubeOk.on`.
 */
export function media(query: string) {
  let on = $state(false);
  $effect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const m = window.matchMedia(query);
    const sync = () => (on = m.matches);
    sync();
    m.addEventListener('change', sync);
    return () => m.removeEventListener('change', sync);
  });
  return {
    get on() {
      return on;
    },
  };
}
