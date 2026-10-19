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
  private open(): Promise<IDBDatabase> {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
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
      tx.objectStore(STORE).put(JSON.parse(JSON.stringify(d)), KEY);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }
}

export function createStorage(): Storage {
  return typeof indexedDB !== 'undefined' ? new IdbStorage() : new MemoryStorage();
}
