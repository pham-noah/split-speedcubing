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
  it('OLL renders a 21-sticker last-layer view; PLL renders movement arrows, no colour', () => {
    for (const c of OLL.slice(0, 5)) {
      expect(fills(render(CaseDiagram, { props: { alg: c.alg, mode: 'oll' } }).body).length).toBe(21);
    }
    for (const c of PLL) {
      const html = render(CaseDiagram, { props: { alg: c.alg, mode: 'pll' } }).body;
      const f = fills(html);
      expect(f.length, c.id).toBe(9);                       // the 3x3 grid, drawn dark
      expect([...new Set(f)], c.id).toEqual(['#141821']);
      expect((html.match(/stroke="var\(--am\)"/g) ?? []).length, c.id).toBeGreaterThanOrEqual(2); // every PLL moves something
    }
  });
});
