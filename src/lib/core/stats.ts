export type Penalty = '' | '+2' | 'DNF';
export interface Solve { id: string; ms: number; pen: Penalty; scramble: string; event: string; ts: number; session?: string }

// Effective time in ms: DNF is Infinity, +2 adds 2000.
export const effective = (s: Pick<Solve, 'ms' | 'pen'>) => (s.pen === 'DNF' ? Infinity : s.ms + (s.pen === '+2' ? 2000 : 0));

export function formatTime(ms: number | null | undefined): string {
  if (ms == null) return '–';
  if (ms === Infinity) return 'DNF';
  // a backup or a bad import can carry a NaN or a negative time; show a dash rather than "NaN"
  if (!Number.isFinite(ms) || ms < 0) return '–';
  const cs = Math.floor(ms / 10);
  const s = cs / 100;
  if (s >= 60) {
    const m = Math.floor(s / 60);
    return `${m}:${(s - m * 60).toFixed(2).padStart(5, '0')}`;
  }
  return s.toFixed(2);
}

export const best = (solves: Solve[]): number | null => {
  // a loop, not Math.min(...array): spreading 130 000 solves throws RangeError
  let b = Infinity;
  for (const s of solves) { const t = effective(s); if (t < b) b = t; }
  return solves.length ? b : null;
};

// WCA-style average of the last n solves: drop best and worst, mean of the rest. Two or more DNFs make the average a DNF.
export function averageOf(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  const v = solves.slice(-n).map(effective).sort((a, b) => a - b);
  const trimmed = v.slice(1, -1);
  const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  return Number.isFinite(avg) ? avg : Infinity;
}
// mean of 3: no trimming, any DNF makes it DNF
export function meanOf(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  const v = solves.slice(-n).map(effective);
  const m = v.reduce((a, b) => a + b, 0) / n;
  return Number.isFinite(m) ? m : Infinity;
}
/** Plain mean over times already resolved through `effective`/`attemptExec`: the one place a screen
 *  does arithmetic on a list, so a panel and a card beside it cannot disagree. */
export const mean = (times: number[]): number | null => (times.length ? times.reduce((a, b) => a + b, 0) / times.length : null);
// Best WCA average of n over every window: one pass, keeping the window sorted rather than re-sorting
// it each step, which is quadratic across a long history.
export function bestAverage(solves: Solve[], n: number): number | null {
  if (n < 3 || solves.length < n) return null;
  let bestSoFar: number | null = null;
  const win: number[] = [];
  for (let i = 0; i < solves.length; i++) {
    const v = effective(solves[i]);
    let lo = 0, hi = win.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (win[mid] < v) lo = mid + 1; else hi = mid; }
    win.splice(lo, 0, v);
    if (win.length > n) {
      const out = effective(solves[i - n]);
      win.splice(win.indexOf(out), 1);
    }
    if (win.length === n) {
      let sum = 0;
      for (let k = 1; k < n - 1; k++) sum += win[k];   // drop the best and the worst
      const avg = sum / (n - 2);
      const a = Number.isFinite(avg) ? avg : Infinity;
      if (bestSoFar === null || a < bestSoFar) bestSoFar = a;
    }
  }
  return bestSoFar;
}

/** What an attempt cost: execution time plus a +2, while a DNF has no usable time. */
export function attemptExec(a: { total: number; recog: number | null; pen?: '+2' | 'DNF' }): number {
  if (a.pen === 'DNF') return Infinity;
  return a.total - (a.recog ?? 0) + (a.pen === '+2' ? 2000 : 0);
}

/** Running WCA average of the last n at every index: null until there are n, Infinity when two DNFs
 *  sit inside the window. Exactly the rules of averageOf, so a deltas panel and an ao5 card on the
 *  same screen cannot disagree. */
export function runningAverage(times: number[], n: number): (number | null)[] {
  return times.map((_, i) => {
    if (i + 1 < n) return null;
    const w = times.slice(i + 1 - n, i + 1).sort((a, b) => a - b);
    const avg = w.slice(1, -1).reduce((a, b) => a + b, 0) / (n - 2);
    return Number.isFinite(avg) ? avg : Infinity;
  });
}
