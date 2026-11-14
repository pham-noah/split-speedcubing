export type Penalty = '' | '+2' | 'DNF';
// `splits` is opt-in (Settings → Split timing): the length of each segment of the solve in ms, in the
// order the marks were made, with the last one running to the stop. Absent on every solve timed without it.
export interface Solve { id: string; ms: number; pen: Penalty; scramble: string; event: string; ts: number; session?: string; splits?: number[] }

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

/** Sample standard deviation of the finished times: the "how consistent am I" number next to the mean.
 *  A DNF has no number to include, so it is skipped rather than counted as the mean. */
export function stdDev(times: number[]): number | null {
  const v = times.filter(Number.isFinite);
  if (v.length < 2) return null;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  const variance = v.reduce((a, t) => a + (t - m) ** 2, 0) / (v.length - 1);
  return Math.sqrt(variance);
}

// --- phase splits -------------------------------------------------------------------------------
// The four phases a solve is split into, in the order a mark ends each one. A mark is the elapsed time
// at the tap; the last segment always runs to the stop, so three marks give all four phases.
export const PHASES = ['Cross', 'F2L', 'OLL', 'PLL'] as const;
export type Phase = (typeof PHASES)[number];

/** Elapsed marks to segment lengths. A mark outside (previous, total) is dropped: a stray double tap
 *  must not produce a zero-length phase or a negative one. */
export function splitSegments(marks: number[], total: number): number[] {
  if (!Number.isFinite(total) || total <= 0) return [];
  const out: number[] = [];
  let prev = 0;
  for (const m of marks) {
    if (!Number.isFinite(m) || m <= prev || m >= total) continue;
    out.push(m - prev);
    prev = m;
  }
  if (prev > 0) out.push(total - prev);
  return out;
}

/** Names line up with the segment count. Fewer than four segments means the tail was never marked, so
 *  it is called what it is ("Rest") rather than borrowing the name of a phase it also contains. */
export function phaseLabels(n: number): string[] {
  if (n <= 0) return [];
  const whole = n === PHASES.length;
  return Array.from({ length: n }, (_, i) =>
    whole ? PHASES[i] : i === n - 1 ? 'Rest' : (PHASES[i] ?? `Phase ${i + 1}`),
  );
}

/** Mean length of each phase over the last `n` solves split into exactly `count` segments. Only solves
 *  split the same way are mixed: with two marks the third segment is "Rest", and averaging that into OLL
 *  would quietly compare a phase with a phase plus everything after it. A DNF keeps its split in the
 *  record but is left out of the average: its segments are real, its time is not. */
export function phaseMeans(solves: Solve[], n = 12, count: number = PHASES.length): (number | null)[] {
  const use = solves.filter((s) => s.pen !== 'DNF' && s.splits?.length === count).slice(-n);
  return Array.from({ length: count }, (_, i) => {
    const v = use.map((s) => s.splits![i]).filter((x): x is number => Number.isFinite(x));
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  });
}

/** The phase that took the largest share of a solve, and the one a trainer can be offered for. Only a
 *  phase that was actually marked counts: with two marks the tail is "Rest", and naming Rest left the
 *  screen with a phase to name but nothing to train — so the largest marked trainable phase is named
 *  instead. One segment (no valid mark) is all Rest, so there is nothing to name. */
export function worstPhase(splits: number[]): { label: string; share: number } | null {
  const total = splits.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return null;
  const labels = phaseLabels(splits.length);
  let at = -1;
  splits.forEach((v, i) => {
    if ((PHASES as readonly string[]).includes(labels[i]) && (at < 0 || v > splits[at])) at = i;
  });
  return at < 0 ? null : { label: labels[at], share: Math.round((100 * splits[at]) / total) };
}
