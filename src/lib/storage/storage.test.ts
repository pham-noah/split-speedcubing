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
});
