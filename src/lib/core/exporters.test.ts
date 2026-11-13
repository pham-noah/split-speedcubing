import { describe, it, expect } from 'vitest';
import { toCsTimer } from './exporters';
import { parseImport } from './importers';
import type { Solve } from './stats';

const mk = (ms: number, pen: Solve['pen'] = '', ts = 1_700_000_000_000): Solve =>
  ({ id: String(ms), ms, pen, scramble: "R U R'", event: '333', ts });

describe('csTimer export', () => {
  it('writes the shape cstimer.net writes: numbered sessions, [pen, ms] rows, a properties block', () => {
    const file = JSON.parse(toCsTimer([{ name: 'Main', solves: [mk(12_340), mk(8_500, '+2'), mk(0, 'DNF')] }]));
    expect(Object.keys(file).sort()).toEqual(['properties', 'session1']);
    expect(file.session1).toEqual([
      [[0, 12340], "R U R'", '', 1_700_000_000],
      [[2000, 8500], "R U R'", '', 1_700_000_000],
      [[-1, 0], "R U R'", '', 1_700_000_000],
    ]);
    expect(file.properties.sessionN).toBe(1);
    const meta = JSON.parse(file.properties.sessionData);
    expect(meta['1']).toEqual({ name: 'Main', opt: {}, rank: 1 });
  });

  it('names a 2x2 session the way csTimer expects it, and leaves empty sessions out', () => {
    const file = JSON.parse(toCsTimer([
      { name: 'Empty', event: '333', solves: [] },
      { name: '2x2', event: '222', solves: [mk(4000)] },
    ]));
    expect(Object.keys(file).sort()).toEqual(['properties', 'session1']);
    expect(JSON.parse(file.properties.sessionData)['1']).toEqual({ name: '2x2', opt: { scrType: '222so' }, rank: 1 });
  });

  it('reads back through the app own csTimer importer, solves and penalties intact', () => {
    const solves = [mk(12_340), mk(8_500, '+2'), mk(0, 'DNF'), mk(9_999)];
    const back = parseImport(toCsTimer([{ name: 'Main', solves }]));
    expect(back.format).toBe('csTimer');
    expect(back.sessions).toHaveLength(1);
    expect(back.sessions[0].name).toBe('Main');
    expect(back.sessions[0].solves.map((s) => [s.ms, s.pen])).toEqual([
      [12_340, ''], [8_500, '+2'], [0, 'DNF'], [9_999, ''],
    ]);
  });
});
