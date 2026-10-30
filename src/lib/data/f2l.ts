import type { CaseDef, Slot } from './types';
import { rotateAlg } from '../core/rotate';
import { F2L_FR } from './f2l-fr';
export { F2L_GROUPS } from './f2l-fr';

// The other three slots are the same 41 cases seen from another side: turn the whole cube about the vertical axis
// and relabel the moves (see core/rotate.ts, derived from the simulator and verified in the tests).
export const SLOTS: Slot[] = ['FR', 'FL', 'BL', 'BR'];
export const SLOT_NAMES: Record<Slot, string> = { FR: 'front-right', FL: 'front-left', BL: 'back-left', BR: 'back-right' };
const SLOT_ROTATION: Record<Slot, string> = { FR: '', BR: 'y', BL: 'y2', FL: "y'" };
export const F2L: CaseDef[] = SLOTS.flatMap(slot =>
  slot === 'FR' ? F2L_FR : F2L_FR.map(c => ({
    ...c,
    id: `${c.id}-${slot}`,
    name: `${c.name} · ${slot}`,
    alg: rotateAlg(c.alg, SLOT_ROTATION[slot]),
    alts: c.alts?.map(a => rotateAlg(a, SLOT_ROTATION[slot])),
    slot,
  }))
);

/** the same case as seen from another slot: 'F2L-1' <-> 'F2L-1-FL' (FR keeps the bare id) */
export function f2lSibling(id: string, slot: Slot): string {
  const base = id.replace(/-(FR|FL|BL|BR)$/, '');
  return slot === 'FR' ? base : `${base}-${slot}`;
}
