import { registerPlugin } from '@capacitor/core';
import type { InstallOutcome } from './types';
import type { Release } from '../core/update';

// Only android.ts imports this file, so the web and desktop bundles never contain Capacitor at all:
// CI asserts that dist-desktop/assets has no trace of it.

/**
 * The part of an update a web page cannot do: put the APK on the phone and open the install sheet.
 *
 * <p>Everything above this line has already happened elsewhere — the release was asked for, refused if it is not
 * newer, and its APK picked to match the device. This only carries the bytes across and hands them over. A thin
 * wrapper so the shell's plugin name appears once, in a file a test can stub.
 */
interface ApkInstallerPlugin {
  download(o: { url: string; name: string; size: number }): Promise<{ path: string; bytes: number }>;
  install(o: { path: string }): Promise<void>;
  status(): Promise<{ allowed: boolean }>;
  openSettings(): Promise<void>;
  addListener(
    event: 'progress',
    cb: (p: { received: number; total: number }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

const ApkInstaller = registerPlugin<ApkInstallerPlugin>('ApkInstaller');

/** Download the release APK and open the system installer. Resolves when the installer is on screen. */
export async function installUpdate(release: Release, onProgress?: (fraction: number) => void): Promise<InstallOutcome> {
  let handle: { remove: () => Promise<void> } | undefined;
  try {
    // ask before downloading: a 5 MB wait that ends at a permission wall is a worse first run than the wall itself
    const { allowed } = await ApkInstaller.status();
    if (onProgress) {
      handle = await ApkInstaller.addListener('progress', (p) =>
        onProgress(p.total > 0 ? Math.min(1, p.received / p.total) : 0),
      );
    }
    const { path } = await ApkInstaller.download({ url: release.url, name: release.name, size: release.size });
    if (!allowed) {
      await ApkInstaller.openSettings();
      return { kind: 'needs-permission' };
    }
    await ApkInstaller.install({ path });
    return { kind: 'installing' };
  } catch (e) {
    return { kind: 'failed', why: e instanceof Error ? e.message : String(e) };
  } finally {
    if (handle) await handle.remove().catch(() => {});
  }
}
