// IndexedDB is "best effort" until the browser is asked to make it durable: under storage pressure, or
// after a "clear cache", the system may throw the whole history away even though the app is installed.
// The data is never behind a stored file link - a backup is a file the user picks, read fresh each time -
// so what needs checking is whether the origin itself is allowed to keep what it has.

export type Durability = {
  /** true = the browser promised to keep it; false = it may evict; null = this shell cannot say */
  persisted: boolean | null;
  /** bytes used by this origin, when the shell reports it */
  usage: number | null;
  quota: number | null;
};

const NONE: Durability = { persisted: null, usage: null, quota: null };

export async function durability(): Promise<Durability> {
  const s = typeof navigator === 'undefined' ? null : navigator.storage;
  if (!s) return NONE;
  let persisted: boolean | null = null;
  try {
    persisted = typeof s.persisted === 'function' ? await s.persisted() : null;
    // ask once per launch: the answer is sticky, and asking is free after the first grant
    if (persisted === false && typeof s.persist === 'function') persisted = await s.persist();
  } catch {
    persisted = null;
  }
  let usage: number | null = null;
  let quota: number | null = null;
  try {
    if (typeof s.estimate === 'function') {
      const e = await s.estimate();
      usage = typeof e.usage === 'number' ? e.usage : null;
      quota = typeof e.quota === 'number' ? e.quota : null;
    }
  } catch {
    /* estimates are a nicety, not a promise */
  }
  return { persisted, usage, quota };
}

/** "12.4 MB", or "" when the shell did not say */
export function formatBytes(n: number | null): string {
  if (n == null || n < 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
