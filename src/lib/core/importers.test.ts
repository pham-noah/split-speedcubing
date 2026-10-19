import { describe, it, expect } from 'vitest';
import { parseImport, parseTimeText, withTimestamps } from './importers';

const csTimer = JSON.stringify({
  session1: [[[0, 12340], "R U R' U'", '', 1700000000], [[2000, 10500], 'F B', 'nice', 1700000100], [[-1, 20000], 'L D', '', 1700000200]],
  session2: [[[0, 40000], 'x', '', 1700000300]],
  session3: [[[0, 15000], 'y', '', 1700000400]],
  properties: { sessionData: JSON.stringify({ 1: { name: 'Main', opt: {} }, 2: { name: '4x4', opt: { scrType: '444wca' } }, 3: { name: 3, opt: { scrType: '333oh' } } }) },
});

describe('csTimer import', () => {
  const r = parseImport(csTimer);
  it('reads sessions, times, penalties, scrambles and dates', () => {
    expect(r.format).toBe('csTimer');
    expect(r.sessions.map(s => s.name)).toEqual(['Main', '3']);
    const s = r.sessions[0].solves;
    expect(s[0]).toEqual({ ms: 12340, pen: '', scramble: "R U R' U'", ts: 1700000000 * 1000 });
    expect(s[1].pen).toBe('+2');
    expect(s[2].pen).toBe('DNF');
  });
  it('skips sessions for other puzzles and says so', () => {
    expect(r.notes.join(' ')).toContain('Skipped 1 session');
  });
  it('3x3 without scrType is accepted', () => {
    const only = parseImport(JSON.stringify({ session1: [[[0, 9000], '', '', 1]], properties: { sessionData: '{"1":{"name":"A","opt":{}}}' } }));
    expect(only.sessions.length).toBe(1);
  });
});

describe('time text', () => {
  it('parses common forms', () => {
    expect(parseTimeText('9.84')).toEqual({ ms: 9840, pen: '' });
    expect(parseTimeText('1:05.43')).toEqual({ ms: 65430, pen: '' });
    expect(parseTimeText('10.5+')).toEqual({ ms: 10500, pen: '+2' });
    expect(parseTimeText('DNF')!.pen).toBe('DNF');
    expect(parseTimeText('DNF(12.30)')).toEqual({ ms: 12300, pen: 'DNF' });
    expect(parseTimeText('abc')).toBeNull();
    expect(parseTimeText('')).toBeNull();
  });
});

describe('CSV and list import', () => {
  it('reads a TwistyTimer / CubeDesk style CSV (penalty 1 = +2, 2 = DNF, other puzzles skipped)', () => {
    const csv = 'Puzzle;Category;Time;Date;Scramble;Penalty;Comment\n333;Normal;9.84;1657657016937;R U;0;\n333;Normal;11.2;1657657116937;F B;1;\n333;Normal;12.0;1657657216937;L D;2;\n222;Normal;3.1;1657657316937;R U;0;';
    const r = parseImport(csv);
    expect(r.format).toBe('CSV');
    const s = r.sessions[0].solves;
    expect(s.map(x => x.pen)).toEqual(['', '+2', 'DNF']);
    expect(s[0].ms).toBe(9840);
    expect(s[0].ts).toBe(1657657016937);
    expect(r.notes.join(' ')).toContain('other puzzles');
  });
  it('reads a csv with quoted scrambles and a Result column of OK/+2/DNF', () => {
    const r = parseImport('Event,Session,Time,Result,Scramble\n3x3x3,normal - 1,13.299,OK,"B D2 B L2"\n3x3x3,normal - 1,14.8,+2,"D R"');
    expect(r.sessions[0].name).toBe('normal - 1');
    expect(r.sessions[0].solves.length).toBe(2);
  });
  it('reads a plain list of times', () => {
    const r = parseImport('9.84\n10.55\n11.02+\nDNF\nhello');
    expect(r.format).toBe('List of times');
    expect(r.sessions[0].solves.map(s => s.pen)).toEqual(['', '', '+2', 'DNF']);
    expect(r.notes.join(' ')).toContain('1 line');
  });
});

describe('JSON backups (best effort)', () => {
  it('finds solves nested in sessions with time in seconds', () => {
    const r = parseImport(JSON.stringify({ sessions: [{ name: 'Practice', solves: [{ time: 9.84, scramble: 'R U', dnf: false, plus_two: false, created_at: '2023-05-01T10:00:00Z' }, { time: 12.1, scramble: 'F B', plus_two: true }] }] }));
    expect(r.sessions[0].name).toBe('Practice');
    expect(r.sessions[0].solves[0].ms).toBe(9840);
    expect(r.sessions[0].solves[1].pen).toBe('+2');
    expect(r.sessions[0].solves[0].ts).toBe(Date.parse('2023-05-01T10:00:00Z'));
  });
  it('rejects junk', () => {
    expect(parseImport('{"a":1}').sessions.length).toBe(0);
    expect(parseImport('{bad').notes[0]).toContain('not valid JSON');
    expect(parseImport('   ').notes[0]).toContain('empty');
  });
});

describe('timestamps', () => {
  it('fills missing timestamps in order, ending now', () => {
    const out = withTimestamps({ name: 'x', solves: [{ ms: 1, pen: '', scramble: '', ts: 0 }, { ms: 2, pen: '', scramble: '', ts: 1 }] }, 100000);
    expect(out[0].ts).toBeLessThan(out[1].ts);
    expect(out[1].ts).toBeLessThanOrEqual(100000);
  });
});

import { normalize } from '../storage/model';
describe('stored FSRS parameters', () => {
  it('malformed personalised parameters are dropped when loading a backup', () => {
    expect(normalize({ solves: [], cards: {}, settings: { fsrsW: [1, 2, 3] } }).settings.fsrsW).toBeUndefined();
    expect(normalize({ solves: [], cards: {}, settings: { fsrsW: Array(21).fill(0.5) } }).settings.fsrsW?.length).toBe(21);
  });
});
