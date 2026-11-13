import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import CaseDiagram from './CaseDiagram.svelte';
import { F2L } from '../data/f2l';
import { PLL } from '../data/pll';
import { OLL } from '../data/oll';

const fills = (html: string) => [...html.matchAll(/<rect[^>]*fill="(#[0-9A-Fa-f]{6})"/g)].map(m => m[1].toUpperCase());

describe('case diagrams render', () => {
  it('F2L: every case in every slot highlights the pair (some coloured cells, rest grey)', () => {
    for (const c of F2L) {
      const f = fills(render(CaseDiagram, { props: { alg: c.alg, mode: 'f2l', size: 64, slot: c.slot } }).body);
      expect(f.length, c.id).toBe(27);
      const coloured = f.filter(x => x !== '#4A5160').length;
      expect(coloured, c.id).toBeGreaterThanOrEqual(2);   // at least the two pieces' visible stickers
      expect(coloured, c.id).toBeLessThanOrEqual(5);      // corner (<=3) + edge (<=2)
    }
  });
  it('OLL renders a 21-sticker last-layer view; PLL renders the coloured side ring plus arrows', () => {
    for (const c of OLL.slice(0, 5)) {
      expect(fills(render(CaseDiagram, { props: { alg: c.alg, mode: 'oll' } }).body).length).toBe(21);
    }
    for (const c of PLL) {
      const html = render(CaseDiagram, { props: { alg: c.alg, mode: 'pll' } }).body;
      const f = fills(html);
      // 9 dark top cells, then the 12 side stickers of the layer in their own colours
      expect(f.length, c.id).toBe(21);
      expect(f.slice(0, 9), c.id).toEqual(Array(9).fill('#141821'));
      const ring = f.slice(9);
      expect(ring.every(x => x !== '#141821' && x !== '#4A5160'), c.id).toBe(true);
      expect(new Set(ring).size, c.id).toBeGreaterThan(1);  // the colours are what identify the case
      expect((html.match(/stroke="var\(--am\)"/g) ?? []).length, c.id).toBeGreaterThanOrEqual(2); // every PLL moves something
    }
  });
});
