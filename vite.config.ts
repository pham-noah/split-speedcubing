import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const TARGETS = ['web', 'android', 'desktop'] as const;
type Target = (typeof TARGETS)[number];
const targetOf = (mode: string): Target => ((TARGETS as readonly string[]).includes(mode) ? (mode as Target) : 'web');

export default defineConfig(({ mode }) => {
  const target = targetOf(mode);
  return {
    // base './' so the built files also load from Capacitor (Android) and Tauri (desktop)
    base: './',
    // edits are made from WSL against files on the Windows drive, which inotify does not report:
    // without polling the dev server keeps serving the old code (looks like "nothing changed")
    server: { watch: { usePolling: true, interval: 300 } },
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    resolve: {
      alias: { $platform: fileURLToPath(new URL(`./src/lib/platform/${target}.ts`, import.meta.url)) },
      ...(process.env.VITEST ? { conditions: ['browser'] } : {}),
    },
    build: {
      outDir: `dist-${target}`,
      rollupOptions: {
        // cubing.js runs scramble code in Web Workers. Keep it in its own chunk so those workers do not
        // import the app's entry chunk (which touches `document`, and workers have no document).
        output: { manualChunks: id => (id.includes('node_modules/cubing') ? 'cubing' : undefined) },
      },
    },
    plugins: [
      svelte(),
      // Offline web install only: the shells load their own files and never register a worker.
      ...(target === 'web'
        ? [
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
          ]
        : []),
    ],
    test: { include: ['src/**/*.test.ts'] },
  };
});
