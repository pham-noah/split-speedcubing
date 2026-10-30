import { describe, it, expect } from 'vitest';

// minimal DOM stub: the store only touches documentElement for theme and text size (same as store.svelte.test.ts)
(globalThis as any).document = { documentElement: { dataset: {}, style: {} } };
import { F2L } from './data/f2l';
import { F2L_DATA_REV } from './data';
import { solvesCase } from './core/alg';
import { MemoryStorage } from './storage';
import { defaultData, type AppData } from './storage/model';

// 0.5.0 renumbered F2L, so a save written before it has progress sitting on cases that now mean
// something else. This file is about that one-time migration and nothing else: what it clears, what it
// keeps, and what it must not touch.
const store = (await import('./store.svelte')).store;
const card = (seen: boolean, due: number, algs?: string[], defaultAlg?: string) => ({
  seen, due, attempts: [{ ts: 1, total: 9000, recog: 4000, grade: 3 }], ...(algs ? { algs } : {}), ...(defaultAlg ? { defaultAlg } : {}),
});

const base = F2L[0];
// an algorithm that still solves this case, spelled differently from the bundled one
const good = `${base.alg} U U'`;
// and one that solves a different case, so it must not survive on this card
const bad = F2L.find(c => c.id !== base.id && !solvesCase(base.alg, c.alg, true))!.alg;

describe('0.5.0 F2L migration', () => {
  it('clears progress logged against the old numbering, keeps the algorithms that still fit, and leaves other sets alone', async () => {
    const old = defaultData();
    delete (old as Partial<AppData>).f2lRev;                 // a save from before the renumbering
    old.cards[base.id] = card(true, 99, [good, bad], good);
    old.cards[base.id.replace('F2L', 'F2L-old')] = card(true, 99, [good]);   // an id the new table has never had
    old.cards['PLL-Aa'] = card(true, 42);
    old.cards['OLL-21'] = card(true, 7);

    const mem = new MemoryStorage();
    await mem.save(old);
    (store as unknown as { storage: MemoryStorage }).storage = mem;
    await store.init();

    const after = store.data.cards[base.id];
    expect(after.seen).toBe(false);
    expect(after.due).toBe(0);
    expect(after.attempts).toEqual([]);
    expect(after.algs).toEqual([good]);        // the good spelling survives, the foreign algorithm does not
    expect(after.defaultAlg).toBe(good);

    // PLL and OLL kept their numbering, so their progress must not move
    expect(store.data.cards['PLL-Aa']).toMatchObject({ seen: true, due: 42 });
    expect(store.data.cards['OLL-21']).toMatchObject({ seen: true, due: 7 });
    expect(store.data.f2lRev).toBe(F2L_DATA_REV);
  });

  it('runs once: a later load does not clear what was logged since', async () => {
    store.data.cards[base.id] = card(true, 11);
    await store.flush();
    const mem = new MemoryStorage();
    await mem.save(store.data);
    (store as unknown as { storage: MemoryStorage }).storage = mem;

    await store.init();
    expect(store.data.cards[base.id]).toMatchObject({ seen: true, due: 11 });
  });
});
