import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The install path is the one place Split touches a plugin that cannot run in a browser, so the parts worth
 * pinning down are the ones a phone would hide: the permission wall, the progress arithmetic and a failure that
 * must not leave a listener behind.
 */
const { plugin, listeners, removed } = vi.hoisted(() => {
  const seen: ((p: { received: number; total: number }) => void)[] = [];
  const off = vi.fn(async () => {});
  const fake = {
    status: vi.fn(async () => ({ allowed: true })),
    download: vi.fn(async () => ({ path: '/data/user/0/app/files/updates/Split.apk', bytes: 5_000_000 })),
    install: vi.fn(async () => {}),
    openSettings: vi.fn(async () => {}),
    addListener: vi.fn(async (_e: string, cb: (p: { received: number; total: number }) => void) => {
      seen.push(cb);
      return { remove: off };
    }),
  };
  return { plugin: fake, listeners: seen, removed: off };
});

vi.mock('@capacitor/core', () => ({ registerPlugin: () => plugin }));

import { installUpdate } from './install';

const release = {
  version: '0.9.1',
  url: 'https://example.invalid/Split.apk',
  name: 'Split.apk',
  size: 5_000_000,
  notes: '',
  page: 'https://example.invalid/releases/latest',
};

describe('installing an update', () => {
  beforeEach(() => {
    listeners.length = 0;
    vi.clearAllMocks();
    plugin.status.mockResolvedValue({ allowed: true });
    plugin.download.mockResolvedValue({ path: '/data/user/0/app/files/updates/Split.apk', bytes: 5_000_000 });
  });

  it('hands the downloaded file to the installer', async () => {
    const out = await installUpdate(release);
    expect(out).toEqual({ kind: 'installing' });
    expect(plugin.download).toHaveBeenCalledWith({ url: release.url, name: release.name, size: release.size });
    expect(plugin.install).toHaveBeenCalledWith({ path: '/data/user/0/app/files/updates/Split.apk' });
    expect(plugin.openSettings).not.toHaveBeenCalled();
  });

  it('asks for the permission instead of opening an installer that would bounce', async () => {
    plugin.status.mockResolvedValue({ allowed: false });
    const out = await installUpdate(release);
    expect(out).toEqual({ kind: 'needs-permission' });
    expect(plugin.openSettings).toHaveBeenCalled();
    expect(plugin.install).not.toHaveBeenCalled();
    // the bytes are already on the phone, so the second press does not download again
    expect(plugin.download).toHaveBeenCalled();
  });

  it('reports progress as a fraction, and a listener that knows nothing yet as zero', async () => {
    const seen: number[] = [];
    const done = installUpdate(release, (f) => seen.push(f));
    // the listener is registered before the download starts: that is the order the phone needs
    await vi.waitFor(() => expect(listeners).toHaveLength(1));
    listeners[0]({ received: 1_250_000, total: 5_000_000 });
    listeners[0]({ received: 0, total: 0 });
    await done;
    expect(seen).toEqual([0.25, 0]);
  });

  it('says why the download failed and still drops its listener', async () => {
    plugin.download.mockRejectedValue(new Error('Download was cut short: 4 of 5 bytes'));
    const out = await installUpdate(release, () => {});
    expect(out).toEqual({ kind: 'failed', why: 'Download was cut short: 4 of 5 bytes' });
    expect(plugin.install).not.toHaveBeenCalled();
    expect(removed).toHaveBeenCalled();
  });
});
