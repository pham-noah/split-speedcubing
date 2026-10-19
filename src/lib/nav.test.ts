import { describe, it, expect } from 'vitest';
import { nav } from './nav.svelte';

describe('back handling', () => {
  it('closes overlays first, then goes to the previous tab, then reports nothing left', () => {
    expect(nav.view).toBe('solve');
    nav.go('lib'); nav.go('train');
    let open = true;
    const off = nav.onBack(() => { if (open) { open = false; return true; } return false; });
    expect(nav.back()).toBe(true);          // closes the overlay
    expect(open).toBe(false);
    expect(nav.view).toBe('train');
    expect(nav.back()).toBe(true);          // overlay no longer handles it -> previous tab
    expect(nav.view).toBe('lib');
    off();
    expect(nav.back()).toBe(true);
    expect(nav.view).toBe('solve');
    expect(nav.back()).toBe(false);         // root: the app may exit
  });
  it('the most recent overlay is closed first', () => {
    const order: string[] = [];
    const a = nav.onBack(() => { order.push('a'); return true; });
    const b = nav.onBack(() => { order.push('b'); return true; });
    nav.back(); nav.back();
    expect(order).toEqual(['b', 'b']);
    b(); nav.back();
    expect(order).toEqual(['b', 'b', 'a']);
    a();
  });
  it('going to the same tab does not add history', () => {
    nav.go('solve');
    expect(nav.back()).toBe(false);
  });
});
