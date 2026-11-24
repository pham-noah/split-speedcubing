import type { Release } from '../core/update';

export type InstallOutcome =
  | { kind: 'installing' }
  /** the file is on the phone; Android wants the one-time "install unknown apps" toggle first */
  | { kind: 'needs-permission' }
  | { kind: 'failed'; why: string };

export interface Caps {
  backButton: boolean;
  saveFile: boolean;
  fileDialogs: boolean;
  openLinks: boolean;
  /** the shell can reach the release feed: desktop, and the GitHub build of the Android app, which is
   *  the only Android build that declares the INTERNET permission */
  updateCheck: boolean;
  /** the shell owns a real window, so "fullscreen" means something */
  fullscreen: boolean;
  /** the shell can download a release APK and hand it to the system installer: Android only, and only in the
   *  build that can reach the feed in the first place */
  installApk: boolean;
}

export interface Platform {
  kind: 'web' | 'android' | 'desktop';
  caps: Caps;
  shell(): void;
  saveFile(name: string, text: string, mime?: string): Promise<void>;
  pickFile(accept: string): Promise<{ name: string; text: string } | null>;
  /** Send a link out of the app: the system browser on desktop and Android, a tab on the web. Rejects
   *  when the shell refuses it, which the caller shows rather than swallowing. */
  openLink(url: string): Promise<void>;
  /** Download a release APK and open the system installer. Absent where there is no installer to open. */
  installUpdate?: (release: Release, onProgress?: (fraction: number) => void) => Promise<InstallOutcome>;
  /** Fullscreen is a window, not a document: only the desktop shell has one. Returns the new state. */
  toggleFullscreen(): Promise<boolean>;
}
