// Writes src/lib/data/f2l-fr.ts from scripts/data/f2l-speedcubedb.json, re-checking every line with the
// simulator: the case must disturb the front-right slot's pair and nothing else, the alg 12 moves or fewer.
// Run: npx vite-node scripts/gen-f2l-scdb.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { applyAlg, solved, tokens, FACE_OF_NORMAL } from '../src/lib/core/cube';
import { invert, solvesCase } from '../src/lib/core/alg';

type Row = { n: number; group: string; setup: string; alg: string; rank: number; candidates: string[] };
const src = JSON.parse(readFileSync('scripts/data/f2l-speedcubedb.json', 'utf8')) as { cases: Row[] };
const rows = [...src.cases].sort((a, b) => a.n - b.n);

const SOL = solved();
const sig = (st: ReturnType<typeof solved>) => st.map(s => `${s.p}|${s.n}|${s.c}`).join(';');
const CORNER: [number, number] = [1, 1];   // front-right slot
const outsideFR = (st: ReturnType<typeof solved>) =>
  st.filter(s => s.p[1] <= 0 && !(s.p[0] === CORNER[0] && s.p[2] === CORNER[1]) && FACE_OF_NORMAL(s.n) !== s.c).length;
const orbit = (st: ReturnType<typeof solved>) => ['', 'U', 'U2', "U'"].map(u => sig(u ? applyAlg(st, u) : st)).sort()[0];
const fits = (alg: string) => tokens(alg).length <= 12 && outsideFR(applyAlg(SOL, invert(alg))) === 0;

const errors: string[] = [];
const seen = new Map<string, number>();
const groups = [...new Set(rows.map(r => r.group))];
const picked = new Map<number, string[]>();
for (const r of rows) {
  if (!fits(r.alg)) errors.push(`F2L ${r.n}: ${r.alg} is not a valid case alg`);
  const o = orbit(applyAlg(SOL, invert(r.alg)));
  if (seen.has(o)) errors.push(`F2L ${r.n}: same case as F2L ${seen.get(o)}`);
  seen.set(o, r.n);
  // the bundled alternatives: the other algorithms from the same page that solve the same case here
  const alts: string[] = [];
  for (const a of r.candidates ?? []) {
    if (a === r.alg || alts.includes(a) || !fits(a)) continue;
    if (!solvesCase(r.alg, a, true)) continue;
    alts.push(a);
    if (alts.length === 3) break;
  }
  picked.set(r.n, alts);
}
if (rows.length !== 41) errors.push(`expected 41 cases, got ${rows.length}`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const q = (s: string) => JSON.stringify(s);
const body = rows
  .map(r => {
    const alts = picked.get(r.n) ?? [];
    const altText = alts.length ? `, alts: [${alts.map(q).join(', ')}]` : '';
    return `  { id: 'F2L-${r.n}', set: 'F2L', name: 'F2L ${r.n}', alg: ${q(r.alg)}, group: ${q(r.group)}, slot: 'FR'${altText} },`;
  })
  .join('\n');
const file = `import type { CaseDef } from './types';

// The 41 standard F2L cases in the community numbering, from speedcubedb.com/a/3x3/F2L (front-right
// slot, fetched 2026-10-30): the highest-voted algorithm the simulator accepts for the slot plus up to
// three more that solve it. Regenerate with scripts/gen-f2l-scdb.ts.
export const F2L_GROUPS = ${JSON.stringify(groups)};

export const F2L_FR: CaseDef[] = [
${body}
];
`;
writeFileSync('src/lib/data/f2l-fr.ts', file);
const total = rows.reduce((n, r) => n + (picked.get(r.n)?.length ?? 0), 0);
console.log(`wrote 41 cases in ${groups.length} groups, ${total} bundled alternatives: ${groups.join(' / ')}`);
