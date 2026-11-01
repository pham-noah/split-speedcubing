import type { CaseDef } from './types';
import { ZBLL_U } from './zbl-u';
import { ZBLL_L } from './zbl-l';
import { ZBLL_T } from './zbl-t';
import { ZBLL_H } from './zbl-h';
import { ZBLL_PI } from './zbl-pi';
import { ZBLL_S } from './zbl-s';
import { ZBLL_AS } from './zbl-as';

// The 472 ZBLL cases in speedcubedb's seven subsets, U first. The 21 PLL cases are their own set, which is
// why this is 472 and not the 493 usually quoted for ZBLL as a whole.
export const ZBLL_GROUPS: string[] = ["U", "L", "T", "H", "Pi", "S", "AS"];
export const ZBLL: CaseDef[] = [...ZBLL_U, ...ZBLL_L, ...ZBLL_T, ...ZBLL_H, ...ZBLL_PI, ...ZBLL_S, ...ZBLL_AS];
