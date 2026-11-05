import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import type { Platform } from './types';
import { markShell, pickFileViaInput, saveFileViaAnchor } from './dom';
import { nav } from '../nav.svelte';

export const platform: Platform = {
  kind: 'android',
  // The store build declares no INTERNET permission, so a fetch to api.github.com fails there and a
  // check would only report a network fault the user cannot fix. The GitHub build is built with
  // --mode android-github: it declares the permission, and only that build offers the check.
  caps: { backButton: true, saveFile: true, fileDialogs: false, openLinks: true, updateCheck: __GITHUB_BUILD__, fullscreen: false },
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
  // Custom Tabs: the URL is handed to the phone's browser, so a link works even in the build that has
  // no INTERNET permission of its own
  async openLink(url) {
    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  },
  async toggleFullscreen() {
    return false;
  },
  saveFile: saveFileViaAnchor,
  pickFile: pickFileViaInput,
};
