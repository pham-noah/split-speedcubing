import { openUrl } from '@tauri-apps/plugin-opener';
import type { Platform } from './types';
import { markShell, pickFileViaInput, saveFileViaAnchor } from './dom';

export const platform: Platform = {
  kind: 'desktop',
  caps: { backButton: false, saveFile: true, fileDialogs: false, openLinks: true, updateCheck: true },
  shell() {
    markShell('desktop');
    // a webview has nowhere to navigate to: hand every external link to the system browser instead
    document.addEventListener(
      'click',
      (e) => {
        const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
        if (!a || !/^https?:/i.test(a.href)) return;
        e.preventDefault();
        e.stopPropagation();
        void openUrl(a.href).catch(() => {});
      },
      true,
    );
  },
  saveFile: saveFileViaAnchor,
  pickFile: pickFileViaInput,
};
