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
  // the trust boundary has to check strings too: a numeric alg reached the cube simulator, and a
  // numeric name threw inside zbllNamed the moment the Library imported anything
  it('drops own ZBLL cases whose id, name or alg is not a string', () => {
    const d = normalize({ solves: [], cards: {}, zbll: [
      { id: 'ok', name: 'Mine', alg: "R U R' U'" },
      { id: 'numalg', name: 'Mine', alg: 5 },
      { id: 'noname', alg: "R U R' U'" },
      { id: 'blank', name: 'Mine', alg: '   ' },
      { id: 7, name: 'Mine', alg: "R U R' U'" },
      null,
      'nonsense',
    ] });
    expect(d.zbll.map(c => c.id)).toEqual(['ok', 'noname']);
    expect(d.zbll[1].name).toBe('noname');   // a missing name falls back to the id, which is a string
  });
  it('drops drill rows from a mode no screen can show', () => {
    const d = normalize({ solves: [], cards: {}, drills: [
      { type: 'cross', ms: 5000, memo: null, ok: true, ts: 1 },
      { type: 'pll2', ms: 8000, ok: false, ts: 2, pen: '+2', info: 'x' },
      { type: 'nope', ms: 1000, ok: true, ts: 3 },
      { type: 'bld', ms: -1, ok: true, ts: 4 },
      { type: 'bld', ms: NaN, ok: true, ts: 5 },
      { type: 'oll2', ms: 3000, ok: 'yes', ts: 6, pen: 'bogus' },
    ] });
    expect(d.drills.map(r => r.type)).toEqual(['cross', 'pll2', 'oll2']);
    expect(d.drills[1]).toMatchObject({ pen: '+2', info: 'x' });
    expect(d.drills[2].ok).toBe(false);        // only a real true counts
    expect(d.drills[2].pen).toBeUndefined();
  });
  it('keeps only hex colours a diagram can actually paint', () => {
    const d = normalize({ solves: [], cards: {}, settings: { cubeColors: ['#ff0000', 'red', 7, '#00FF00'] } });
    expect(d.settings.cubeColors).toEqual(['#ff0000', '#00FF00']);
  });
});
