import { registerPlugin } from '@capacitor/core';
import type { Release } from '../core/update';

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

export type Outcome =
  | { kind: 'installing' }
  /** the file is on the phone; Android wants the one-time "install unknown apps" toggle first */
  | { kind: 'needs-permission' }
  | { kind: 'failed'; why: string };

/** Download the release APK and open the system installer. Resolves when the installer is on screen. */
export async function installUpdate(release: Release, onProgress?: (fraction: number) => void): Promise<Outcome> {
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
