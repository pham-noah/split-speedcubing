import type { Slot } from '../data';
import type { State as CubeState } from '../core/cube';

// The one place that decides how an F2L case is framed: which corner and edge belong to the slot, which
// way to turn the cube so they are in sight, and the 3D -> 2D projection. CaseCube draws it with CSS 3D,
// CaseThumb draws flat SVG; both read the view from here so they cannot drift apart.

export const SIDES: Record<Slot, [number, number]> = { FR: [4, 2], FL: [4, 3], BR: [5, 2], BL: [5, 3] };
export const VIEW: Record<Slot, number> = { FR: -35, FL: 35, BR: -145, BL: 145 };
export const PITCH = -26;

export type Vec3 = [number, number, number];

/** the two pieces the case has to join, by their sorted colour signature */
export function pairWant(slotId: Slot) {
  const [a, b] = SIDES[slotId];
  // the pair belongs to the D layer, which is white in this app (hold white on the bottom)
  return { corner: [1, a, b].sort((x, y) => x - y).join(), edge: [a, b].sort((x, y) => x - y).join() };
}

/** positions (as "x,y,z") of the corner and edge that belong in this slot, wherever they sit now */
export function pairPositions(stickers: CubeState, slotId: Slot): Set<string> {
  const want = pairWant(slotId);
  const groups = new Map<string, number[]>();
  for (const s of stickers) {
    const k = s.p.join(',');
    groups.set(k, [...(groups.get(k) ?? []), s.c]);
  }
  const hit = new Set<string>();
  for (const [pos, cols] of groups) {
    const sig = [...cols].sort((x, y) => x - y).join();
    if (sig === want.corner || sig === want.edge) hit.add(pos);
  }
  return hit;
}

export const FACE_NORMALS: Vec3[] = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]];

/** CSS space has y pointing DOWN while the simulator's y points up (Cube3D places a cubie at
 *  translate3d(x, -y*U, z)), so everything below mirrors y first. Without it the three-face view culls
 *  the top and draws the bottom — the face an F2L case sits on. */
const css = (v: Vec3): Vec3 => [v[0], -v[1], v[2]];

/** how much of a normal points at the camera (positive means visible) */
export function depthZ(n: Vec3, yawDeg: number, pitchDeg = PITCH): number {
  const ry = (yawDeg * Math.PI) / 180, rx = (pitchDeg * Math.PI) / 180;
  const [x, y, z] = css(n);
  const z1 = -x * Math.sin(ry) + z * Math.cos(ry);
  return y * Math.sin(rx) + z1 * Math.cos(rx);
}

/** the three face normals (simulator space) a fixed camera can see */
export function visibleFaces(yawDeg: number, pitchDeg = PITCH): Set<string> {
  return new Set(FACE_NORMALS.filter(n => depthZ(n, yawDeg, pitchDeg) > 0).map(n => n.join(',')));
}

/** Keep the camera above the cube (white stays on the bottom) and only turn it around the vertical axis.
 *  If even then the pair is mostly hidden, say so: the caller tints the pair instead of colouring it. */
export function chooseView(stickers: CubeState, slotId: Slot) {
  const pair = pairPositions(stickers, slotId);
  const options = [VIEW[slotId], -35, 35, -145, 145];
  let best = VIEW[slotId], bestScore = -1;
  for (const yaw of options) {
    let score = 0;
    for (const st of stickers) if (pair.has(st.p.join(',')) && depthZ(st.n, yaw) > 0) score++;
    if (score > bestScore) { bestScore = score; best = yaw; }
  }
  return { yaw: best, tint: bestScore < 2, pair };
}

/** the two in-plane axes of a face: never the normal, and always spanning the sticker's 1x1 square */
export function inPlane(n: Vec3): [Vec3, Vec3] {
  if (n[1] !== 0) return [[1, 0, 0], [0, 0, n[1] > 0 ? -1 : 1]];      // top / bottom
  if (n[2] !== 0) return [[0, 1, 0], [n[2] > 0 ? -1 : 1, 0, 0]];      // front / back
  return [[0, 1, 0], [0, 0, n[0] > 0 ? -1 : 1]];                      // right / left
}

/** project a world point through the same rotations CSS applies (yaw first, then pitch), then to screen
 *  pixels with y pointing down and an orthographic camera — no perspective, so a 60px thumbnail is stable */
export function project(p: Vec3, yawDeg: number, pitchDeg = PITCH): [number, number] {
  const ry = (yawDeg * Math.PI) / 180, rx = (pitchDeg * Math.PI) / 180;
  const [x, y, z] = css(p);
  const x1 = x * Math.cos(ry) + z * Math.sin(ry);
  const z1 = -x * Math.sin(ry) + z * Math.cos(ry);
  // CSS y already points down, so y2 needs no extra negation
  return [x1, y * Math.cos(rx) - z1 * Math.sin(rx)];
}

export type Quad = { points: string; key: string; fill: string; dim: boolean };

/** every visible sticker as a projected quad, fitted to a size x size box */
export function thumbQuads(
  stickers: CubeState, slotId: Slot, size: number, colours: string[], dark: string, accent: string,
): { quads: Quad[]; yaw: number } {
  const { yaw, tint, pair } = chooseView(stickers, slotId);
  // fit: project the cube's corners once and scale so the silhouette fills the box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const x of [-1.5, 1.5]) for (const y of [-1.5, 1.5]) for (const z of [-1.5, 1.5]) {
    const [px, py] = project([x, y, z], yaw);
    minX = Math.min(minX, px); maxX = Math.max(maxX, px);
    minY = Math.min(minY, py); maxY = Math.max(maxY, py);
  }
  const pad = 1;
  const s = (size - pad * 2) / Math.max(maxX - minX, maxY - minY);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const tx = (v: number) => size / 2 + (v - cx) * s;
  const ty = (v: number) => size / 2 + (v - cy) * s;

  const quads: Quad[] = [];
  for (const st of stickers) {
    if (depthZ(st.n, yaw) <= 0) continue;          // back-facing: never drawn
    const [u, v] = inPlane(st.n);
    const c: Vec3 = [st.p[0] + st.n[0] * 0.5, st.p[1] + st.n[1] * 0.5, st.p[2] + st.n[2] * 0.5];
    const corner = (su: number, sv: number): Vec3 =>
      [c[0] + u[0] * su * 0.5 + v[0] * sv * 0.5, c[1] + u[1] * su * 0.5 + v[1] * sv * 0.5, c[2] + u[2] * su * 0.5 + v[2] * sv * 0.5];
    const pts = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)]
      .map(p => { const [px, py] = project(p, yaw); return `${tx(px).toFixed(2)},${ty(py).toFixed(2)}`; });
    const inPair = pair.has(st.p.join(','));
    quads.push({
      key: `${st.p.join(',')}|${st.n.join(',')}`,
      points: pts.join(' '),
      fill: !inPair ? dark : tint ? accent : colours[st.c],
      dim: !inPair,
    });
  }
  return { quads, yaw };
}
