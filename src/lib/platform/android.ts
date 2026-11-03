import { Capacitor } from '@capacitor/core';
import type { Platform } from './types';
import { markShell, pickFileViaInput, saveFileViaAnchor } from './dom';
import { nav } from '../nav.svelte';

export const platform: Platform = {
  kind: 'android',
  // updateCheck is off: the manifest declares no INTERNET permission, so a fetch to api.github.com
  // fails and every check would report a network fault the user cannot fix
  caps: { backButton: true, saveFile: true, fileDialogs: false, openLinks: true, updateCheck: false },
  shell() {
    markShell('android');
    // the same build also opens in a browser while developing
    if (!Capacitor.isNativePlatform()) return;
    import('@capacitor/app').then(({ App }) => {
      App.addListener('backButton', () => {
        if (!nav.back()) App.exitApp();
      });
    });
  },
  saveFile: saveFileViaAnchor,
  pickFile: pickFileViaInput,
};
