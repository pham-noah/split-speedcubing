import { describe, it, expect } from 'vitest';
import { applyAlg, solved, isSolved, llView, f2lSolved, tokens, FACE_OF_NORMAL } from './cube';
import { invert } from './alg';
import { make2Look } from './twolook';
import { EO_STEPS, OCLL_STEPS, CORNER_STEPS, EDGE_STEPS } from '../data/twolook';
import { F2L } from '../data/f2l';
import { rotateAlg } from './rotate';
import { isZbllCase, solvesCase } from './alg';

const topEdges = (alg: string) => {
  const v = llView(applyAlg(solved(), invert(alg)));
  return [v.top[0][1], v.top[1][0], v.top[1][2], v.top[2][1]].map(c => c === 0);
};

describe('2-look steps', () => {
  it('EO algs start from the pattern they are named after', () => {
    const count = (a: string) => topEdges(a).filter(Boolean).length;
    expect(count(EO_STEPS.find(s => s.name === 'Dot')!.alg)).toBe(0);
    expect(count(EO_STEPS.find(s => s.name === 'Line')!.alg)).toBe(2);
    expect(count(EO_STEPS.find(s => s.name === 'L-shape')!.alg)).toBe(2);
    const line = topEdges(EO_STEPS[0].alg), l = topEdges(EO_STEPS[1].alg);
    // line = opposite edges, L = adjacent edges
    expect((line[0] && line[3]) || (line[1] && line[2])).toBe(true);
    expect((l[0] && line.length && (l[1] || l[2])) || (l[3] && (l[1] || l[2]))).toBe(true);
  });
  it('OCLL algs begin with all edges oriented and corners not all oriented', () => {
    for (const s of OCLL_STEPS) {
      const st = applyAlg(solved(), invert(s.alg));
      expect(f2lSolved(st), s.name).toBe(true);
      expect(topEdges(s.alg).every(Boolean), s.name).toBe(true);
      expect(llView(st).top.flat().every(c => c === 0), s.name).toBe(false);
    }
  });
  it('corner and edge perm algs keep the last layer oriented and F2L solved', () => {
    for (const s of [...CORNER_STEPS, ...EDGE_STEPS]) {
      const st = applyAlg(solved(), invert(s.alg));
      expect(f2lSolved(st), s.name).toBe(true);
      expect(llView(st).top.flat().every(c => c === 0), s.name).toBe(true);
    }
  });
  it('generated scrambles are always solved by the stated solution', () => {
    for (const kind of ['oll2', 'pll2'] as const) for (let i = 0; i < 300; i++) {
      const t = make2Look(kind);
      expect(isSolved(applyAlg(applyAlg(solved(), t.scramble), t.solution))).toBe(true);
      expect(isSolved(applyAlg(solved(), t.scramble))).toBe(false);
      expect(t.stage1 || t.stage2).toBeTruthy();
    }
  });
});

describe('F2L data', () => {
  const CORNER: Record<string, [number, number]> = { FR: [1, 1], BR: [1, -1], BL: [-1, -1], FL: [-1, 1] };
  it('has 41 cases in each of the four slots, all different', () => {
    expect(F2L.length).toBe(164);
    expect(new Set(F2L.map(c => c.id)).size).toBe(164);
    expect(new Set(F2L.map(c => c.alg)).size).toBe(164);
    for (const slot of Object.keys(CORNER)) expect(F2L.filter(c => c.slot === slot).length).toBe(41);
  });
  it('every alg leaves the cross and the other three slots alone', () => {
    for (const c of F2L) {
      const [cx, cz] = CORNER[c.slot!];
      const st = applyAlg(solved(), invert(c.alg));
      const wrong = st.filter(s => s.p[1] <= 0 && !(s.p[0] === cx && s.p[2] === cz) && FACE_OF_NORMAL(s.n) !== s.c);
      expect(wrong.length, c.id).toBe(0);
      // and the pair really is disturbed
      expect(st.some(s => s.p[0] === cx && s.p[2] === cz && s.p[1] <= 0 && FACE_OF_NORMAL(s.n) !== s.c), c.id).toBe(true);
      expect(tokens(c.alg).length).toBeLessThanOrEqual(12);
    }
  });
  it('every bundled alternative solves the same case, in all four slots', () => {
    let checked = 0;
    for (const c of F2L) {
      for (const a of c.alts ?? []) {
        expect(tokens(a).length, `${c.id} ${a}`).toBeLessThanOrEqual(12);
        expect(solvesCase(c.alg, a, true), `${c.id} ${a}`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(50);
  });
  it('rotating an alg and rotating it back is the identity, and rotation is a real cube rotation', () => {
    for (const item of F2L.filter(x => x.slot === 'FR').slice(0, 10)) {
      for (const rot of ['y', 'y2', "y'"]) {
        const back = rotateAlg(rotateAlg(item.alg, rot), rot === 'y' ? "y'" : rot === "y'" ? 'y' : 'y2');
        expect(back).toBe(item.alg);
        // conjugating by the rotation in the simulator gives the same cube as the relabelled alg
        const a = applyAlg(solved(), `${rot} ${item.alg} ${rot === 'y' ? "y'" : rot === "y'" ? 'y' : 'y2'}`);
        const b = applyAlg(solved(), rotateAlg(item.alg, rot));
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      }
    }
  });
});

describe('ZBLL validation', () => {
  it('accepts algs that start from oriented edges and rejects the rest', () => {
    expect(isZbllCase("R U R' U R U' R' U R U2 R' U R U R' U R U2 R'")).toBe(true);
    expect(isZbllCase("R U R' U R U2 R'")).toBe(true);                    // Sune: twisted corners, edges oriented
    expect(isZbllCase("R U R' U' R' F R2 U' R' U' R U R' F'")).toBe(true); // T-perm
    expect(isZbllCase("F R U R' U' F'")).toBe(false);                      // starts with flipped edges
    expect(isZbllCase("R U R' U'")).toBe(false);                           // disturbs F2L
  });
});

import { caseScramble } from './alg';
describe('case scrambles', () => {
  it('F2L scrambles put the AUF at the end, last-layer scrambles at the start', () => {
    expect(caseScramble("R U R'", 'U', true)).toBe("R U' R' U");
    expect(caseScramble("R U R'", 'U', false)).toBe("U R U' R'");
    expect(caseScramble("R U R'", '', true)).toBe("R U' R'");
  });
});
