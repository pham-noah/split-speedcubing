// Writes src/lib/data/f2l-fr.ts from the speedcubedb F2L table (scripts/data/f2l-speedcubedb.json).
// Every line is re-checked with the cube simulator before it is written: the case must disturb the
// front-right slot's pair and nothing else, and the alg must be 12 moves or fewer.
// Run: npx vite-node scripts/gen-f2l-scdb.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { applyAlg, solved, tokens, FACE_OF_NORMAL } from '../src/lib/core/cube';
import { invert } from '../src/lib/core/alg';

type Row = { n: number; group: string; setup: string; alg: string; rank: number };
const src = JSON.parse(readFileSync('scripts/data/f2l-speedcubedb.json', 'utf8')) as { cases: Row[] };
const rows = [...src.cases].sort((a, b) => a.n - b.n);

const SOL = solved();
const sig = (st: ReturnType<typeof solved>) => st.map(s => `${s.p}|${s.n}|${s.c}`).join(';');
const CORNER: [number, number] = [1, 1];   // front-right slot
const outsideFR = (st: ReturnType<typeof solved>) =>
  st.filter(s => s.p[1] <= 0 && !(s.p[0] === CORNER[0] && s.p[2] === CORNER[1]) && FACE_OF_NORMAL(s.n) !== s.c).length;
const orbit = (st: ReturnType<typeof solved>) => ['', 'U', 'U2', "U'"].map(u => sig(u ? applyAlg(st, u) : st)).sort()[0];

const errors: string[] = [];
const seen = new Map<string, number>();
const groups = [...new Set(rows.map(r => r.group))];
for (const r of rows) {
  if (tokens(r.alg).length > 12) errors.push(`F2L ${r.n}: ${r.alg} is longer than 12 moves`);
  const st = applyAlg(SOL, invert(r.alg));
  const bad = outsideFR(st);
  if (bad) errors.push(`F2L ${r.n}: ${r.alg} disturbs ${bad} stickers outside the front-right slot`);
  const o = orbit(st);
  if (seen.has(o)) errors.push(`F2L ${r.n}: same case as F2L ${seen.get(o)}`);
  seen.set(o, r.n);
}
if (rows.length !== 41) errors.push(`expected 41 cases, got ${rows.length}`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const q = (s: string) => JSON.stringify(s);
const body = rows
  .map(r => `  { id: 'F2L-${r.n}', set: 'F2L', name: 'F2L ${r.n}', alg: ${q(r.alg)}, group: ${q(r.group)}, slot: 'FR' },`)
  .join('\n');
const file = `import type { CaseDef } from './types';

// The 41 standard first-two-layers cases, in the community's numbering, taken from SpeedCubeDB
// (https://speedcubedb.com/a/3x3/F2L, front-right slot, fetched 2026-10-30). Each case ships the
// highest-voted algorithm that the simulator accepts for this slot. Regenerate with
// scripts/gen-f2l-scdb.ts, which re-checks every line before writing this file.
export const F2L_GROUPS = ${JSON.stringify(groups)};

export const F2L_FR: CaseDef[] = [
${body}
];
`;
writeFileSync('src/lib/data/f2l-fr.ts', file);
console.log(`wrote 41 cases in ${groups.length} groups: ${groups.join(' / ')}`);
