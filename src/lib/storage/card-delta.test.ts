import 'fake-indexeddb/auto';
import { describe, it, expect, beforeAll } from 'vitest';
import { IdbStorage } from './index';
import { SETS } from '../data';

// A save only writes the cards the app says it touched, so this file is the safety net: every way the
// store changes a case is driven through the real store, saved, and read back from IndexedDB. If a
// mutator forgets to mark its card, the change is on screen and gone after a reload — which is the one
// failure this codebase cannot afford.

// the store only touches documentElement for theme and text size
(globalThis as any).document = { documentElement: { dataset: {}, style: {} } };
const { store } = await import('../store.svelte');

const reload = async () => (await new IdbStorage().load())!;
const flushAndReload = async () => { await store.flush(); return reload(); };

beforeAll(async () => {
  // fake-indexeddb is per-process, so a fresh database name is not needed: the store starts empty on it
  (store as unknown as { storage: IdbStorage }).storage = new IdbStorage();
  await store.init();
});

describe('card changes reach the disk', () => {
  it('a graded attempt', async () => {
    const id = SETS.PLL[0].id;
    store.grade(id, 2, 9000, 4000);
    const back = await flushAndReload();
    expect(back.cards[id].attempts.length).toBe(1);
    expect(back.cards[id].attempts[0]).toMatchObject({ total: 9000, recog: 4000, grade: 2 });
  });

  it('a chosen default algorithm', async () => {
    const id = SETS.PLL[1].id;
    const alt = `${SETS.PLL[1].alg} U U'`;
    store.addAlg(id, alt);
    await flushAndReload();
    store.setDefault(id, alt);
    expect((await flushAndReload()).cards[id].defaultAlg).toBe(alt);
  });

  it('an algorithm added and then removed', async () => {
    const id = SETS.PLL[2].id;
    const alt = `${SETS.PLL[2].alg} U U'`;
    store.addAlg(id, alt);
    expect((await flushAndReload()).cards[id].algs).toEqual([alt]);

    store.removeAlg(id, alt);
    expect((await flushAndReload()).cards[id].algs).toEqual([]);
  });

  it('a penalty on the last attempt, and dropping it', async () => {
    const id = SETS.PLL[3].id;
    store.grade(id, 2, 9000, 4000);
    await flushAndReload();
    store.penAttempt(id, '+2');
    expect((await flushAndReload()).cards[id].attempts.at(-1)!.pen).toBe('+2');

    store.deleteLastAttempt(id);
    expect((await flushAndReload()).cards[id].attempts).toEqual([]);
  });

  it('a reset of the progress on one case', async () => {
    const id = SETS.PLL[4].id;
    store.grade(id, 3, 7000, 3000);
    await flushAndReload();
    store.resetCard(id);
    const after = (await flushAndReload()).cards[id];
    expect(after.seen).toBe(false);
    expect(after.attempts).toEqual([]);
  });

  it('removing the user’s own ZBLL algorithms', async () => {
    const id = SETS.ZBLL[0].id;
    const alt = `${SETS.ZBLL[0].alg} U U'`;
    store.addAlg(id, alt);
    expect((await flushAndReload()).cards[id].algs).toEqual([alt]);

    store.clearZbll();
    expect((await flushAndReload()).cards[id].algs).toEqual([]);
  });

  // Saves deep-copy only what changed, so a stale cached copy would be silent data loss. Two changes
  // are made straight on the state object, where no store method marks anything: the comparison in
  // forSave() has to catch both on its own.
  it('writes a change nothing marked, because the copy is compared before it is reused', async () => {
    const id = SETS.PLL[7].id;
    store.addSolve(9000, 'R U');
    const solveId = store.data.solves.at(-1)!.id;
    await flushAndReload();

    store.data.solves.find(s => s.id === solveId)!.pen = '+2';   // no method, no marking
    store.grade(id, 2, 9000, 4000);
    await flushAndReload();
    store.data.cards[id].due = 12345;                            // ditto
    const back = await flushAndReload();

    expect(back.solves.find(s => s.id === solveId)!.pen).toBe('+2');
    expect(back.cards[id].due).toBe(12345);
  });

  // the delta must not take a stale copy of an untouched card with it
  it('leaves cases it was not told about exactly as they were', async () => {
    const kept = SETS.PLL[5].id, other = SETS.PLL[6].id;
    store.grade(kept, 2, 8000, 3000);
    await flushAndReload();

    store.grade(other, 0, 20000, 9000);
    const back = await flushAndReload();
    expect(back.cards[kept].attempts.length).toBe(1);
    expect(back.cards[kept].attempts[0].total).toBe(8000);
    expect(back.cards[other].attempts[0].total).toBe(20000);
  });
});
