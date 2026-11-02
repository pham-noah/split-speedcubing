import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
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
  it('reads a file cstimer.net itself wrote', () => {
    // src/lib/core/fixtures/cstimer-export.json is the output of csTimer's own export (storage.exportAll +
    // properties), produced in the running app on 2026-11-02 from three seeded 3x3 solves and one 4x4.
    const text = readFileSync(new URL('./fixtures/cstimer-export.json', import.meta.url), 'utf8');
    const real = parseImport(text);
    expect(real.format).toBe('csTimer');
    expect(real.sessions.length).toBe(1);
    const s = real.sessions[0];
    expect(s.name).toBe('Main');
    expect(s.solves.map(x => [x.ms, x.pen])).toEqual([[12340, ''], [8500, '+2'], [0, 'DNF']]);
    expect(s.solves[0].scramble).toBe("R U R' U'");
    expect(s.solves[1].ts).toBe(1700000100000);
    expect(real.notes.join(' ')).toContain('other puzzles');
    // every empty session csTimer writes must be skipped, not turned into an empty one here
    expect(real.sessions.every(x => x.solves.length > 0)).toBe(true);
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

describe('CubeDesk export', () => {
  // the shape kash/cubedesk writes (types/solve.ts, types/session.ts): time in seconds, a DNF as -1,
  // trainer_name for trainer solves, session_id linking a solve to its session
  const desk = JSON.stringify({
    sessions: [{ id: 's1', name: 'Main', order: 1 }, { id: 's2', name: 'One-handed', order: 2 }],
    solves: [
      { time: 9.84, raw_time: 9.84, event_type: '333', scramble: "R U R' U'", session_id: 's1', dnf: false, plus_two: false, trainer_name: null, ended_at: 1700000000000 },
      { time: 12.4, raw_time: 10.4, event_type: '333', scramble: 'F B', session_id: 's1', dnf: false, plus_two: true, trainer_name: null, ended_at: 1700000100000 },
      { time: -1, raw_time: 30.1, event_type: '333', scramble: 'L D', session_id: 's1', dnf: true, plus_two: false, trainer_name: null, ended_at: 1700000200000 },
      { time: 21.5, raw_time: 21.5, event_type: '333oh', scramble: 'B2', session_id: 's2', dnf: false, plus_two: false, trainer_name: null, ended_at: 1700000300000 },
      { time: 45.0, raw_time: 45.0, event_type: '444', scramble: 'R2', session_id: 's1', dnf: false, plus_two: false, trainer_name: null, ended_at: 1700000400000 },
      { time: 3.2, raw_time: 3.2, event_type: '333', scramble: 'U', session_id: null, dnf: false, plus_two: false, trainer_name: 'PLL trainer', ended_at: 1700000500000 },
    ],
  });
  const r = parseImport(desk);
  it('is recognised as CubeDesk and keeps its sessions', () => {
    expect(r.format).toBe('CubeDesk');
    expect(r.sessions.map(s => s.name)).toEqual(['Main', 'One-handed']);
    expect(r.sessions.map(s => s.solves.length)).toEqual([3, 1]);
  });
  it('reads seconds, a +2 flag and a DNF stored as -1', () => {
    const s = r.sessions[0].solves;
    expect(s[0]).toEqual({ ms: 9840, pen: '', scramble: "R U R' U'", ts: 1700000000000 });
    // CubeDesk's +2 is already inside `time` (12.4 = 10.4 + 2), so the raw time is what gets the penalty here
    expect(s[1]).toMatchObject({ ms: 10400, pen: '+2' });
    // a DNF is stored as time -1 with the real time in raw_time; it used to be dropped entirely
    expect(s[2]).toMatchObject({ ms: 30100, pen: 'DNF' });
    expect(r.sessions[1].solves[0].ms).toBe(21500);
  });
  it('skips other puzzles and trainer solves, and says so', () => {
    const notes = r.notes.join(' ');
    expect(notes).toContain('other puzzles');
    expect(notes).toContain('trainer');
  });
  it('does not mistake a csTimer export for it', () => {
    expect(parseImport(csTimer).format).toBe('csTimer');
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
