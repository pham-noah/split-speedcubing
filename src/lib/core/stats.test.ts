import { describe, it, expect } from 'vitest';
import { averageOf, meanOf, best, bestAverage, formatTime, effective, type Solve } from './stats';
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
  it('best single and best average', () => {
    expect(best(list(9000, [5000, '+2'], 8000))).toBe(7000);
    expect(bestAverage(list(20000, 20000, 20000, 20000, 20000, 9000, 9000, 9000, 9000, 9000), 5)).toBe(9000);
  });
  it('formats times', () => {
    expect(formatTime(9840)).toBe('9.84');
    expect(formatTime(65430)).toBe('1:05.43');
    expect(formatTime(Infinity)).toBe('DNF');
    expect(formatTime(null)).toBe('–');
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
