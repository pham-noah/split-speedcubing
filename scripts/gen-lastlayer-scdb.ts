// Writes src/lib/data/pll.ts and src/lib/data/oll.ts from the speedcubedb tables in scripts/data, with
// every algorithm re-checked by the simulator: PLL keeps F2L solved, leaves the last layer oriented and
// differs across all 21; OLL keeps F2L solved across 57 distinct orientation patterns.
// Run: npx vite-node scripts/gen-lastlayer-scdb.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { applyAlg, solved, isSolved, llView, llFlat, f2lSolved, tokens } from '../src/lib/core/cube';
import { invert, solvesCase } from '../src/lib/core/alg';
import { OLL_NICK } from '../src/lib/data/oll-names';

type Row = { key: string; group: string | null; setup: string; standard: string | null; algs: string[] };
const read = (f: string) => (JSON.parse(readFileSync(`scripts/data/${f}`, 'utf8')) as { cases: Row[] }).cases;
const pll = read('pll-speedubedb.json'.replace('speedubedb', 'speedcubedb'));
const oll = read('oll-speedcubedb.json');
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

const pattern = (alg: string, orientationOnly: boolean) => {
  let best = '';
  for (const a of AUF) for (const b of AUF) {
    const st = applyAlg(SOL, `${a} ${invert(alg)} ${b}`);
    const flat = llFlat(llView(st));
    const k = (orientationOnly ? flat.map(c => (c === 0 ? 1 : 0)) : flat).join('');
    if (!best || k < best) best = k;
  }
  return best;
};

const errors: string[] = [];
const notes: string[] = [];   // candidates the simulator rejected: not fatal, just not shipped
type Pick = { id: string; name: string; alg: string; alts: string[]; group?: string; nick?: string };
const picks: Pick[] = [];
const keys = new Set<string>();
const seenAlg = new Set<string>();

function choose(label: string, row: Row, id: string, name: string, requireOriented: boolean, orientationOnlyKey: boolean, group?: string, nick?: string) {
  const state = (a: string) => applyAlg(SOL, invert(a));
  const valid = (a: string): string | null => {
    if (tokens(a).length > 24) return "too long";
    const st = state(a);
    if (!f2lSolved(st)) return 'disturbs F2L';
    if (requireOriented && !llView(st).top.flat().every(c => c === 0)) return 'last layer not oriented';
    if (!isSolved(applyAlg(st, a))) return 'does not solve the case';
    return null;
  };
  const ordered = [row.standard, ...row.algs].filter((a): a is string => !!a).map(simplify);
  const uniq = [...new Set(ordered)];
  const good: string[] = [];
  for (const a of uniq) {
    const bad = valid(a);
    if (bad) { notes.push(`${label}: "${a}" ${bad}`); continue; }
    if (!good.includes(a)) good.push(a);
  }
  // the site's own standard alg is the default; otherwise the first one that validates
  const primary = row.standard ? simplify(row.standard) : good[0];
  if (!good.includes(primary)) { errors.push(`${label}: no usable algorithm`); return; }
  const rest = good.filter(a => a !== primary);
  const alts: string[] = [];
  for (const a of rest) {
    if (!solvesCase(primary, a, false)) continue;
    if (alts.includes(a) || seenAlg.has(`${id} ${a}`)) continue;
    alts.push(a);
    if (alts.length === 3) break;
  }
  // PLL is identified by the permutation (colours), OLL by which stickers are oriented
  const k = pattern(primary, orientationOnlyKey);
  if (keys.has(k)) errors.push(`${label}: same case as another one`);
  keys.add(k);
  picks.push({ id, name, alg: primary, alts, group: group ?? undefined, nick });
}

for (const row of pll) choose(`PLL ${row.key}`, row, `PLL-${row.key}`, `${row.key}-perm`, true, false);   // oriented LL, keyed by permutation
for (const row of oll) {
  const n = Number(row.key);
  choose(`OLL ${n}`, row, `OLL-${n}`, `OLL ${n}`, false, true, row.group ?? undefined, OLL_NICK[String(n)]);
}

if (pll.length !== 21) errors.push(`expected 21 PLL cases, got ${pll.length}`);
if (oll.length !== 57) errors.push(`expected 57 OLL cases, got ${oll.length}`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const q = (s: string) => JSON.stringify(s);
const line = (p: Pick, extra: string) =>
  `  { id: ${q(p.id)}, set: ${p.id.startsWith('PLL') ? "'PLL'" : "'OLL'"}, name: ${q(p.name)}, alg: ${q(p.alg)}${extra}${p.alts.length ? `, alts: [${p.alts.map(q).join(', ')}]` : ''} },`;

writeFileSync('src/lib/data/pll.ts', `import type { CaseDef } from './types';

// The 21 PLL cases in the standard letter naming, from speedcubedb.com/a/3x3/PLL (fetched 2026-10-30): the
// algorithm that page marks standard plus up to three more that solve it. Regenerate with
// scripts/gen-lastlayer-scdb.ts.
export const PLL: CaseDef[] = [
${picks.filter(p => p.id.startsWith('PLL')).map(p => line(p, '')).join('\n')}
];
`);

writeFileSync('src/lib/data/oll.ts', `import type { CaseDef } from './types';
import { OLL_NICK } from './oll-names';

// The 57 OLL cases in the standard numbering, from speedcubedb.com/a/3x3/OLL (fetched 2026-10-30): the
// algorithm that page marks standard plus up to three more that solve it. Nicknames in ./oll-names.ts.
// Regenerate with scripts/gen-lastlayer-scdb.ts.
export const OLL: CaseDef[] = [
${picks.filter(p => p.id.startsWith('OLL')).map(p => line(p, `, nick: OLL_NICK['${p.id.slice(4)}']`)).join('\n')}
];
`);

const count = picks.reduce((n, p) => n + p.alts.length, 0);
console.log(`wrote ${picks.filter(p => p.id.startsWith('PLL')).length} PLL and ${picks.filter(p => p.id.startsWith('OLL')).length} OLL, ${count} alternatives`);
const noAlt = picks.filter(p => !p.alts.length).map(p => p.id);
if (noAlt.length) console.log(`cases with no bundled alternative: ${noAlt.join(', ')}`);
if (notes.length) console.log(`${notes.length} candidate algorithms rejected by the simulator:`);
if (notes.length) console.log(notes.join('\n'));
