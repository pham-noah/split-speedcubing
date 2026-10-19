import { applyAlg, applyMove, solved, tokens, type State } from './cube';

// Relabel an algorithm as if the whole cube had been turned about the vertical axis.
// The mapping is not hand-written: it is derived by conjugating each move with the rotation in the simulator.
const BASES = ['R', 'L', 'U', 'D', 'F', 'B', 'M', 'E', 'S', 'r', 'l', 'u', 'd', 'f', 'b', 'x', 'y', 'z'];
const sig = (st: State) => st.map(s => `${s.p}|${s.n}|${s.c}`).join(';');
const invRot = (rot: string) => (rot.endsWith("'") ? rot.slice(0, -1) : rot.endsWith('2') ? rot : rot + "'");

const cache = new Map<string, Record<string, string>>();
function mapping(rot: string): Record<string, string> {
  const hit = cache.get(rot);
  if (hit) return hit;
  const table = new Map(BASES.flatMap(b => [[sig(applyMove(solved(), b)), b], [sig(applyMove(solved(), b + "'")), b + "'"]]));
  const out: Record<string, string> = {};
  for (const b of BASES) {
    const conj = applyAlg(solved(), `${rot} ${b} ${invRot(rot)}`);
    const m = table.get(sig(conj));
    if (!m) throw new Error(`no mapping for ${b} under ${rot}`);
    out[b] = m;
  }
  cache.set(rot, out);
  return out;
}

/** `rot` is a whole-cube rotation such as "y", "y2" or "y'". */
export function rotateAlg(alg: string, rot: string): string {
  if (!rot) return alg;
  const map = mapping(rot);
  return tokens(alg).map(t => {
    const base = t[0], suffix = t.slice(1);
    const m = map[base];
    const primed = m.endsWith("'");
    const letter = m[0];
    if (suffix === '2') return letter + '2';
    const wantPrime = suffix === "'" ? !primed : primed;
    return letter + (wantPrime ? "'" : '');
  }).join(' ');
}
