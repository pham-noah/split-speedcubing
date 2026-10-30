import { describe, it, expect } from 'vitest';
import { applyAlg, solved, isSolved, llView, llFlat, f2lSolved } from './cube';
import { invert } from './alg';
import { PLL } from '../data/pll';
import { F2L, f2lSibling } from '../data/f2l';
import { SLOTS } from '../data';
import { OLL } from '../data/oll';

const scrambleState = (alg: string, pre = '', post = '') => applyAlg(solved(), `${pre} ${invert(alg)} ${post}`);

// Pattern key of the last layer, minimised over all pre/post AUF turns so cases that differ only by AUF match.
const AUF = ['', 'U', "U'", 'U2'];
function key(alg: string, orientationOnly: boolean) {
  let best = '';
  for (const a of AUF) for (const b of AUF) {
    const f = llFlat(llView(scrambleState(alg, a, b)));
    const k = (orientationOnly ? f.map(c => (c === 0 ? 1 : 0)) : f).join('');
    if (!best || k < best) best = k;
  }
  return best;
}

describe('simulator', () => {
  it('R then R\' is identity, four turns is identity', () => {
    expect(isSolved(applyAlg(solved(), "R R'"))).toBe(true);
    expect(isSolved(applyAlg(solved(), 'U U U U'))).toBe(true);
    expect(isSolved(applyAlg(solved(), 'R2 R2'))).toBe(true);
  });
  it('sexy move has order 6', () => {
    const a = Array(6).fill("R U R' U'").join(' ');
    expect(isSolved(applyAlg(solved(), a))).toBe(true);
    expect(isSolved(applyAlg(solved(), "R U R' U'"))).toBe(false);
  });
  it('slice and rotation identities', () => {
    expect(isSolved(applyAlg(solved(), "x M' L' R'"))).toBe(false); // not a no-op
    expect(isSolved(applyAlg(solved(), 'x x x x'))).toBe(true);
    expect(isSolved(applyAlg(solved(), "r R' M"))).toBe(true);     // r = R M'
    expect(isSolved(applyAlg(solved(), "l L' M'"))).toBe(true);    // l = L M
  });
});

describe('PLL data', () => {
  it('has 21 cases', () => expect(PLL.length).toBe(21));
  it.each(PLL.map(c => [c.name, c.alg]))('%s keeps F2L solved and the last layer oriented', (_n, alg) => {
    const st = scrambleState(alg);
    expect(f2lSolved(st)).toBe(true);
    expect(llView(st).top.flat().every(c => c === 0)).toBe(true);
    expect(isSolved(applyAlg(st, alg))).toBe(true);
  });
  it('every bundled alternative solves the case it ships with', () => {
    let checked = 0;
    for (const c of [...PLL, ...OLL]) {
      for (const a of c.alts ?? []) {
        expect(solvesCase(c.alg, a, false), `${c.id} ${a}`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(40);
  });
  it('the same case in another slot keeps its identity but changes its algorithm', () => {
    for (const slot of SLOTS) {
      const id = f2lSibling('F2L-7', slot);
      expect(id).toBe(slot === 'FR' ? 'F2L-7' : `F2L-7-${slot}`);
      const c = F2L.find(x => x.id === id);
      expect(c, id).toBeTruthy();
      expect(c!.slot).toBe(slot);
      if (slot !== 'FR') expect(c!.alg).not.toBe(F2L.find(x => x.id === 'F2L-7')!.alg);   // rotated, not copied
      expect(c!.alts?.length ?? 0).toBe(F2L.find(x => x.id === 'F2L-7')!.alts?.length ?? 0);
    }
    expect(f2lSibling('F2L-7-FL', 'FR')).toBe('F2L-7');   // and back again
  });

  it('every PLL is a distinct case', () => {
    const keys = PLL.map(c => key(c.alg, false));
    expect(new Set(keys).size).toBe(21);
  });
});

describe('OLL data', () => {
  it('has 57 cases', () => expect(OLL.length).toBe(57));
  it.each(OLL.map(c => [c.name, c.alg]))('%s keeps F2L solved', (_n, alg) => {
    expect(f2lSolved(scrambleState(alg))).toBe(true);
  });
  it('every OLL is a distinct orientation case', () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const c of OLL) {
      const k = key(c.alg, true);
      if (seen.has(k)) dupes.push(`${c.name} == ${seen.get(k)}`);
      seen.set(k, c.name);
    }
    expect(dupes).toEqual([]);
  });
  it('no OLL case is already oriented', () => {
    for (const c of OLL) {
      const top = llView(scrambleState(c.alg)).top.flat();
      expect(top.every(x => x === 0), c.name).toBe(false);
    }
  });
});

import { solvesCase, validateAlg, moveCount } from './alg';
import { normalize } from '../storage/model';
describe('custom algorithms', () => {
  const T = PLL.find(c => c.name === 'T-perm')!.alg;
  it('accepts a different algorithm for the same case, with or without a final AUF', () => {
    expect(solvesCase(T, T)).toBe(true);
    expect(solvesCase(T, `${T} U`)).toBe(true);
    expect(solvesCase(T, "R U R' U'")).toBe(false);
  });
  it('rejects alg for a different case', () => {
    const Y = PLL.find(c => c.name === 'Y-perm')!.alg;
    expect(solvesCase(T, Y)).toBe(false);
  });
  it('validates move syntax', () => {
    expect(validateAlg("R U R' U'")).toBeNull();
    expect(validateAlg('')).not.toBeNull();
    expect(validateAlg('R Q U')).toContain('Q');
  });
  it('counts moves without rotations', () => expect(moveCount("y R U2 R'")).toBe(3));
  it('migrates the v0.1 single alg field', () => {
    const d = normalize({ solves: [], cards: { 'PLL-T': { due: 0, seen: true, alg: "R U R' U'", attempts: [] } } });
    expect(d.cards['PLL-T'].algs).toEqual(["R U R' U'"]);
    expect(d.cards['PLL-T'].defaultAlg).toBe("R U R' U'");
    expect(d.cards['PLL-T'].alg).toBeUndefined();
  });
});
