import { type AppData } from './model';
import type { Solve } from '../core/stats';

// The only thing the app knows about persistence. Swap the implementation per platform
// (IndexedDB in browser/Android/desktop webviews, SQLite later if solve history gets huge).
export interface Storage {
  load(): Promise<AppData | null>;
  save(data: AppData): Promise<void>;
}

export class MemoryStorage implements Storage {
  private blob: string | null = null;
  async load() { return this.blob ? (JSON.parse(this.blob) as AppData) : null; }
  async save(d: AppData) { this.blob = JSON.stringify(d); }
}

// the database keeps its original name on purpose, so data saved by earlier test builds is not orphaned
const DB = 'cube-trainer', META = 'kv', SOLVES = 'solves', KEY = 'app';

type Meta = Omit<AppData, 'solves'>;

/** One cheap line per solve: enough to spot what changed without rewriting the whole history. */
const sig = (s: Solve) => `${s.ms}|${s.pen}|${s.ts}|${s.event}|${s.session ?? ''}|${s.scramble}`;
/** Solves are stored by id, so their order has to come back from their times, not from the store. */
const byTime = (a: Solve, b: Solve) => a.ts - b.ts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function run(db: IDBDatabase, stores: string[], body: (t: IDBTransaction) => void): Promise<void> {
  return new Promise((res, rej) => {
    const tx = db.transaction(stores, 'readwrite');
    try { body(tx); } catch (e) { rej(e); return; }
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error ?? new Error('The write was aborted'));
  });
}
function one<T>(db: IDBDatabase, store: string, key: string): Promise<T | null> {
  return new Promise((res, rej) => {
    const q = db.transaction(store).objectStore(store).get(key);
    q.onsuccess = () => res((q.result as T) ?? null);
    q.onerror = () => rej(q.error);
  });
}
function all<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((res, rej) => {
    const q = db.transaction(store).objectStore(store).getAll();
    q.onsuccess = () => res(q.result as T[]);
    q.onerror = () => rej(q.error);
  });
}
function keys(db: IDBDatabase, store: string): Promise<string[]> {
  return new Promise((res, rej) => {
    const q = db.transaction(store).objectStore(store).getAllKeys();
    q.onsuccess = () => res(q.result.map(String));
    q.onerror = () => rej(q.error);
  });
}

export class IdbStorage implements Storage {
  // one connection for the life of the app, not one per read and write
  private db: Promise<IDBDatabase> | null = null;
  private migrated = false;
  /** id -> signature of what is already on disk, so a save only writes the solves that changed */
  private written = new Map<string, string>();
  /** false until this instance has seen the store: a write before a read has to reconcile from scratch */
  private known = false;

  private open(): Promise<IDBDatabase> {
    if (!this.db) {
      this.db = new Promise<IDBDatabase>((res, rej) => {
        // v2 keeps the solves in their own store: a new solve writes one record, not the whole history
        const r = indexedDB.open(DB, 2);
        r.onupgradeneeded = () => {
          const db = r.result;
          if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
          if (!db.objectStoreNames.contains(SOLVES)) db.createObjectStore(SOLVES, { keyPath: 'id' });
        };
        r.onsuccess = () => {
          const db = r.result;
          // another tab wants a newer schema: close ours so it is not blocked, and reopen on demand
          db.onversionchange = () => { db.close(); this.db = null; };
          res(db);
        };
        r.onerror = () => rej(r.error);
      }).catch(err => { this.db = null; throw err; });
    }
    return this.db;
  }

  /** v1 kept the solves inside the single kv blob; move them out once, on the first read */
  private async migrate(db: IDBDatabase): Promise<void> {
    const legacy = await one<AppData>(db, META, KEY);
    if (!legacy || !Array.isArray(legacy.solves)) return;
    const { solves, ...meta } = legacy;
    await run(db, [META, SOLVES], t => {
      t.objectStore(META).put(meta, KEY);
      const store = t.objectStore(SOLVES);
      for (const s of solves) store.put(s);
    });
  }

  private async ready(): Promise<IDBDatabase> {
    const db = await this.open();
    // only mark it done once it really is: a migration that failed must be retried next time
    if (!this.migrated) { await this.migrate(db); this.migrated = true; }
    return db;
  }

  async load() {
    const db = await this.ready();
    const [meta, solves] = await Promise.all([one<Meta>(db, META, KEY), all<Solve>(db, SOLVES)]);
    if (!meta && !solves.length) return null;
    const ordered = [...solves].sort(byTime);
    // remember what is on disk, so the first save after a load writes only what really changed
    this.written = new Map(ordered.map(s => [s.id, sig(s)]));
    this.known = true;
    return { ...(meta ?? ({} as Meta)), solves: ordered } as AppData;
  }

  async save(d: AppData) {
    const db = await this.ready();
    const { solves, ...meta } = d;
    const next = new Map<string, string>();
    const put: Solve[] = [];
    for (const s of solves) {
      const k = sig(s);
      next.set(s.id, k);
      if (this.written.get(s.id) !== k) put.push(s);
    }
    // deleting needs to know what is stored: from the last read, or from the store itself the first time
    const stored = this.known ? [...this.written.keys()] : await keys(db, SOLVES);
    const gone = stored.filter(id => !next.has(id));
    await run(db, [META, SOLVES], t => {
      // settings, cards, sessions and the rest are small; only the solve history is written as a delta
      t.objectStore(META).put(meta, KEY);
      const store = t.objectStore(SOLVES);
      for (const s of put) store.put(s);
      for (const id of gone) store.delete(id);
    });
    this.written = next;
    this.known = true;
  }
}

export function createStorage(): Storage {
  return typeof indexedDB !== 'undefined' ? new IdbStorage() : new MemoryStorage();
}
