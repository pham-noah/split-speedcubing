import { describe, it, expect } from 'vitest';
import { MemoryStorage } from './index';
import { defaultData, normalize } from './model';

describe('storage + backup', () => {
  it('round-trips data', async () => {
    const s = new MemoryStorage();
    expect(await s.load()).toBeNull();
    const d = defaultData();
    d.solves.push({ id: '1', ms: 9000, pen: '', scramble: 'R U', event: '333', ts: 1 });
    await s.save(d);
    expect((await s.load())!.solves[0].ms).toBe(9000);
  });
  it('normalizes partial backups and rejects junk', () => {
    const d = normalize({ solves: [{ id: 'x', ms: 1, pen: '', scramble: '', event: '333', ts: 0 }, null, { bad: 1 }] });
    expect(d.solves.length).toBe(1);
    expect(d.settings.theme).toBe('midnight');
    expect(() => normalize('hello')).toThrow();
    expect(() => normalize(null)).toThrow();
  });
  it('drops solves whose numbers would poison the statistics', () => {
    const d = normalize({ solves: [
      { id: 'ok', ms: 1000, pen: '+2', scramble: 'R U', event: '333', ts: 5 },
      { id: 'nan', ms: NaN, pen: '', scramble: '', event: '333', ts: 5 },
      { id: 'neg', ms: -5000, pen: '', scramble: '', event: '333', ts: 5 },
      { id: 'badpen', ms: 2000, pen: 'bogus', scramble: '', event: '333', ts: 5 },
    ], cards: {} });
    expect(d.solves.map(s => s.id)).toEqual(['ok', 'badpen']);
    expect(d.solves[1].pen).toBe('');
  });
  it('gives duplicate ids a unique key so the keyed list cannot throw', () => {
    const d = normalize({ solves: [
      { id: 'same', ms: 1000, pen: '', scramble: '', event: '333', ts: 1 },
      { id: 'same', ms: 2000, pen: '', scramble: '', event: '333', ts: 2 },
    ], cards: {} });
    expect(new Set(d.solves.map(s => s.id)).size).toBe(2);
  });
  it('clamps settings a hand-edited backup could put out of range', () => {
    const d = normalize({ solves: [], cards: {}, settings: { theme: 'neon', textSize: 400, holdMs: 7, retention: 5, accent: 'red', hidden: null } });
    expect(d.settings.theme).toBe('midnight');
    expect(d.settings.textSize).toBe(100);
    expect(d.settings.holdMs).toBe(300);
    expect(d.settings.retention).toBe(0.99);
    expect(d.settings.accent).toBe('');
    expect(d.settings.hidden).toEqual({});
  });
  it('keeps a DNF that has no time at all', () => {
    const d = normalize({ solves: [{ id: 'd', ms: 0, pen: 'DNF', scramble: '', event: '333', ts: 5 }], cards: {} });
    expect(d.solves.length).toBe(1);
    expect(d.solves[0].pen).toBe('DNF');
    // a zero time without the DNF penalty is still junk
    expect(normalize({ solves: [{ id: 'z', ms: 0, pen: '', scramble: '', event: '333', ts: 5 }], cards: {} }).solves.length).toBe(0);
  });
  it('refuses a null cards field and a backup from a newer version', () => {
    expect(() => normalize({ cards: null })).toThrow();
    expect(() => normalize({ solves: [], cards: {}, v: 2 })).toThrow(/newer version/);
  });
});
