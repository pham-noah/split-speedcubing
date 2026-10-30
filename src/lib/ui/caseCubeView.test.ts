import { describe, it, expect } from 'vitest';
import { applyAlg, solved } from '../core/cube';
import { invert } from '../core/alg';
import { F2L } from '../data/f2l';
import { SLOTS, SLOT_NAMES } from '../data';
import { chooseView, depthZ, thumbQuads, inPlane, pairPositions, project, visibleFaces, PITCH, VIEW } from './caseCubeView';

const COL = ['#ffffff', '#ffd500', '#c41e3a', '#ff5800', '#009e60', '#0051ba'];
const DARK = '#2A2F3A';
const ACCENT = '#e3b84e';

const area = (points: string) => {
  const p = points.split(' ').map(s => s.split(',').map(Number));
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
};

describe('case view: the framing shared by the 3D cube and the flat thumbnail', () => {
  it('every F2L case draws exactly the 27 stickers a fixed camera can see', () => {
    for (const c of F2L) {
      const st = applyAlg(solved(), invert(c.alg));
      const { quads } = thumbQuads(st, c.slot!,  54, COL, DARK, ACCENT);
      expect(quads.length, c.id).toBe(27);
      for (const q of quads) expect(area(q.points), `${c.id} ${q.key}`).toBeGreaterThan(0.2);
    }
  });

  it('draws nothing back-facing and stays inside the box it was given', () => {
    for (const c of F2L.slice(0, 12)) {
      const st = applyAlg(solved(), invert(c.alg));
      const { quads, yaw } = thumbQuads(st, c.slot!,  54, COL, DARK, ACCENT);
      for (const q of quads) {
        for (const pt of q.points.split(' ')) {
          const [x, y] = pt.split(',').map(Number);
          expect(x).toBeGreaterThanOrEqual(-0.6);
          expect(x).toBeLessThanOrEqual(54.6);
          expect(y).toBeGreaterThanOrEqual(-0.6);
          expect(y).toBeLessThanOrEqual(54.6);
        }
      }
      // exactly the analytic visible normals are drawn, and nothing else
      const drawnNormals = new Set(quads.map(q => q.key.split('|')[1]).map(k => k.split(',').map(Number).join(',')));
      const visibleNormals = new Set(st.filter(s2 => depthZ(s2.n, yaw) > 0).map(s2 => s2.n.join(',')));
      expect([...drawnNormals].sort()).toEqual([...visibleNormals].sort());
      expect(drawnNormals.size).toBe(3);
    }
  });

  it('colours the pair and greys everything else', () => {
    let tinted = 0;
    for (const c of F2L) {
      const st = applyAlg(solved(), invert(c.alg));
      const { quads } = thumbQuads(st, c.slot!,  54, COL, DARK, ACCENT);
      const pair = pairPositions(st, c.slot!);
      const coloured = quads.filter(q => !q.dim);
      const tint = coloured.some(q => q.fill === ACCENT);
      if (tint) tinted++;
      for (const q of quads) {
        const pos = q.key.split('|')[0];
        expect(q.dim, `${c.id} ${q.key}`).toBe(!pair.has(pos));
        if (!q.dim) expect(COL).toContain(q.fill);   // a real cube colour, not grey
      }
      expect(coloured.length, c.id).toBeGreaterThan(0);
    }
    // the tint exists for a reason, but it must stay the exception
    expect(tinted).toBeLessThan(F2L.length / 2);
  });

  it('every slot is drawn from the same rules, and the four slots differ', () => {
    const ids = SLOTS.map(s => s);
    expect(ids).toEqual(['FR', 'FL', 'BL', 'BR']);
    expect(new Set(Object.values(SLOT_NAMES)).size).toBe(4);
    const c = F2L.find(x => x.id === 'F2L-1')!;
    const yaws = ids.map(slot => chooseView(applyAlg(solved(), invert(c.alg)), slot!).yaw);
    expect(yaws).toEqual([-35, 35, 145, -145]);
  });

  it('the projection keeps y pointing down and puts the camera above the cube', () => {
    // a point higher in the world must be higher on the screen (smaller y)
    const [, low] = project([0, -1, 0], 0);
    const [, high] = project([0, 1, 0], 0);
    expect(high).toBeLessThan(low);   // screen y grows downward
    // the front face is visible at yaw 0; the back one is not
    expect(depthZ([0, 0, 1], 0)).toBeGreaterThan(0);
    expect(depthZ([0, 0, -1], 0)).toBeLessThan(0);
    // the camera looks slightly down at the cube: the top face is the one an F2L case lives on
    expect(depthZ([0, 1, 0], 0, PITCH)).toBeGreaterThan(0);
    expect(depthZ([0, -1, 0], 0, PITCH)).toBeLessThan(0);
    // every slot looks at the pair from slightly above: top, front and one side, never the bottom
    for (const slot of SLOTS) {
      const v = [...visibleFaces(VIEW[slot]!)].sort();
      expect(v, slot!).toHaveLength(3);
      expect(v).toContain('0,1,0');
      expect(v).not.toContain('0,-1,0');
    }
  });

  it('the in-plane axes never are the normal, and always span a square', () => {
    for (const n of [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]] as [number, number, number][]) {
      const [u, v] = inPlane(n);
      const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      expect(dot(u, n)).toBe(0);
      expect(dot(v, n)).toBe(0);
      expect(dot(u, v)).toBe(0);
      expect(Math.hypot(...u)).toBe(1);
      expect(Math.hypot(...v)).toBe(1);
    }
  });
});
