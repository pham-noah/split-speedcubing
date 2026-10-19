import { invert, AUFS } from './alg';
import { EO_STEPS, OCLL_STEPS, CORNER_STEPS, EDGE_STEPS, type Step } from '../data/twolook';

export interface TwoLook {
  stage1: Step | null; stage2: Step | null;
  /** what the solver does: AUF, stage 1, AUF, stage 2, AUF */
  solution: string;
  scramble: string;
}
const pick = <T,>(a: T[], rnd: () => number) => a[Math.floor(rnd() * a.length)];

export function make2Look(kind: 'oll2' | 'pll2', rnd = Math.random): TwoLook {
  const A = kind === 'oll2' ? EO_STEPS : CORNER_STEPS;
  const B = kind === 'oll2' ? OCLL_STEPS : EDGE_STEPS;
  let stage1: Step | null, stage2: Step | null;
  do {
    stage1 = rnd() < 0.15 ? null : pick(A, rnd);
    stage2 = rnd() < 0.15 ? null : pick(B, rnd);
  } while (!stage1 && !stage2);
  const parts = [pick([...AUFS], rnd), stage1?.alg ?? '', pick([...AUFS], rnd), stage2?.alg ?? '', pick([...AUFS], rnd)];
  const solution = parts.filter(Boolean).join(' ');
  // the scramble is the exact inverse of the solution, so solving stage 1 then stage 2 always works
  return { stage1, stage2, solution, scramble: invert(solution) };
}
