import { describe, it, expect } from 'vitest';
import {
  averageOf, meanOf, mean, best, bestAverage, formatTime, effective, runningAverage, attemptExec,
  stdDev, splitSegments, phaseLabels, phaseMeans, PHASES, type Solve,
} from './stats';
const mk = (ms: number, pen: Solve['pen'] = ''): Solve => ({ id: String(Math.random()), ms, pen, scramble: '', event: '333', ts: 0 });
const list = (...v: (number | [number, Solve['pen']])[]) => v.map(x => (Array.isArray(x) ? mk(x[0], x[1]) : mk(x)));

describe('stats', () => {
  it('+2 and DNF', () => {
    expect(effective(mk(10000, '+2'))).toBe(12000);
    expect(effective(mk(10000, 'DNF'))).toBe(Infinity);
  });
  it('ao5 drops best and worst', () => {
    expect(averageOf(list(9000, 10000, 11000, 12000, 20000), 5)).toBe(11000);
  });
  it('one DNF is dropped as the worst', () => {
    expect(averageOf(list(9000, 10000, 11000, 12000, [1, 'DNF']), 5)).toBe(11000);
  });
  it('two DNFs make the average DNF', () => {
    expect(averageOf(list(9000, 10000, [1, 'DNF'], 12000, [1, 'DNF']), 5)).toBe(Infinity);
  });
  it('needs enough solves', () => expect(averageOf(list(1, 2, 3), 5)).toBeNull());
  it('uses only the last n', () => {
    expect(averageOf(list(99999, 9000, 10000, 11000, 12000, 20000), 5)).toBe(11000);
  });
  it('+2 changes the average', () => {
    expect(averageOf(list(9000, 10000, 11000, [12000, '+2'], 20000), 5)).toBe(11666.666666666666);
  });
  it('mo3 with a DNF is DNF', () => {
    expect(meanOf(list(1000, 2000, 3000), 3)).toBe(2000);
    expect(meanOf(list(1000, 2000, [3000, 'DNF']), 3)).toBe(Infinity);
  });
  it('a plain mean over already-resolved times, and null for an empty list', () => {
    expect(mean([1000, 2000, 3000])).toBe(2000);
    expect(mean([])).toBeNull();
    expect(mean([0])).toBe(0);
  });
  it('best single and best average', () => {
    expect(best(list(9000, [5000, '+2'], 8000))).toBe(7000);
    expect(bestAverage(list(20000, 20000, 20000, 20000, 20000, 9000, 9000, 9000, 9000, 9000), 5)).toBe(9000);
  });
  it('best single survives a list far too long to spread into Math.min', () => {
    const many = Array.from({ length: 150_000 }, (_, i) => mk(1000 + i));
    expect(best(many)).toBe(1000);
  }, 20_000);   // 150k objects: slow on a loaded machine, and that must not read as a failure
  it('best average matches a naive scan over the same windows', () => {
    const naive = (xs: Solve[], n: number) => {
      let b: number | null = null;
      for (let i = n; i <= xs.length; i++) {
        const a = averageOf(xs.slice(0, i), n);
        if (a !== null && (b === null || a < b)) b = a;
      }
      return b;
    };
    const seed = (i: number) => ((i * 2654435761) % 1000) / 100 + 7;   // deterministic spread
    for (const n of [3, 5, 12]) {
      const xs = Array.from({ length: 120 }, (_, i) => mk(Math.round(seed(i) * 1000), i % 17 === 0 ? 'DNF' : i % 11 === 0 ? '+2' : ''));
      expect(bestAverage(xs, n)).toBe(naive(xs, n));
    }
  });
  it('best average over 20 000 solves reads each solve a fixed number of times', () => {
    const xs = Array.from({ length: 20_000 }, (_, i) => mk(8000 + (i % 400) * 10));
    // A wall clock says more about the machine than about the code: this ran as "fast" on an idle box and
    // failed while a build was running. Count the touches instead - a single pass reads every solve once
    // (plus the two it re-reads to evict), a re-sorting or naive rescan reads them many times over.
    let reads = 0;
    const counted = new Proxy(xs, {
      get(target, key, recv) { if (typeof key === 'string' && /^\d+$/.test(key)) reads++; return Reflect.get(target, key, recv); },
    });
    const b = bestAverage(counted, 5);
    expect(b).not.toBeNull();
    expect(reads).toBeLessThan(xs.length * 6);
    expect(reads).toBeGreaterThanOrEqual(xs.length);   // it did read the list
  });
  it('formats times', () => {
    expect(formatTime(9840)).toBe('9.84');
    expect(formatTime(65430)).toBe('1:05.43');
    expect(formatTime(Infinity)).toBe('DNF');
    expect(formatTime(null)).toBe('–');
  });
  it('the running average follows the same WCA rules as averageOf', () => {
    const xs = list(10000, 12000, 11000, 9000, 20000, [1, 'DNF'], 9500, 13000);
    const run = runningAverage(xs.map(effective), 5);
    for (let i = 0; i < xs.length; i++) {
      const expected = averageOf(xs.slice(0, i + 1), 5);
      expect(run[i], `window ${i}`).toBe(expected);
    }
  });
  it('an attempt with a penalty costs the penalty, and a DNF has no time', () => {
    expect(attemptExec({ total: 9000, recog: 500 })).toBe(8500);
    expect(attemptExec({ total: 9000, recog: 500, pen: '+2' })).toBe(10500);
    expect(attemptExec({ total: 9000, recog: 500, pen: 'DNF' })).toBe(Infinity);
  });
  it('truncates to centiseconds instead of rounding up', () => {
    expect(formatTime(9999)).toBe('9.99');     // rounding would give 10.00
    expect(formatTime(59_999)).toBe('59.99');  // rounding would give 1:00.00
    expect(formatTime(60_000)).toBe('1:00.00');
    expect(formatTime(9)).toBe('0.00');
  });
  it('never prints NaN or a negative time', () => {
    expect(formatTime(NaN)).toBe('–');
    expect(formatTime(-500)).toBe('–');
    expect(formatTime(undefined)).toBe('–');
  });
});

