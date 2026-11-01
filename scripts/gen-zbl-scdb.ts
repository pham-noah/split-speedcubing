// Writes src/lib/data/zbl.ts from the speedcubedb ZBLL tables in scripts/data, with every algorithm
// re-checked by the simulator: F2L solved, last-layer edges oriented, the 472 cases distinct up to AUF.
// The site marks no standard algorithm for ZBLL, so the first line it lists is the default.
// Run: npx vite-node scripts/gen-zbl-scdb.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { applyAlg, solved, isSolved, llView, llFlat, f2lSolved, tokens } from '../src/lib/core/cube';
import { invert, solvesCase, moveCount } from '../src/lib/core/alg';

type Row = { key: string; subset: string; group: string; setup: string; algs: string[] };
const rows = (JSON.parse(readFileSync('scripts/data/zbl-speedcubedb.json', 'utf8')) as { cases: Row[] }).cases;
const SOL = solved();
const AUF = ['', 'U', "U'", 'U2'];

/** cancel a face turn straight after itself: R R' disappears, R R becomes R2, R2 R becomes R' */
function simplify(alg: string): string {
  const out: string[] = [];
  const face = (t: string) => t[0];
  const turn = (t: string) => (t.length === 1 ? 1 : t[1] === '2' ? 2 : 3);
  const render = (f: string, q: number) => (q === 1 ? f : q === 2 ? `${f}2` : `${f}'`);
  const stack: { f: string; q: number }[] = [];
  for (const t of tokens(alg)) {
    const f = face(t), q = turn(t);
    const top = stack.at(-1);
    if (top && top.f === f) {
      const sum = (top.q + q) % 4;
      stack.pop();
      if (sum) stack.push({ f, q: sum });
      continue;
    }
    stack.push({ f, q });
  }
  for (const { f, q } of stack) out.push(render(f, q));
  return out.join(' ');
}

/** the last layer as a colour string, canonically rotated so an AUF does not make a new case */
const pattern = (alg: string) => {
  let best = '';
  for (const a of AUF) for (const b of AUF) {
    const k = llFlat(llView(applyAlg(SOL, `${a} ${invert(alg)} ${b}`))).join('');
    if (!best || k < best) best = k;
  }
  return best;
};

const errors: string[] = [];
const notes: string[] = [];   // candidates the simulator rejected: not fatal, just not shipped
type Pick = { id: string; name: string; alg: string; alts: string[]; group: string };
const picks: Pick[] = [];
const keys = new Map<string, string>();

for (const row of rows) {
  const [subset, num] = [row.subset, row.key.slice(row.key.lastIndexOf(' ') + 1)];
  const id = `ZBLL-${subset}-${num}`;
  const valid = (a: string): string | null => {
    if (moveCount(a) > 24) return 'too long';
    const st = applyAlg(SOL, invert(a));
    if (!f2lSolved(st)) return 'disturbs F2L';
    if (![llView(st).top[0][1], llView(st).top[1][0], llView(st).top[1][2], llView(st).top[2][1]].every(c => c === 0)) return 'edges not oriented';
    if (isSolved(st)) return 'nothing to solve';
    if (!isSolved(applyAlg(st, a))) return 'does not solve the case';
    return null;
  };
  const uniq = [...new Set(row.algs.map(simplify))];
  const good: string[] = [];
  for (const a of uniq) {
    const bad = valid(a);
    if (bad) { notes.push(`${row.key}: "${a}" ${bad}`); continue; }
    good.push(a);
  }
  if (!good.length) { errors.push(`${row.key}: no usable algorithm`); continue; }
  const primary = good[0];
  const alts: string[] = [];
  for (const a of good.slice(1)) {
    if (alts.length === 3) break;
    if (!solvesCase(primary, a, false)) continue;
    alts.push(a);
  }
  const k = pattern(primary);
  const twin = keys.get(k);
  if (twin) errors.push(`${row.key}: same case as ${twin}`);
  keys.set(k, row.key);
  picks.push({ id, name: row.key, alg: primary, alts, group: subset });
}

if (rows.length !== 472) errors.push(`expected 472 ZBLL cases, got ${rows.length}`);
if (picks.length !== 472) errors.push(`expected 472 picks, got ${picks.length}`);
if (keys.size !== 472) errors.push(`${keys.size} distinct patterns, expected 472`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const q = (s: string) => JSON.stringify(s);
const line = (p: Pick) =>
  `  { id: ${q(p.id)}, set: 'ZBLL', name: ${q(p.name)}, alg: ${q(p.alg)}, group: ${q(p.group)}${p.alts.length ? `, alts: [${p.alts.map(q).join(', ')}]` : ''} },`;

const bySubset = new Map<string, Pick[]>();
for (const p of picks) bySubset.set(p.group, [...(bySubset.get(p.group) ?? []), p]);

const files: string[] = [];
for (const [subset, list] of bySubset) {
  const file = `zbl-${subset.toLowerCase()}.ts`;
  files.push(file);
  writeFileSync(`src/lib/data/${file}`, `import type { CaseDef } from './types';

// ZBLL ${subset}: ${list.length} cases from speedcubedb.com/a/3x3/ZBLL${subset}, every line re-checked by the
// simulator. The first algorithm the site lists is the default. Regenerate with scripts/gen-zbl-scdb.ts.
export const ZBLL_${subset.toUpperCase()}: CaseDef[] = [
${list.map(line).join('\n')}
];
`);
}

writeFileSync('src/lib/data/zbl.ts', `import type { CaseDef } from './types';
${[...bySubset.keys()].map(s => `import { ZBLL_${s.toUpperCase()} } from './zbl-${s.toLowerCase()}';`).join('\n')}

// The 472 ZBLL cases in speedcubedb's seven subsets, U first. The 21 PLL cases are their own set, which is
// why this is 472 and not the 493 usually quoted for ZBLL as a whole.
export const ZBLL_GROUPS: string[] = [${[...bySubset.keys()].map(q).join(', ')}];
export const ZBLL: CaseDef[] = [${[...bySubset.keys()].map(s => `...ZBLL_${s.toUpperCase()}`).join(', ')}];
`);

const alts = picks.reduce((n, p) => n + p.alts.length, 0);
console.log(`wrote ${picks.length} ZBLL cases in ${bySubset.size} files, ${alts} alternatives`);
const noAlt = picks.filter(p => !p.alts.length).length;
console.log(`cases with no bundled alternative: ${noAlt}`);
console.log(`${notes.length} candidate algorithms rejected by the simulator`);
