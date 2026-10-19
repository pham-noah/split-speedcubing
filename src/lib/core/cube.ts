// Sticker-level 3x3 simulator. Every sticker has a position and a normal in {-1,0,1}^3.
// A move rotates the stickers of one layer. Colours are fixed to the sticker's starting face.
export type V = [number, number, number];
export interface Sticker { p: V; n: V; c: number }
export type State = Sticker[];

// colour ids: 0=U(yellow) 1=D(white) 2=R(red) 3=L(orange) 4=F(green) 5=B(blue)
export const FACE_OF_NORMAL = (n: V) => (n[1] === 1 ? 0 : n[1] === -1 ? 1 : n[0] === 1 ? 2 : n[0] === -1 ? 3 : n[2] === 1 ? 4 : 5);

export function solved(): State {
  const s: State = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    if (!x && !y && !z) continue;
    const add = (n: V) => s.push({ p: [x, y, z], n, c: FACE_OF_NORMAL(n) });
    if (x) add([x, 0, 0]);
    if (y) add([0, y, 0]);
    if (z) add([0, 0, z]);
  }
  return s;
}

// rotate by +90deg (s=1) or -90deg (s=-1) about an axis
const rot = (v: V, axis: 0 | 1 | 2, s: 1 | -1): V => {
  const [x, y, z] = v;
  if (axis === 0) return s === 1 ? [x, -z, y] : [x, z, -y];
  if (axis === 1) return s === 1 ? [z, y, -x] : [-z, y, x];
  return s === 1 ? [-y, x, z] : [y, -x, z];
};

interface Def { axis: 0 | 1 | 2; test: (p: V) => boolean; s: 1 | -1 }
const all = () => true;
// "clockwise seen from outside the face" gives these signs
const DEFS: Record<string, Def> = {
  R: { axis: 0, test: p => p[0] === 1, s: -1 },
  L: { axis: 0, test: p => p[0] === -1, s: 1 },
  U: { axis: 1, test: p => p[1] === 1, s: -1 },
  D: { axis: 1, test: p => p[1] === -1, s: 1 },
  F: { axis: 2, test: p => p[2] === 1, s: -1 },
  B: { axis: 2, test: p => p[2] === -1, s: 1 },
  M: { axis: 0, test: p => p[0] === 0, s: 1 },
  E: { axis: 1, test: p => p[1] === 0, s: 1 },
  S: { axis: 2, test: p => p[2] === 0, s: -1 },
  r: { axis: 0, test: p => p[0] >= 0, s: -1 },
  l: { axis: 0, test: p => p[0] <= 0, s: 1 },
  u: { axis: 1, test: p => p[1] >= 0, s: -1 },
  d: { axis: 1, test: p => p[1] <= 0, s: 1 },
  f: { axis: 2, test: p => p[2] >= 0, s: -1 },
  b: { axis: 2, test: p => p[2] <= 0, s: 1 },
  x: { axis: 0, test: all, s: -1 },
  y: { axis: 1, test: all, s: -1 },
  z: { axis: 2, test: all, s: -1 },
};

export function parseMove(tok: string): { m: string; turns: number } {
  const mt = /^([RLUDFBMESrludfbxyz])(2'?|')?$/.exec(tok);
  if (!mt) throw new Error(`Bad move: ${tok}`);
  const q = mt[2];
  return { m: mt[1], turns: q === "'" ? -1 : q ? 2 : 1 };
}

export function applyMove(st: State, tok: string): State {
  const { m, turns } = parseMove(tok);
  const d = DEFS[m];
  const quarter = (turns < 0 ? -d.s : d.s) as 1 | -1;
  const reps = Math.abs(turns);
  return st.map(s => {
    if (!d.test(s.p)) return s;
    let p = s.p, n = s.n;
    for (let i = 0; i < reps; i++) { p = rot(p, d.axis, quarter); n = rot(n, d.axis, quarter); }
    return { p, n, c: s.c };
  });
}

export interface TurnInfo { axis: 0 | 1 | 2; quarter: 1 | -1; turns: number; test: (p: V) => boolean }
/** what a move does, for animating it (same definition applyMove uses) */
export function turnInfo(tok: string): TurnInfo {
  const { m, turns } = parseMove(tok);
  const d = DEFS[m];
  return { axis: d.axis, quarter: (turns < 0 ? -d.s : d.s) as 1 | -1, turns, test: d.test };
}

export const tokens = (alg: string) => alg.trim().split(/\s+/).filter(Boolean);
export function applyAlg(st: State, alg: string): State {
  return tokens(alg).reduce(applyMove, st);
}

export const isSolved = (st: State) => st.every(s => FACE_OF_NORMAL(s.n) === s.c);

// Top-layer "last layer" view: 3x3 top stickers plus 12 side stickers of the top layer.
export interface LLView {
  top: number[][];   // [row][col], row 0 = back, col 0 = left
  back: number[];    // left to right
  front: number[];
  left: number[];    // back to front
  right: number[];
}
export function llView(st: State): LLView {
  const at = (p: V, n: V) => st.find(s => s.p[0] === p[0] && s.p[1] === p[1] && s.p[2] === p[2] && s.n[0] === n[0] && s.n[1] === n[1] && s.n[2] === n[2])!.c;
  const r = [-1, 0, 1];
  return {
    top: r.map(z => r.map(x => at([x, 1, z], [0, 1, 0]))),
    back: r.map(x => at([x, 1, -1], [0, 0, -1])),
    front: r.map(x => at([x, 1, 1], [0, 0, 1])),
    left: r.map(z => at([-1, 1, z], [-1, 0, 0])),
    right: r.map(z => at([1, 1, z], [1, 0, 0])),
  };
}
export const llFlat = (v: LLView) => [...v.top.flat(), ...v.back, ...v.front, ...v.left, ...v.right];

// F2L (everything below the top layer) is solved, allowing for the whole cube having been turned about y
export function f2lSolved(st: State): boolean {
  let cur = st;
  for (let k = 0; k < 4; k++) {
    if (cur.every(s => s.p[1] > 0 || FACE_OF_NORMAL(s.n) === s.c)) return true;
    cur = cur.map(s => ({ p: rot(s.p, 1, 1), n: rot(s.n, 1, 1), c: s.c }));
  }
  return false;
}
