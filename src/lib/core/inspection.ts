import type { Penalty } from './stats';
export const INSPECTION_MS = 15_000;
// WCA: starting after 15 s costs +2, after 17 s the solve is a DNF.
export function inspectionPenalty(elapsedMs: number): Penalty {
  return elapsedMs > 17_000 ? 'DNF' : elapsedMs > INSPECTION_MS ? '+2' : '';
}
/** Text for the countdown: 15, 14 ... 1, then +2 once over time. */
export function inspectionText(elapsedMs: number): string {
  if (elapsedMs > 17_000) return 'DNF';
  if (elapsedMs > INSPECTION_MS) return '+2';
  return String(Math.max(1, Math.ceil((INSPECTION_MS - elapsedMs) / 1000)));
}
