import type { Platform } from './types';
import { markShell, pickFileViaInput, saveFileViaAnchor } from './dom';

const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const forceSW = import.meta.env.VITE_SW === '1';

export const platform: Platform = {
  kind: 'web',
  caps: { backButton: false, saveFile: true, fileDialogs: false, openLinks: true, updateCheck: false },
  shell() {
    markShell('web');
    if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
    // a local build must never hide behind a cached copy; VITE_SW=1 opts in so offline is testable
    if ((!local || forceSW) && !import.meta.env.DEV) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    } else if (local) {
      // drop a worker left over from an earlier build
      navigator.serviceWorker
        .getRegistrations()
        .then((rs) => rs.forEach((r) => r.unregister()))
        .catch(() => {});
    }
  },
  saveFile: saveFileViaAnchor,
  pickFile: pickFileViaInput,
};
