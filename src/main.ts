import { mount } from 'svelte';
import { Capacitor } from '@capacitor/core';
import './app.css';
import App from './App.svelte';
import { nav } from './lib/nav.svelte';

mount(App, { target: document.getElementById('app')! });

const native = Capacitor.isNativePlatform();
const tauri = '__TAURI_INTERNALS__' in window;

// Android: the hardware/gesture Back button closes the top-most screen first and only exits from the first screen.
if (native) {
  import('@capacitor/app').then(({ App: CapApp }) => {
    CapApp.addListener('backButton', () => { if (!nav.back()) CapApp.exitApp(); });
  });
}

// Browser install: cache everything so the web version also works offline (not used inside the Android/desktop shells).
// a local build must never hide behind a cached copy, so no service worker on localhost/127.0.0.1
// (VITE_SW=1 opts in, so the offline path can be tested end to end against a local preview)
const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const forceSW = import.meta.env.VITE_SW === '1';
if (!native && !tauri && (!local || forceSW) && 'serviceWorker' in navigator && location.protocol.startsWith('http') && !import.meta.env.DEV) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
} else if (local && 'serviceWorker' in navigator) {
  // drop a worker left over from an earlier build
  navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
}
