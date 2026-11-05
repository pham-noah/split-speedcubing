import { openUrl } from '@tauri-apps/plugin-opener';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { Platform } from './types';
import { markShell, pickFileViaInput, saveFileViaAnchor } from './dom';

export const platform: Platform = {
  kind: 'desktop',
  caps: { backButton: false, saveFile: true, fileDialogs: false, openLinks: true, updateCheck: true, fullscreen: true },
  shell() {
    markShell('desktop');
  },
  // A webview has nowhere to navigate to: the link goes to the system browser. This used to fail
  // silently — the capability allowed the command but scoped no URLs, so every call was rejected and
  // the catch below threw the reason away. The capability now lists https and http, and the error
  // reaches the screen.
  async openLink(url) {
    await openUrl(url);
  },
  async toggleFullscreen() {
    const win = getCurrentWindow();
    const now = await win.isFullscreen();
    await win.setFullscreen(!now);
    return !now;
  },
  saveFile: saveFileViaAnchor,
  pickFile: pickFileViaInput,
};
