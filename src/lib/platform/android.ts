import { Capacitor } from '@capacitor/core';
import type { Platform } from './types';
import { markShell, pickFileViaInput, saveFileViaAnchor } from './dom';
import { nav } from '../nav.svelte';

export const platform: Platform = {
  kind: 'android',
  caps: { backButton: true, saveFile: true, fileDialogs: false },
  shell() {
    markShell('android');
    // the same build also opens in a browser while developing
    if (!Capacitor.isNativePlatform()) return;
    import('@capacitor/app').then(({ App }) => {
      App.addListener('backButton', () => { if (!nav.back()) App.exitApp(); });
    });
  },
  saveFile: saveFileViaAnchor,
  pickFile: pickFileViaInput,
};
