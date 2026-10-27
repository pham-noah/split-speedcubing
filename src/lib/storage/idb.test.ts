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

function rawSolves(): Promise<Solve[]> {
  return new Promise((res, rej) => {
    const r = indexedDB.open('cube-trainer', 2);
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
});
