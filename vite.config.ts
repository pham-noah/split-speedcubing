import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

// base './' so the built files also load from Capacitor (Android) and Tauri (desktop)
export default defineConfig({
  base: './',
  // edits are made from WSL against files on the Windows drive, which inotify does not report:
  // without polling the dev server keeps serving the old code (looks like "nothing changed")
  server: { watch: { usePolling: true, interval: 300 } },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    rollupOptions: {
      // cubing.js runs scramble code in Web Workers. Keep it in its own chunk so those workers do not
      // import the app's entry chunk (which touches `document`, and workers have no document).
      output: { manualChunks: id => (id.includes('node_modules/cubing') ? 'cubing' : undefined) },
    },
  },
  plugins: [
    svelte(),
    // Offline web install. main.ts registers the service worker only in a normal browser.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['favicon.png'],
      manifest: {
        name: 'Split',
        short_name: 'Split',
        description: 'Offline speedcubing timer and algorithm trainer',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#0F1115',
        theme_color: '#0F1115',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,woff2,wasm,webmanifest}'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        navigateFallback: 'index.html',
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  // Svelte must resolve to its browser build when tests mount components in jsdom
  resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
  test: { include: ['src/**/*.test.ts'] },
});
