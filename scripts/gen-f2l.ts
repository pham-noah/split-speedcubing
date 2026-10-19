// Finds a short algorithm for every F2L case (cross + 3 slots solved, one pair unsolved) by exhaustive search.
// Run: npx vite-node scripts/gen-f2l.ts [maxDepth]   -> prints src/lib/data/f2l.ts
import { solved, applyMove, FACE_OF_NORMAL, type State } from '../src/lib/core/cube';
import { invert } from '../src/lib/core/alg';

const MAX = Number(process.argv[2] ?? 8);
const base = solved();
const idx = new Map<string, number>();
base.forEach((s, i) => idx.set(`${s.p}|${s.n}`, i));
const MOVES = ['R', "R'", 'R2', 'U', "U'", 'U2', 'F', "F'", 'F2'];
// permutation per move: where does sticker i go
const perm: Record<string, Uint8Array> = {};
for (const m of MOVES) {
  const moved = applyMove(base, m);
  const pr = new Uint8Array(54);
  moved.forEach((s, i) => { pr[i] = idx.get(`${s.p}|${s.n}`)!; });
  perm[m] = pr;
}
// pieces: group stickers sharing a position. Pair = corner (1,-1,1) [DFR] and edge (1,0,1) [FR]. LL = y==1 pieces.
const pieceOf = base.map(s => s.p.join(','));
const isPairPiece = (p: string) => p === '1,-1,1' || p === '1,0,1';
const isLL = (p: string) => p.split(',')[1] === '1';
const cls = (i: number) => (base[i].p.every(v => v === 0) || (base[i].p.filter(v => v !== 0).length === 1) ? 254 : 0); // centers
// "home" list: stickers whose slot must hold their own id at the end (cross + three other slots)
const must: number[] = [];
const pairSlots: number[] = [];
base.forEach((s, i) => {
  const p = pieceOf[i];
  if (s.p.filter(v => v !== 0).length === 1) return; // centers
  if (isLL(p)) return;
  if (isPairPiece(p)) pairSlots.push(i); else must.push(i);
});
// ids of pair stickers (their identity matters wherever they are)
const pairIds = new Set(pairSlots);
const key = (st: Uint8Array) => {
  // identity of the pair stickers by slot; other slots collapse to 0
  let k = '';
  for (let i = 0; i < 54; i++) k += pairIds.has(st[i]) ? String.fromCharCode(65 + st[i] % 60) + i + ',' : '';
  return k;
};
const U = perm['U'], U3 = perm["U'"];
function canon(st: Uint8Array) {
  let best = '';
  let cur = st;
  for (let k = 0; k < 4; k++) {
    const kk = key(cur);
    if (!best || kk < best) best = kk;
    const nx = new Uint8Array(54);
    for (let i = 0; i < 54; i++) nx[U[i]] = cur[i];
    cur = nx;
  }
  return best;
}
const faceOf = (m: string) => m[0];
const found = new Map<string, string[]>();
const stack: Uint8Array[] = Array.from({ length: MAX + 1 }, () => new Uint8Array(54));
for (let i = 0; i < 54; i++) stack[0][i] = i;
const path: string[] = [];
function rec(d: number) {
  if (d > 0) {
    const st = stack[d];
    let ok = true;
    for (const i of must) if (st[i] !== i) { ok = false; break; }
    if (ok) {
      let pairHome = true;
      for (const i of pairSlots) if (st[i] !== i) { pairHome = false; break; }
      if (!pairHome) {
        const k = canon(st);
        const prev = found.get(k);
        if (!prev || prev.length > path.length) found.set(k, [...path]);
      }
    }
  }
  if (d === MAX) return;
  for (const m of MOVES) {
    if (d > 0 && faceOf(m) === faceOf(path[d - 1])) continue;
    const pr = perm[m], src = stack[d], dst = stack[d + 1];
    for (let i = 0; i < 54; i++) dst[pr[i]] = src[i];
    path.push(m);
    rec(d + 1);
    path.pop();
  }
}
rec(0);
const cases = [...found.values()].map(seq => invert(seq.join(' ')));
// order: shorter first, then alphabetical so output is stable
cases.sort((a, b) => a.split(' ').length - b.split(' ').length || a.localeCompare(b));
console.error(`depth ${MAX}: ${cases.length} distinct cases`);
console.log(JSON.stringify(cases));
