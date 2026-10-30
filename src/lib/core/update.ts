/** Self-update check against GitHub releases: opt-in, and it identifies itself as Split and its version,
 *  with no device id. A check is one request; nothing is downloaded without the user asking. */
export const REPO = 'pham-noah/split';

export interface Release {
  version: string;
  /** the asset that fits this shell: .apk on Android, the desktop installer elsewhere */
  url: string;
  size: number;
  notes: string;
  page: string;
  name: string;
}

/** "No update", "nothing to check against" and "could not ask" are different answers. */
export type Check =
  | { kind: 'found'; release: Release }
  | { kind: 'current' }
  | { kind: 'unavailable' }
  | { kind: 'failed' };

interface Asset {
  name: string;
  url: string;
  size: number;
}

const semver = (text: string): number[] | null => {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(text);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

export function isNewer(candidate: string, current: string): boolean {
  const a = semver(candidate);
  const b = semver(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

/** The Android APK, the Windows installer, or whatever the release actually carries. */
export function pickAsset(assets: Asset[], kind: 'web' | 'android' | 'desktop'): Asset | null {
  const withExt = (ext: string) => assets.filter(a => a.name.toLowerCase().endsWith(ext) && a.url);
  if (kind === 'android') {
    const apks = withExt('.apk');
    return apks.find(a => /arm64/i.test(a.name)) ?? apks[0] ?? null;
  }
  if (kind === 'desktop') {
    const exe = withExt('.exe').find(a => /setup/i.test(a.name)) ?? withExt('.exe')[0];
    return exe ?? withExt('.msi')[0] ?? null;
  }
  return null;
}

export function releaseFrom(json: unknown, currentVersion: string, kind: 'web' | 'android' | 'desktop'): Check {
  if (!json || typeof json !== 'object') return { kind: 'failed' };
  const o = json as Record<string, unknown>;
  const version = String(o.tag_name ?? '').replace(/^v/, '').trim();
  if (!version) return { kind: 'failed' };
  if (!isNewer(version, currentVersion)) return { kind: 'current' };
  const assets = Array.isArray(o.assets)
    ? o.assets
        .map(a => a as Record<string, unknown>)
        .map(a => ({ name: String(a.name ?? ''), url: String(a.browser_download_url ?? ''), size: Number(a.size ?? 0) }))
    : [];
  const asset = pickAsset(assets, kind);
  if (!asset) return { kind: 'current' };
  return {
    kind: 'found',
    release: {
      version,
      url: asset.url,
      size: asset.size,
      name: asset.name,
      notes: String(o.body ?? ''),
      page: String(o.html_url ?? ''),
    },
  };
}

export async function look(currentVersion: string, kind: 'web' | 'android' | 'desktop', timeoutMs = 8000): Promise<Check> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: ac.signal,
      // the app and its version, deliberately: no device or install id
      cache: 'no-store',
    });
    // 404 means GitHub will not show the repo or its releases to an anonymous request, which is what a
    // private repository looks like from a phone. That is a setup problem, not a network problem.
    if (r.status === 404 || r.status === 403) return { kind: 'unavailable' };
    if (!r.ok) return { kind: 'failed' };
    return releaseFrom(await r.json(), currentVersion, kind);
  } catch {
    return { kind: 'failed' };
  } finally {
    clearTimeout(timer);
  }
}