import { inspectionPenalty, inspectionText } from './inspection';
describe('inspection', () => {
  it('penalties follow WCA thresholds', () => {
    expect(inspectionPenalty(0)).toBe('');
    expect(inspectionPenalty(15000)).toBe('');
    expect(inspectionPenalty(15001)).toBe('+2');
    expect(inspectionPenalty(17000)).toBe('+2');
    expect(inspectionPenalty(17001)).toBe('DNF');
  });
  it('countdown text', () => {
    expect(inspectionText(0)).toBe('15');
    expect(inspectionText(7200)).toBe('8');
    expect(inspectionText(14900)).toBe('1');
    expect(inspectionText(16000)).toBe('+2');
    expect(inspectionText(18000)).toBe('DNF');
  });
});

describe('consistency', () => {
  it('is the sample standard deviation of the finished times', () => {
    expect(stdDev([1000, 1000, 1000])).toBe(0);
    expect(stdDev([900, 1100])).toBeCloseTo(141.42, 1);
  });
  it('ignores DNFs and needs two numbers to be about anything', () => {
    expect(stdDev([1000, Infinity])).toBeNull();
    expect(stdDev([])).toBeNull();
  });
});

describe('phase splits', () => {
  it('turns marks into segment lengths, the last one running to the stop', () => {
    expect(splitSegments([2000, 9000, 12000], 18000)).toEqual([2000, 7000, 3000, 6000]);
  });
  it('drops a mark that is out of order, on top of the last one, or past the stop', () => {
    // a double tap (equal), a backwards tap, a tap after the stop, and a NaN
    expect(splitSegments([3000, 3000, 1000, 20000, NaN], 15000)).toEqual([3000, 12000]);
    expect(splitSegments([], 15000)).toEqual([]);
    expect(splitSegments([0], 15000)).toEqual([]);
  });
  it('names four segments as the four phases and fewer by what they are', () => {
    expect(phaseLabels(4)).toEqual(['Cross', 'F2L', 'OLL', 'PLL']);
    expect(phaseLabels(3)).toEqual(['Cross', 'F2L', 'Rest']);
    expect(phaseLabels(1)).toEqual(['Rest']);
    expect(phaseLabels(0)).toEqual([]);
  });
  it('averages each phase over the last twelve split solves, skipping DNFs and gaps', () => {
    const withSplit = (times: number[], pen: Solve['pen'] = ''): Solve => ({ ...mk(10000, pen), splits: times });
    const solves = [
      withSplit([1000, 8000, 1000, 0].slice(0, 3)),
      withSplit([3000, 4000, 2000], 'DNF'),
      withSplit([2000, 6000, 2000]),
      mk(10000),                       // no split at all: not part of any phase average
    ];
    const [cross, f2l, oll] = phaseMeans(solves, 12, 4);
    expect(cross).toBeCloseTo(1500, 6);   // 1000 and 2000; the DNF solve is left out
    expect(f2l).toBeCloseTo(7000, 6);
    expect(oll).toBeCloseTo(1500, 6);
    expect(phaseMeans(solves, 12, 4)[3]).toBeNull();  // nothing ever marked a fourth phase
    expect(PHASES.length).toBe(4);
  });
});
