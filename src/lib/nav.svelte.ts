// Navigation state plus a "back" stack, so the Android back button (and Esc) behave like users expect:
// first close whatever is open on top (a detail panel, history, a trainer session), then go back to the previous tab,
// and only exit the app from the first screen.
export type View = 'train' | 'lib' | 'solve' | 'drills' | 'set';
type Handler = () => boolean | void;

class Nav {
  view = $state<View>('solve');
  drillMode = $state<'cross' | 'oll2' | 'pll2' | 'bld'>('cross');
  hintActive = $state(false); // the Library is waiting for a case code: other keys must stay out of it
  private trail: View[] = [];
  private handlers: Handler[] = [];

  go(v: View) {
    if (v === this.view) return;
    this.trail.push(this.view);
    if (this.trail.length > 20) this.trail.shift();
    this.view = v;
  }
  /** Register something that can be closed with Back. The handler returns true when it handled the press. Returns an unregister function. */
  onBack(fn: Handler): () => void {
    this.handlers.push(fn);
    return () => { this.handlers = this.handlers.filter(h => h !== fn); };
  }
  /** true if Back was consumed; false means there is nothing left to go back to (the app may exit). */
  back(): boolean {
    for (let i = this.handlers.length - 1; i >= 0; i--) if (this.handlers[i]() === true) return true;
    const prev = this.trail.pop();
    if (prev) { this.view = prev; return true; }
    return false;
  }
}
export const nav = new Nav();
