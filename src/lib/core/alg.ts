import { tokens, parseMove, applyAlg, solved, isSolved, f2lSolved, llView, FACE_OF_NORMAL } from './cube';

export function invert(alg: string): string {
  return tokens(alg).reverse().map(m => (m.endsWith('2') || m.endsWith("2'") ? m.replace("'", '') : m.endsWith("'") ? m.slice(0, -1) : m + "'")).join(' ');
}
export const AUFS = ['', 'U', "U'", 'U2'] as const;
export const randomAuf = (rnd = Math.random) => AUFS[Math.floor(rnd() * 4)];

// Scramble that produces the case solved by `alg`: invert the alg, optionally with an AUF in front.
export function caseScramble(alg: string, auf = '', after = false): string {
  // Last-layer cases: AUF in front (the cube is solved, so it just misaligns the top layer).
  // F2L cases: AUF at the end, so the pair sits in a different place relative to the slot.
  return (after ? `${invert(alg)} ${auf}` : `${auf} ${invert(alg)}`).trim();
}

/** Returns an error message, or null if every move parses. */
export function validateAlg(alg: string): string | null {
  const t = tokens(alg);
  if (!t.length) return 'Enter some moves.';
  try { t.forEach(parseMove); } catch (e) { return `Unknown move: ${(e as Error).message.replace('Bad move: ', '')}`; }
  return null;
}

/** Does `alg` solve the same case as `reference`? Allows a U turn at the end, or in front for F2L (`autoBefore`). */
export function solvesCase(reference: string, alg: string, autoBefore = false): boolean {
  const start = applyAlg(solved(), invert(reference));
  const turns = ['', 'U', "U'", 'U2'];
  const pre = autoBefore ? turns : [''];
  if (autoBefore) {
    // F2L: the case may sit in another AUF position, and only the front-right pair has to end up solved
    const pairOk = (st: ReturnType<typeof solved>) => st.every(s => s.p[1] > 0 || FACE_OF_NORMAL(s.n) === s.c);
    return pre.some(a => pairOk(applyAlg(start, `${a} ${alg}`)));
  }
  return turns.some(a => isSolved(applyAlg(start, `${alg} ${a}`)));
}
export const moveCount = (alg: string) => tokens(alg).filter(m => !/^[xyz]/.test(m)).length;

/** A ZBLL case: F2L solved and all last-layer edges oriented (corners may be twisted/permuted), not already solved. */
export function isZbllCase(alg: string): boolean {
  const st = applyAlg(solved(), invert(alg));
  const t = llView(st).top;
  return f2lSolved(st) && [t[0][1], t[1][0], t[1][2], t[2][1]].every(c => c === 0) && !isSolved(st);
}
