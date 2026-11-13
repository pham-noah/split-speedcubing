import { type AppData, type CardRecord } from './model';
import type { Solve } from '../core/stats';

// The only thing the app knows about persistence. Swap the implementation per platform
// (IndexedDB in browser/Android/desktop webviews, SQLite later if solve history gets huge).
export interface Storage {
  load(): Promise<AppData | null>;
  /** `changedCards` names the cards the app touched since the last save. Leaving it out writes every
   *  card, which is what a restore or a wipe needs; a solve or one graded case should not rewrite the
   *  other 471. */
  save(data: AppData, changedCards?: Iterable<string>): Promise<void>;
}

export class MemoryStorage implements Storage {
  private blob: string | null = null;
  async load() { return this.blob ? (JSON.parse(this.blob) as AppData) : null; }
  async save(d: AppData) { this.blob = JSON.stringify(d); }
}

// the database keeps its original name on purpose, so data saved by earlier test builds is not orphaned
const DB = 'cube-trainer', META = 'kv', SOLVES = 'solves', CARDS = 'cards', KEY = 'app';

/** Everything that is not a per-solve or per-case record: settings, sessions, the drill log. */
type Meta = Omit<AppData, 'solves' | 'cards'>;
/** A card on disk carries its id as the key, which the in-memory record does not. */
type StoredCard = CardRecord & { id: string };

/** One cheap line per solve: enough to spot what changed without rewriting the whole history. */
const sig = (s: Solve) =>
  `${s.ms}|${s.pen}|${s.ts}|${s.event}|${s.session ?? ''}|${s.scramble}|${s.splits?.join(',') ?? ''}`;
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
  /** the cards already on disk, so a save deletes the ones that are gone without a read */
  private writtenCards = new Set<string>();
  private knownCards = false;

  private open(): Promise<IDBDatabase> {
    if (!this.db) {
      this.db = new Promise<IDBDatabase>((res, rej) => {
        // v2 keeps the solves in their own store: a new solve writes one record, not the whole history.
        // v3 does the same for cards, which are the other thing that grows: 472 cases with 60 attempts
        // each was 2 MB rewritten on every solve.
        const r = indexedDB.open(DB, 3);
        r.onupgradeneeded = () => {
          const db = r.result;
          if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
          if (!db.objectStoreNames.contains(SOLVES)) db.createObjectStore(SOLVES, { keyPath: 'id' });
          if (!db.objectStoreNames.contains(CARDS)) db.createObjectStore(CARDS, { keyPath: 'id' });
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

  /** v1 kept the solves in the single kv blob and v2 kept the cards there; move both out once, on the
   *  first read. A save that has already been split has neither field left, so this runs once. */
  private async migrate(db: IDBDatabase): Promise<void> {
    const legacy = await one<Partial<AppData>>(db, META, KEY);
    if (!legacy) return;
    const { solves, cards, ...meta } = legacy;
    const hadSolves = Array.isArray(solves) && solves.length > 0;
    const hadCards = !!cards && typeof cards === 'object' && !Array.isArray(cards);
    if (!hadSolves && !hadCards) return;
    await run(db, [META, SOLVES, CARDS], t => {
      t.objectStore(META).put(meta, KEY);
      if (hadSolves) { const store = t.objectStore(SOLVES); for (const s of solves) store.put(s); }
      if (hadCards) {
        const store = t.objectStore(CARDS);
        for (const [id, card] of Object.entries(cards as Record<string, CardRecord>)) store.put({ ...card, id });
      }
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
    const [meta, solves, stored] = await Promise.all([
      one<Meta>(db, META, KEY),
      all<Solve>(db, SOLVES),
      all<StoredCard>(db, CARDS),
    ]);
    if (!meta && !solves.length && !stored.length) return null;
    const ordered = [...solves].sort(byTime);
    const cards: Record<string, CardRecord> = {};
    for (const { id, ...card } of stored) cards[id] = card;
    // remember what is on disk, so the first save after a load writes only what really changed
    this.written = new Map(ordered.map(s => [s.id, sig(s)]));
    this.writtenCards = new Set(Object.keys(cards));
    this.known = true;
    this.knownCards = true;
    return { ...(meta ?? ({} as Meta)), solves: ordered, cards } as AppData;
  }

  async save(d: AppData, changedCards?: Iterable<string>) {
    const db = await this.ready();
    const { solves, cards, ...meta } = d;
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
    const cardIds = Object.keys(cards);
    // only the cards the app touched, unless the caller says nothing and means "all of them"
    const cardsPut = changedCards ? [...changedCards].filter(id => id in cards) : cardIds;
    const storedCards = this.knownCards ? [...this.writtenCards] : await keys(db, CARDS);
    const cardsGone = storedCards.filter(id => !(id in cards));
    await run(db, [META, SOLVES, CARDS], t => {
      // settings, sessions and the drill log are small; solves and cards are written as a delta
      t.objectStore(META).put(meta, KEY);
      const store = t.objectStore(SOLVES);
      for (const s of put) store.put(s);
      for (const id of gone) store.delete(id);
      const cardsStore = t.objectStore(CARDS);
      for (const id of cardsPut) cardsStore.put({ ...cards[id], id });
      for (const id of cardsGone) cardsStore.delete(id);
    });
    this.written = next;
    this.writtenCards = new Set(cardIds);
    this.known = true;
    this.knownCards = true;
  }
}

export function createStorage(): Storage {
  return typeof indexedDB !== 'undefined' ? new IdbStorage() : new MemoryStorage();
}
