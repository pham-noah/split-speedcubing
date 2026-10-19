import { describe, it, expect } from 'vitest';
import { createEmptyCard, fsrs, generatorParameters, clipParameters, type Grade as FGrade } from 'ts-fsrs';
import { collectLogs, evaluate, optimizeParameters, countPoints, DEFAULT_W, MIN_POINTS, type CardLog } from './fsrs-optimize';

// deterministic random numbers
const rng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/** Simulate a learner whose memory follows `truth`: reviews happen when the cards are due, recall is sampled from the true curve. */
function simulate(truth: number[], cards: number, reviews: number, seed: number): CardLog[] {
  const f = fsrs(generatorParameters({ w: clipParameters(truth, 1, true), enable_fuzz: false }));
  const rnd = rng(seed);
  const logs: CardLog[] = [];
  const t0 = 1_700_000_000_000;
  for (let c = 0; c < cards; c++) {
    let card = createEmptyCard(new Date(t0 + c * 3_600_000));
    let now = t0 + c * 3_600_000;
    const log: CardLog = [];
    for (let r = 0; r < reviews; r++) {
      // the learner reviews on the due day (not earlier), so the sample covers many different gaps
      now = Math.max(now, card.due.getTime()) + Math.floor(rnd() * 86_400_000);
      let grade: 0 | 1 | 2 | 3 = 2;
      if (card.last_review && now - card.last_review.getTime() >= 86_400_000) {
        const p = f.get_retrievability(card, new Date(now), false) as number;
        grade = rnd() < p ? (rnd() < 0.15 ? 3 : rnd() < 0.2 ? 1 : 2) : 0;
      }
      log.push({ ts: now, grade });
      card = f.next(card, new Date(now), (grade + 1) as FGrade).card;
    }
    logs.push(log);
  }
  return logs;
}

describe('FSRS personalisation', () => {
  it('collectLogs keeps order and drops cards with fewer than two reviews', () => {
    const logs = collectLogs({
      a: { attempts: [{ ts: 5, grade: 2 }, { ts: 1, grade: 0 }] },
      b: { attempts: [{ ts: 3, grade: 2 }] },
      c: { attempts: [] },
    });
    expect(logs.length).toBe(1);
    expect(logs[0].map(e => e.ts)).toEqual([1, 5]);
  });

  it('evaluate only scores reviews at least a day apart, and loss is finite', () => {
    const l = evaluate(DEFAULT_W, simulate(DEFAULT_W, 5, 8, 1));
    expect(l.n).toBeGreaterThan(5);
    expect(Number.isFinite(l.bce)).toBe(true);
    expect(l.bce).toBeGreaterThan(0);
  });

  it('declines when there is too little history', async () => {
    const r = await optimizeParameters(simulate(DEFAULT_W, 3, 5, 2));
    expect(r.applied).toBe(false);
    expect(r.reason).toContain('Not enough');
    expect(r.w).toEqual(DEFAULT_W);
  });

  it('predicts held-out reviews better than the defaults for a learner who forgets differently', async () => {
    // a learner whose memory decays faster and whose stability grows more slowly than the defaults assume
    const truth = [...DEFAULT_W];
    truth[20] = 0.45;  // shape of the forgetting curve
    truth[8] = 1.1;    // stability growth after a successful review
    truth[5] = 1.4;
    const logs = simulate(truth, 140, 9, 7);
    expect(countPoints(logs)).toBeGreaterThan(MIN_POINTS);
    const r = await optimizeParameters(logs, DEFAULT_W, { sweeps: 6 });
    expect(r.applied, r.reason).toBe(true);
    expect(r.after).toBeLessThan(r.before - 0.002);
    expect(r.w.length).toBe(21);
    expect(r.w.every(Number.isFinite)).toBe(true);
    expect(r.w).not.toEqual(DEFAULT_W);
  }, 120_000);

  it('leaves the defaults alone for a learner who already matches them', async () => {
    const r = await optimizeParameters(simulate(DEFAULT_W, 140, 9, 11), DEFAULT_W, { sweeps: 4 });
    // either nothing better exists on held-out data (not applied), or any gain is tiny
    if (r.applied) expect(r.before - r.after).toBeLessThan(0.02);
    else expect(r.w).toEqual(DEFAULT_W);
  }, 120_000);
});
