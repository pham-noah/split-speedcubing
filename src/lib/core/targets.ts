import type { CaseSet } from '../data';

// A sensible time for one case, used to grade an attempt without asking the user to rate themselves.
// Single source: the trainer, the library and the drills all grade against this.
export const CASE_TARGET_MS: Record<CaseSet, number> = { PLL: 3000, OLL: 3500, F2L: 3500, ZBLL: 5000 };
