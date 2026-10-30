import { describe, expect, it, vi } from 'vitest';
import real from './fixtures/kairn-release.json';
import { isNewer, issueUrl, issuesUrl, pickAsset, releaseFrom } from './update';

const asset = (name: string) => ({ name, browser_download_url: `https://example.test/${name}`, size: 1234 });
const picked = (name: string) => ({ name, url: `https://example.test/${name}`, size: 1234 });
const release = (tag: string, names: string[]) => ({
  tag_name: tag,
  body: 'notes',
  html_url: 'https://github.com/pham-noah/split-speedcubing/releases/tag/x',
  assets: names.map(asset),
});

describe('isNewer', () => {
  it('compares the three numeric parts', () => {
    expect(isNewer('0.5.1', '0.5.0')).toBe(true);
    expect(isNewer('0.6.0', '0.5.9')).toBe(true);
    expect(isNewer('1.0.0', '0.9.9')).toBe(true);
    expect(isNewer('0.5.0', '0.5.0')).toBe(false);
    expect(isNewer('0.4.9', '0.5.0')).toBe(false);
  });

  it('ignores a leading v and unparsable text', () => {
    expect(isNewer('v0.5.1', '0.5.0')).toBe(true);
    expect(isNewer('nightly', '0.5.0')).toBe(false);
  });
});

describe('pickAsset', () => {
  it('takes the arm64 APK on Android, else the first APK', () => {
    expect(pickAsset([picked('split-x86.apk'), picked('split-arm64.apk')], 'android')?.name).toBe('split-arm64.apk');
    expect(pickAsset([picked('split-x86.apk')], 'android')?.name).toBe('split-x86.apk');
  });

  it('takes the setup exe on desktop, falling back to msi', () => {
    expect(pickAsset([picked('Split_0.6.0_x64_en-US.msi'), picked('Split_0.6.0_x64-setup.exe')], 'desktop')?.name).toBe(
      'Split_0.6.0_x64-setup.exe',
    );
    expect(pickAsset([picked('Split_0.6.0_x64_en-US.msi')], 'desktop')?.name).toBe('Split_0.6.0_x64_en-US.msi');
  });

  it('has no installer for the web build', () => {
    expect(pickAsset([picked('split-arm64.apk')], 'web')).toBeNull();
  });
});

describe('look', () => {
  it('separates a private or missing repo from a network failure', async () => {
    const { look } = await import('./update');
    const no = (status: number) => vi.fn(async () => new Response('{}', { status }));
    vi.stubGlobal('fetch', no(404));
    await expect(look('0.5.0', 'android')).resolves.toEqual({ kind: 'unavailable' });
    vi.stubGlobal('fetch', no(500));
    await expect(look('0.5.0', 'android')).resolves.toEqual({ kind: 'failed' });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    await expect(look('0.5.0', 'android')).resolves.toEqual({ kind: 'failed' });
    vi.unstubAllGlobals();
  });
});

describe('a real GitHub response', () => {
  it('finds the APK and its download URL', () => {
    const c = releaseFrom(real, '0.5.0', 'android');
    expect(c.kind).toBe('found');
    if (c.kind === 'found') {
      expect(c.release.version).toBe('0.8.1');
      expect(c.release.name).toBe('Kairn-release.apk');
      expect(c.release.url).toMatch(/^https:\/\/github\.com\/.+\/releases\/download\/v0\.8\.1\/Kairn-release\.apk$/);
      expect(c.release.size).toBe(5194116);
      expect(c.release.page).toContain('/releases/tag/v0.8.1');
      expect(c.release.notes).toContain('Continue reading');
    }
  });

  it('is current once the version is reached', () => {
    expect(releaseFrom(real, '0.8.1', 'android').kind).toBe('current');
  });
});

describe('releaseFrom', () => {
  it('reports a newer release with the asset that fits the shell', () => {
    const c = releaseFrom(release('v0.6.0', ['split-arm64.apk', 'Split_0.6.0_x64-setup.exe']), '0.5.0', 'android');
    expect(c.kind).toBe('found');
    if (c.kind === 'found') {
      expect(c.release.version).toBe('0.6.0');
      expect(c.release.name).toBe('split-arm64.apk');
      expect(c.release.notes).toBe('notes');
    }
  });

  it('says current when the tag is not newer', () => {
    expect(releaseFrom(release('v0.5.0', ['split-arm64.apk']), '0.5.0', 'android').kind).toBe('current');
  });

  it('says current when the release carries nothing this shell can install', () => {
    expect(releaseFrom(release('v0.6.0', ['notes.txt']), '0.5.0', 'desktop').kind).toBe('current');
  });

  it('says failed on a body that is not a release', () => {
    expect(releaseFrom(null, '0.5.0', 'web').kind).toBe('failed');
    expect(releaseFrom({ message: 'Not Found' }, '0.5.0', 'web').kind).toBe('failed');
  });
});

describe('issueUrl', () => {
  it('prefills the version and shell, and asks the two questions that matter', () => {
    const url = new URL(issueUrl('0.5.0', 'android', 'Settings'));
    expect(url.origin + url.pathname).toBe('https://github.com/pham-noah/split-speedcubing/issues/new');
    expect(url.searchParams.get('title')).toBe('[0.5.0/android] ');
    const body = url.searchParams.get('body')!;
    expect(body).toContain('**What happened**');
    expect(body).toContain('**What you expected**');
    expect(body).toContain('Split 0.5.0 · android · Settings');
  });

  it('leaves the screen out when there is none', () => {
    const body = new URL(issueUrl('0.5.0', 'web')).searchParams.get('body')!;
    expect(body.trim().endsWith('Split 0.5.0 · web')).toBe(true);
  });

  it('points at the issue list', () => {
    expect(issuesUrl).toBe('https://github.com/pham-noah/split-speedcubing/issues');
  });
});

// the real endpoint, only when asked: LIVE=1 npx vitest run src/lib/core/update.test.ts
describe.skipIf(!process.env.LIVE)('the live release channel', () => {
  it('answers for this version without authentication', async () => {
    const { look } = await import('./update');
    const c = await look('0.5.0', 'android');
    expect(c.kind).not.toBe('unavailable');
    expect(['current', 'found']).toContain(c.kind);
  }, 15000);
});
