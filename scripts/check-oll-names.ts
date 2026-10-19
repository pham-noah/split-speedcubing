// One-off: check the app's OLL numbering against a named reference list before borrowing its names.
// Matches are decided by the cube itself: the pattern of oriented last-layer pieces, up to a U rotation.
import { solved, applyAlg } from '../src/lib/core/cube';
import { invert } from '../src/lib/core/alg';
import { OLL } from '../src/lib/data/oll';

const REF: [number, string, string][] = [
  [1, 'Runway', "R U2 R' R' F R F' U2 R' F R F'"],
  [2, 'Zamboni', "F R U R' U' F' f R U R' U' f'"],
  [3, 'Anti Nazi', "f R U R' U' f' U' F R U R' U' F'"],
  [4, 'Nazi', "f R U R' U' f' U F R U R' U' F'"],
  [5, 'Lefty Square', "r' U2 R U R' U r"],
  [6, 'Righty Square', "r U2 R' U' R U' r'"],
  [7, 'Lightning', "r U R' U R U2 r'"],
  [8, 'Reverse Lightning', "r' U' R U' R' U2 r"],
  [9, 'Kite', "R U R' U' R' F R2 U R' U' F'"],
  [10, 'Anti Kite', "R U R' U R' F R F' R U2 R'"],
  [11, 'Downstairs', "r' R2 U R' U R U2 R' U M'"],
  [12, 'Upstairs', "M' R' U' R U' R' U2 R U' M"],
  [13, 'Gun', "F U R U' R2 F' R U R U' R'"],
  [14, 'Anti Gun', "R' F R U R' F' R y' R U' R'"],
  [15, 'Squeegee', "r' U' r R' U' R U r' U r"],
  [16, 'Anti Squeegee', "r U r' R U R' U' r U' r'"],
  [17, 'Slash', "R U R' U R' F R F' U2 R' F R F'"],
  [18, 'Crown', "r U R' U R U2 r' r' U' R U' R' U2 r"],
  [19, 'Bunny', "M U R U R' U' M' R' F R F'"],
  [20, 'X', "M U R U R' U' M2 U R U' r'"],
  [21, 'H', "F R U R' U' R U R' U' R U R' U' F'"],
  [22, 'Pi', "R U2 R2' U' R2 U' R2' U2 R"],
  [23, 'Headlights', "R2 D R' U2 R D' R' U2 R'"],
  [24, 'T', "r U R' U' r' F R F'"],
  [25, 'Bowtie', "F' r U R' U' r' F R"],
  [26, 'Anti Sune', "L' U' L U' L' U2 L"],
  [27, 'Sune', "R U R' U R U2 R'"],
  [28, 'Stealth', "r U R' U' M U R U' R'"],
  [29, 'Spotted Chameleon', "y R U R' U' R U' R' F' U' F R U R'"],
  [30, 'Anti Spotted Chameleon', "y' F U R U2 R' U' R U2 R' U' F'"],
  [31, 'Couch', "R' U' F U R U' R' F' R"],
  [32, 'Anti Couch', "S R U R' U' R' F R f'"],
  [33, 'Shoelaces', "R U R' U' R' F R F'"],
  [34, 'City', "R U R2' U' R' F R U R U' F'"],
  [35, 'Fish Salad', "R U2 R' R' F R F' R U2 R'"],
  [36, 'Wario', "R' U' R U' R' U R U l U' R' U x"],
  [37, 'Mounted Fish', "F R U' R' U' R U R' F'"],
  [38, 'Mario', "R U R' U R U' R' U' R' F R F'"],
  [39, 'Fung', "L F' L' U' L U F U' L'"],
  [40, 'Anti Fung', "R' F R U R' U' F' U R"],
  [41, 'Awkward Fish', "R U R' U R U2' R' F R U R' U' F'"],
  [42, 'Lefty Awkward Fish', "R' U' R U' R' U2 R F R U R' U' F'"],
  [43, 'Anti P', "f' L' U' L U f"],
  [44, 'P', "f R U R' U' f'"],
  [45, 'Suit Up', "F R U R' U' F'"],
  [46, "Seein' Headlights", "R' U' R' F R F' U R"],
  [47, 'Anti Breakneck', "F' L' U' L U L' U' L U F"],
  [48, 'Breakneck', "F R U R' U' R U R' U' F'"],
  [49, 'Right Back Squeezy', "r U' r2' U r2 U r2' U' r"],
  [50, 'Right Front Squeezy', "r' U r2 U' r2' U' r2 U r'"],
  [51, 'Bottlecap', "f R U R' U' R U R' U' f'"],
  [52, 'Rice Cooker', "R U R' U R d' R U' R' F'"],
  [53, 'Frying Pan', "r' U' R U' R' U R U' R' U2 r"],
  [54, 'Anti Frying Pan', "r U R' U R U' R' U R U2' r'"],
  [55, 'Highway', "y R' F R U R U' R2' F' R2 U' R' U R U R'"],
  [56, 'Streetlights', "F R U R' U' R F' r U R' U' r'"],
  [57, 'Mummy', "R U R' U' M' U R U' r'"],
];

/** which of the 8 last-layer pieces have their U sticker facing up, as "x,z" keys */
function pattern(alg: string): string {
  const st = applyAlg(solved(), invert(alg));
  const cells: string[] = [];
  for (const s of st) {
    if (s.n[1] !== 1) continue;
    if (s.p[0] === 0 && s.p[2] === 0) continue;
    cells.push(`${s.p[0]},${s.p[2]}`);
  }
  return cells.sort().join(' ');
}
/** the same pattern turned by k quarter turns about U, so an AUF difference still matches */
function rotate(p: string, k: number): string {
  let cells = p.split(' ').map(c => c.split(',').map(Number) as [number, number]);
  for (let i = 0; i < k; i++) cells = cells.map(([x, z]) => [-z, x]);
  return cells.map(([x, z]) => `${x},${z}`).sort().join(' ');
}
const same = (a: string, b: string) => [0, 1, 2, 3].some(k => rotate(a, k) === rotate(b, k));

const byId = new Map(OLL.map(c => [Number(c.id.split('-')[1]), c]));
const bad: string[] = [];
for (const [n, name, alg] of REF) {
  const mine = byId.get(n);
  if (!mine) { bad.push(`OLL ${n} missing in the app`); continue; }
  if (!same(pattern(mine.alg), pattern(alg))) bad.push(`OLL ${n} (${name}): app alg is a different case`);
}
console.log(`checked ${REF.length} references, ${bad.length} mismatches`);
bad.forEach(b => console.log('  ' + b));
if (!bad.length) console.log('numbering agrees: the reference names can be used as-is');
