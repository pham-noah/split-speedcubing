// Personalises the FSRS parameters from the user's own review history, entirely on the device.
//
// How: replay every case's reviews through the FSRS model; before each review that happened a day or more after the
// previous one, the model predicts the chance of recalling the case. We compare that prediction with what actually
// happened (Again = forgotten, anything else = recalled) using log loss, and search for parameters that predict better.
// With little history a search like this overfits, so it is (1) pulled gently towards the default parameters and
// (2) checked on cases that were held out of the search: the new parameters are only applied if they also predict
// those held-out cases better than the defaults do.
import { createEmptyCard, fsrs, generatorParameters, clipParameters, default_w, State, type FSRS, type Grade as FGrade } from 'ts-fsrs';

export interface LogEntry { ts: number; grade: 0 | 1 | 2 | 3 }
export type CardLog = LogEntry[];
export interface Loss { bce: number; n: number }
export interface OptResult { applied: boolean; w: number[]; before: number; after: number; n: number; nVal: number; reason: string }

export const MIN_POINTS = 100;   // usable review points needed before optimising
export const MIN_VAL_POINTS = 20;
const DAY = 86_400_000;
const EPS = 1e-4;
export const DEFAULT_W: number[] = [...default_w];

/** Reviews per case in time order; cases with fewer than two reviews carry no information. */
export function collectLogs(cards: Record<string, { attempts: { ts: number; grade: number }[] }>): CardLog[] {
  return Object.values(cards)
    .map(c => c.attempts.filter(a => a.grade >= 0 && a.grade <= 3).map(a => ({ ts: a.ts, grade: a.grade as 0 | 1 | 2 | 3 })).sort((a, b) => a.ts - b.ts))
    .filter(l => l.length >= 2)
    .sort((a, b) => a[0].ts - b[0].ts);
}

const model = (w: number[]): FSRS => fsrs(generatorParameters({ w: clipParameters(w, 1, true), enable_fuzz: false }));

/** Log loss of the model's recall predictions over the logs. Only reviews at least a day after the previous one count. */
export function evaluate(w: number[], logs: CardLog[]): Loss {
  const f = model(w);
  let sum = 0, n = 0;
  for (const log of logs) {
    let card = createEmptyCard(new Date(log[0].ts));
    for (const e of log) {
      const now = new Date(e.ts);
      if (card.state === State.Review && card.last_review && e.ts - card.last_review.getTime() >= DAY) {
        const r = Math.min(1 - EPS, Math.max(EPS, f.get_retrievability(card, now, false) as number));
        sum -= e.grade > 0 ? Math.log(r) : Math.log(1 - r);
        n++;
      }
      card = f.next(card, now, (e.grade + 1) as FGrade).card;
    }
  }
  return { bce: n ? sum / n : 0, n };
}

export const countPoints = (logs: CardLog[]) => evaluate(DEFAULT_W, logs).n;

const PRIOR_STRENGTH = 3; // nats of log loss it costs to move every parameter 100% away from its default

interface Options { sweeps?: number; onProgress?: (fraction: number) => void; yieldToUi?: boolean }

/** Pattern search with a pull towards the defaults. Returns the best parameters found on the training logs. */
async function search(train: CardLog[], w0: number[], opts: Options): Promise<number[]> {
  const sweeps = opts.sweeps ?? 8;
  const scale = w0.map(v => Math.max(Math.abs(v), 0.1));
  const cost = (w: number[]) => {
    const l = evaluate(w, train);
    let prior = 0;
    w.forEach((v, i) => { prior += ((v - w0[i]) / scale[i]) ** 2; });
    return l.bce * l.n + PRIOR_STRENGTH * prior;
  };
  let w = clipParameters([...w0], 1, true);
  let best = cost(w);
  let step = w.map((_, i) => 0.15 * scale[i]);
  for (let s = 0; s < sweeps; s++) {
    let improved = false;
    for (let i = 0; i < w.length; i++) {
      for (const dir of [1, -1]) {
        const cand = [...w];
        cand[i] = w[i] + dir * step[i];
        const clipped = clipParameters(cand, 1, true);
        if (clipped[i] === w[i]) continue;
        const c = cost(clipped);
        if (c < best - 1e-9) { best = c; w = clipped; improved = true; break; }
      }
      opts.onProgress?.((s * w.length + i + 1) / (sweeps * w.length));
      if (opts.yieldToUi) await new Promise(r => setTimeout(r, 0));
    }
    if (!improved) step = step.map(v => v / 2);
  }
  return w;
}

export async function optimizeParameters(logs: CardLog[], w0: number[] = DEFAULT_W, opts: Options = {}): Promise<OptResult> {
  const n = countPoints(logs);
  const none = (reason: string, nVal = 0): OptResult => ({ applied: false, w: w0, before: 0, after: 0, n, nVal, reason });
  if (n < MIN_POINTS) return none(`Not enough history yet: ${n} usable reviews, at least ${MIN_POINTS} needed. Keep training and try again later.`);
  // hold out every fifth case to check the result on data the search never saw
  const train = logs.filter((_, i) => i % 5 !== 4), val = logs.filter((_, i) => i % 5 === 4);
  const nVal = evaluate(w0, val).n;
  if (nVal < MIN_VAL_POINTS) return none(`Not enough held-out reviews to check the result (${nVal}). Keep training and try again later.`, nVal);
  const w = await search(train, w0, opts);
  const before = evaluate(w0, val).bce, after = evaluate(w, val).bce;
  if (after < before - 0.002) {
    return { applied: true, w, before, after, n, nVal, reason: `Prediction error on held-out cases improved from ${before.toFixed(3)} to ${after.toFixed(3)}.` };
  }
  return { applied: false, w: w0, before, after, n, nVal, reason: `The default parameters already predict your recall as well as anything I found (${before.toFixed(3)} vs ${after.toFixed(3)}), so nothing was changed.` };
}
