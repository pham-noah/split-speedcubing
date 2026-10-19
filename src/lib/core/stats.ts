export type Penalty = '' | '+2' | 'DNF';
export interface Solve { id: string; ms: number; pen: Penalty; scramble: string; event: string; ts: number; session?: string }

// Effective time in ms: DNF is Infinity, +2 adds 2000.
export const effective = (s: Pick<Solve, 'ms' | 'pen'>) => (s.pen === 'DNF' ? Infinity : s.ms + (s.pen === '+2' ? 2000 : 0));

export function formatTime(ms: number | null | undefined): string {
  if (ms == null) return '–';
  if (ms === Infinity) return 'DNF';
  const cs = Math.floor(ms / 10);
  const s = cs / 100;
  if (s >= 60) {
    const m = Math.floor(s / 60);
    return `${m}:${(s - m * 60).toFixed(2).padStart(5, '0')}`;
  }
  return s.toFixed(2);
}

export const best = (solves: Solve[]): number | null => (solves.length ? Math.min(...solves.map(effective)) : null);

// WCA-style average of the last n solves: drop best and worst, mean of the rest. Two or more DNFs make the average a DNF.
export function averageOf(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  const v = solves.slice(-n).map(effective).sort((a, b) => a - b);
  const trimmed = v.slice(1, -1);
  const mean = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  return Number.isFinite(mean) ? mean : Infinity;
}
// mean of 3: no trimming, any DNF makes it DNF
export function meanOf(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  const v = solves.slice(-n).map(effective);
  const m = v.reduce((a, b) => a + b, 0) / n;
  return Number.isFinite(m) ? m : Infinity;
}
export function bestAverage(solves: Solve[], n: number): number | null {
  let b: number | null = null;
  for (let i = n; i <= solves.length; i++) {
    const a = averageOf(solves.slice(0, i), n);
    if (a !== null && (b === null || a < b)) b = a;
  }
  return b;
}
