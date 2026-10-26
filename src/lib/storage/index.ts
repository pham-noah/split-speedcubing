import { type AppData } from './model';

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
const DB = 'cube-trainer', STORE = 'kv', KEY = 'app';
export class IdbStorage implements Storage {
  // one connection for the life of the app: opening (and leaking) a new one per read and per write
  // used to mean a dozen live connections after a few minutes of use
  private db: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (!this.db) {
      this.db = new Promise<IDBDatabase>((res, rej) => {
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(STORE);
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

  async load() {
    const db = await this.open();
    return new Promise<AppData | null>((res, rej) => {
      const q = db.transaction(STORE).objectStore(STORE).get(KEY);
      q.onsuccess = () => res((q.result as AppData) ?? null);
      q.onerror = () => rej(q.error);
    });
  }

  async save(d: AppData) {
    const db = await this.open();
    return new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      // IndexedDB clones the value itself; the caller already passes a $state.snapshot
      tx.objectStore(STORE).put(d, KEY);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error ?? new Error('The write was aborted'));
    });
  }
}

export function createStorage(): Storage {
  return typeof indexedDB !== 'undefined' ? new IdbStorage() : new MemoryStorage();
}
