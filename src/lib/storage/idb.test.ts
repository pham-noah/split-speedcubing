import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import { IdbStorage } from './index';
import { defaultData } from './model';
import type { Solve } from '../core/stats';

const solve = (id: string, ms: number, ts: number): Solve => ({ id, ms, pen: '', scramble: 'R U', event: '333', ts });

/** the v1 shape: everything, solves included, inside kv['app'] in database version 1 */
async function seedV1(solves: Solve[]): Promise<void> {
  await new Promise<void>((res, rej) => {
    const del = indexedDB.deleteDatabase('cube-trainer');
    del.onsuccess = () => res();
    del.onerror = () => rej(del.error);
    del.onblocked = () => res();
  });
  await new Promise<void>((res, rej) => {
    const r = indexedDB.open('cube-trainer', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => {
      const db = r.result;
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put({ ...defaultData(), solves }, 'app');
      tx.oncomplete = () => { db.close(); res(); };
      tx.onerror = () => rej(tx.error);
    };
    r.onerror = () => rej(r.error);
  });
}

/** open whatever version exists (v3 added the cards store; asking for 2 would be a downgrade) */
function rawSolves(): Promise<Solve[]> {
  return new Promise((res, rej) => {
    const r = indexedDB.open('cube-trainer');
    r.onsuccess = () => {
      const db = r.result;
      const q = db.transaction('solves').objectStore('solves').getAll();
      q.onsuccess = () => { res(q.result as Solve[]); db.close(); };
      q.onerror = () => rej(q.error);
    };
    r.onerror = () => rej(r.error);
  });
}

describe('IdbStorage', () => {
  it('moves a v1 database (solves inside the blob) into the solves store', async () => {
    await seedV1([solve('a', 9000, 1000), solve('b', 8000, 2000)]);
    const data = await new IdbStorage().load();
    expect(data!.solves.map(s => s.id)).toEqual(['a', 'b']);
    expect(data!.settings.theme).toBe('midnight');
    // the records really moved out of the blob, not just been read once
    expect((await rawSolves()).map(s => s.id).sort()).toEqual(['a', 'b']);
  });

  it('writes a changed solve, a new solve and a delete without touching the rest', async () => {
    await seedV1([]);
    const storage = new IdbStorage();
    const data = (await storage.load()) ?? defaultData();

    data.solves = [solve('a', 9000, 1000)];
    await storage.save(data);
    data.solves[0].pen = '+2';
    await storage.save(data);
    data.solves.push(solve('b', 8000, 2000));
    await storage.save(data);

    const back = await new IdbStorage().load();
    expect(back!.solves.map(s => `${s.id}:${s.pen}`)).toEqual(['a:+2', 'b:']);

    back!.solves = back!.solves.filter(s => s.id !== 'a');
    await new IdbStorage().save(back!);
    expect((await new IdbStorage().load())!.solves.map(s => s.id)).toEqual(['b']);
  });

  it('returns solves oldest first, whatever order the store hands them back', async () => {
    await seedV1([]);
    const storage = new IdbStorage();
    const data = (await storage.load()) ?? defaultData();
    // ids chosen so that key order (a-late < z-early) is the OPPOSITE of time order: without the
    // sort on load this test fails, which the previous "early"/"late" ids could not do
    data.solves = [solve('a-late', 9000, 5000), solve('z-early', 8000, 1000)];
    await storage.save(data);
    expect((await new IdbStorage().load())!.solves.map(s => s.id)).toEqual(['z-early', 'a-late']);
  });

  it('keeps settings and cards across a save and a reload', async () => {
    await seedV1([]);
    const storage = new IdbStorage();
    const data = (await storage.load()) ?? defaultData();
    data.settings.retention = 0.85;
    data.settings.introSeen = true;
    await storage.save(data);
    const back = await new IdbStorage().load();
    expect(back!.settings.retention).toBe(0.85);
    expect(back!.settings.introSeen).toBe(true);
  });

  // v2 kept the cards inside kv['app']; they have to move into their own store once, or a v3 build
  // would read a history of cards back as an empty one
  it('moves a v2 database (cards inside the blob) into the cards store', async () => {
    await seedV2({ 'PLL-Aa': { seen: true, due: 42, attempts: [{ ts: 1, total: 9000, recog: 4000, grade: 2 }] } });
    const back = await new IdbStorage().load();
    expect(back!.cards['PLL-Aa']).toMatchObject({ seen: true, due: 42 });
    expect((back!.cards['PLL-Aa'] as { id?: string }).id).toBeUndefined();   // the key is not left inside the record
    const meta = await rawMeta();
    expect('cards' in meta).toBe(false);                  // and it is gone from the blob
  });

  it('writes only the cards it is told changed, and deletes the ones that are gone', async () => {
    await seedV1([]);
    const storage = new IdbStorage();
    const data = (await storage.load()) ?? defaultData();
    data.cards = { A: { seen: true, due: 1, attempts: [] }, B: { seen: true, due: 2, attempts: [] } };
    await storage.save(data);                              // no hint: everything

    data.cards.A.due = 99;                                 // A changes, B does not
    await storage.save(data, ['A']);
    let back = await new IdbStorage().load();
    expect(back!.cards.A.due).toBe(99);
    expect(back!.cards.B.due).toBe(2);

    delete data.cards.B;                                   // and a removed card must not come back
    await storage.save(data, []);
    back = await new IdbStorage().load();
    expect(Object.keys(back!.cards)).toEqual(['A']);
  });
});

/** the v2 shape: solves in their own store, everything else (cards included) in kv['app'] */
async function seedV2(cards: Record<string, unknown>): Promise<void> {
  await new Promise<void>((res) => { const d = indexedDB.deleteDatabase('cube-trainer'); d.onsuccess = () => res(); d.onerror = () => res(); d.onblocked = () => res(); });
  await new Promise<void>((res, rej) => {
    const r = indexedDB.open('cube-trainer', 2);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('kv');
      r.result.createObjectStore('solves', { keyPath: 'id' });
    };
    r.onsuccess = () => {
      const db = r.result;
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put({ ...defaultData(), cards }, 'app');
      tx.oncomplete = () => { db.close(); res(); };
      tx.onerror = () => rej(tx.error);
    };
    r.onerror = () => rej(r.error);
  });
}

function rawMeta(): Promise<Record<string, unknown>> {
  return new Promise((res, rej) => {
    const r = indexedDB.open('cube-trainer');
    r.onsuccess = () => {
      const db = r.result;
      const q = db.transaction('kv').objectStore('kv').get('app');
      q.onsuccess = () => { res(q.result as Record<string, unknown>); db.close(); };
      q.onerror = () => rej(q.error);
    };
    r.onerror = () => rej(r.error);
  });
}
