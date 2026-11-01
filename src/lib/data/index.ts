import { PLL } from './pll';
import { OLL } from './oll';
import { F2L } from './f2l';
import { ZBLL, ZBLL_GROUPS } from './zbl';
import type { CaseDef, CaseSet, Slot } from './types';
export type { CaseDef, CaseSet, Slot };
export { SLOTS, SLOT_NAMES, F2L_GROUPS, f2lSibling } from './f2l';
export { ZBLL_GROUPS };
/** Bumped whenever the F2L case numbering changes shape: the store resets F2L progress once for it. */
export const F2L_DATA_REV = 2;
// ZBLL ships its 472 cases (the 21 PLL cases are their own set); the user's own algorithms ride on top.
export const SETS: Record<CaseSet, CaseDef[]> = { PLL, OLL, F2L, ZBLL };
export const SET_NAMES: CaseSet[] = ['PLL', 'OLL', 'F2L', 'ZBLL'];
export const BUILTIN_CASES: CaseDef[] = [...PLL, ...OLL, ...F2L, ...ZBLL];
