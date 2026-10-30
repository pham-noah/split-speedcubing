import type { Platform } from './types';
import { markShell, pickFileViaInput, saveFileViaAnchor } from './dom';

export const platform: Platform = {
  kind: 'desktop',
  caps: { backButton: false, saveFile: true, fileDialogs: false },
  shell() {
    markShell('desktop');
    // no service worker: the app's own files are already on disk
  },
  saveFile: saveFileViaAnchor,
  pickFile: pickFileViaInput,
};
