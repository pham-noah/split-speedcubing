import { PLL } from './pll';
import { OLL } from './oll';
import { F2L } from './f2l';
import type { CaseDef, CaseSet, Slot } from './types';
export type { CaseDef, CaseSet, Slot };
export { SLOTS, SLOT_NAMES } from './f2l';
/** Bumped whenever the F2L case numbering changes shape: the store resets F2L progress once for it. */
export const F2L_DATA_REV = 2;
// ZBLL has no bundled algorithms (493 cases): the user imports their own list, kept in the app data.
export const SETS: Record<CaseSet, CaseDef[]> = { PLL, OLL, F2L, ZBLL: [] };
export const SET_NAMES: CaseSet[] = ['PLL', 'OLL', 'F2L', 'ZBLL'];
export const BUILTIN_CASES: CaseDef[] = [...PLL, ...OLL, ...F2L];
