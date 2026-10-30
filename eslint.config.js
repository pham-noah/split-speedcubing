// Lint gate. svelte-check catches types; this catches the classes of bug that type-check
// perfectly: shadowed names (a `const nav = navigator` once hid the nav store), unkeyed each
// blocks, dead variables, bare expressions in an $effect, and `==`.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import svelteConfig from './svelte.config.js';

export default tseslint.config(
  {
    ignores: ['dist/**', 'dist-web/**', 'dist-android/**', 'dist-desktop/**', 'dist-sw/**', 'android/**', 'src-tauri/target/**', 'src-tauri/gen/**', 'coverage/**', 'node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, __APP_VERSION__: 'readonly' },
    },
  },
  {
    // shell code stays in src/lib/platform/, so the three builds cannot couple
    files: ['src/**/*.ts', 'src/**/*.svelte', 'src/**/*.svelte.ts'],
    ignores: ['src/lib/platform/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@capacitor/*'], message: 'Shell code belongs in src/lib/platform/.' },
            { group: ['@tauri-apps/*'], message: 'Shell code belongs in src/lib/platform/.' },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        // the script blocks are TypeScript
        parser: tseslint.parser,
        svelteConfig,
        extraFileExtensions: ['.svelte'],
      },
    },
  },
  {
    rules: {
      // the platform edges (wake lock, service worker, Capacitor) need feature detection
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      // a name that hides another is how `const nav = navigator` broke the Back button
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'error',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'svelte/require-each-key': 'error',
      'svelte/infinite-reactive-loop': 'error',
      'svelte/no-at-html-tags': 'error',
      // a scramble renders `{' '}` between its move spans on purpose: Svelte drops literal
      // whitespace inside an each block, and without it "R U R'" draws as "RUR'"
      'svelte/no-useless-mustaches': 'off',
      // Two style opinions that fight deliberate choices here: a Map/Set built inside a $derived is
      // a plain lookup, not a reactive container, and ScrambleWalk keeps "play" in $state so a new
      // scramble resets it without undoing the pause the user just made.
      'svelte/prefer-svelte-reactivity': 'off',
      'svelte/prefer-writable-derived': 'off',
    },
  },
  {
    // scripts are one-off node tools
    files: ['scripts/**/*.mjs', 'scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
);
