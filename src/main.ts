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
if (!native && !tauri && 'serviceWorker' in navigator && location.protocol.startsWith('http') && !import.meta.env.DEV) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
