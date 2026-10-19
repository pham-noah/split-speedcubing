# Split

![Split trainer on desktop](docs/desktop-trainer.png)

Local-first speedcubing trainer: a normal solve timer plus a trainer for **PLL (21 cases)** and **OLL (57 cases)** with
recognition/execution timing, case-specific scrambles, spaced repetition, and generated case diagrams.
No accounts, no network: all data stays on the device.

One codebase (Svelte 5 + TypeScript + Vite) for three targets: browser/PWA, Android (Capacitor) and desktop (Tauri).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 214 tests: simulator, every PLL/OLL/F2L alg, stats, FSRS (+ personalisation), storage, sessions, importers, shortcuts, back handling, contrast, and a full-app UI test with an axe accessibility audit
npm run e2e        # 27 checks in a real Chrome against a running build (see Testing)
npm run check      # type-check
npm run build      # production build into dist/
```

## Android (Capacitor)

Needs Android Studio (SDK + JDK 17+).

```bash
npm run android:sync   # build web app and copy it into android/
npm run android:open   # opens Android Studio; press Run on a device/emulator
```

- Change `appId` in `capacitor.config.ts` (and the package in `android/`) before publishing.
- The `INTERNET` permission has been removed from `android/app/src/main/AndroidManifest.xml` so the app is provably offline.
  If a feature ever needs the network, add it back deliberately.
- For F-Droid/Play: release build via Android Studio (Build > Generate Signed Bundle / APK).

## Desktop (Tauri 2)

Needs Rust (https://rustup.rs) and the platform prerequisites from https://tauri.app/start/prerequisites/.

```bash
npm run desktop:dev     # dev window with hot reload
npm run desktop:build   # installers in src-tauri/target/release/bundle/
```

Change `identifier` in `src-tauri/tauri.conf.json`. The logo (a glowing rounded cube whose inner edges are clock hands), the app icons and the splash screen are drawn by `scripts/make-icons.py`; `npm run icons` regenerates the web, desktop and Android icons (or replace `assets/icon-*.png` with your own artwork first).

## Project layout

```
src/lib/core/      cube.ts (3x3 simulator), alg.ts, stats.ts, srs.ts, scramble.ts   (pure, tested)
src/lib/data/      pll.ts, oll.ts                                                  (alg data)
src/lib/storage/   Storage interface + IndexedDB / memory implementations, backup model
src/lib/ui/        TimerPad, CaseDiagram
src/views/         Solve, Train, Library, Drills (stub), Settings
```

## How the pieces work

- **Case diagrams** are not hand-drawn data: the simulator applies the inverse of the case's algorithm to a solved cube and draws the top layer. A diagram therefore always matches its algorithm, including algorithms you change.
- **Case scrambles** are the inverse of the algorithm with a random AUF in front, so you meet each case from different angles.
- **Scrambles for the Solve timer** use cubing.js random-state scrambles (loaded on demand), falling back to random-move scrambles if it cannot load.
- **Scheduling** uses FSRS (via the open-source `ts-fsrs` library) in `srs.ts`: each case has a stability and difficulty, reviews are scheduled for a target recall you choose in Settings (80-95%, default 90%), and the Library shows the estimated recall for a case. Cards from the earlier box-based version are migrated on their next review. Parameters can be personalised from your own history (see `src/lib/core/fsrs-optimize.ts`: log-loss search pulled towards the defaults and validated on held-out cases).
- **Storage** is behind one interface (`src/lib/storage/index.ts`).

## Testing

- `npm test`: 214 unit and component tests (including an axe-core accessibility audit and WCAG contrast checks).
- `npm run e2e`: 27 end-to-end checks in a **real Chrome/Chromium**: first launch, timing with real pointer input, persistence across reloads (IndexedDB), keyboard shortcuts, the training flow, csTimer import, no sideways overflow at Extra large text on a 360 px phone, offline mode (service worker, scrambles still work), and no console errors. Start a build first (`npm run build && npm run preview`) and set `CHROME_PATH` if Chrome is not in a standard location. The checks run in CI (`.github/workflows/ci.yml`).
- `npm run screenshots`: regenerates the store screenshots, desktop image and feature graphic from the running build with demo data (`scripts/seed-demo.ts`).
- Desktop security: `src-tauri/tauri.conf.json` sets a strict content security policy (no network). It was checked against the real app in Chromium (random-state scrambles, workers and diagrams all work under it).

## Release and store files

- `PRIVACY.md`: privacy policy (add your contact line). `CHANGELOG.md`: release notes.
- `fastlane/metadata/android/en-US/`: title, descriptions, changelog, icon, feature graphic and phone screenshots (used by F-Droid and Play).
- `docs/store/play-listing.md`: Google Play listing and Data safety answers. `docs/fdroid/*.yml`: F-Droid submission template (untested against F-Droid's build server). `docs/RELEASING.md`: step-by-step release checklist, including signing keys.
- `.github/workflows/`: CI (checks, build, e2e, debug APK) and release (desktop installers and Android APK on version tags). These have not been run on GitHub yet.
- Android: no permissions, and cloud auto-backup is disabled so data really stays on the device.

## Features

- **Solve:** timer with hold-to-start (touch or keyboard), optional 15 s inspection (beeps at 8 s and 12 s, +2 after 15 s, DNF after 17 s), +2 / DNF / delete, best / ao5 / ao12, cubing.js scrambles.
- **Sessions:** tap the session name on the Solve screen to create, switch, rename or delete sessions. Each keeps its own solves, history and averages; training progress is shared.
- **History:** every solve with its scramble, penalty editing, delete, best single / ao5 / ao12, and a progress chart.
- **Train:** opens on a **Today** screen (cases due, new cases, this week's recognition and execution averages, quick drills, "weak spots" = your 10 slowest cases). Then PLL, OLL, F2L (41 cases x 4 slots) and ZBLL (your own imported list) with case-specific scrambles, recognition vs execution timing, 1-4 grading, and FSRS spaced repetition. On wide screens a side panel shows the algorithm, recent attempts and shortcuts.
- **Library:** PLL / OLL / F2L (slot filter) / ZBLL tabs, mastery grid; PLL cases are drawn as movement arrows, F2L as 3D cubes with only the pair in colour; several algorithms per case, pick your default, add your own (checked by the simulator to really solve that case), per-algorithm stats, estimated recall, case codes (press F) and a Trainer view for one case inside the Library.
- **Attempts panel:** every screen has a right-hand column with the recent attempts or solves and three deltas — previous, ao5, ao12 — green when faster, red when slower. History carries the same deltas on every row.
- **Drills:** Cross only, 2-look OLL, 2-look PLL, BLD memo.
- **First launch:** a short three-step intro (replay it from Settings) and helpful empty states.
- **Android Back button:** closes the top-most thing first (open case, history, a trainer session, an inspection), then goes to the previous tab, and exits only from the first screen. Esc does the same on desktop.
- **Keyboard shortcuts, rebindable:** every action is a named command (timer, +2, DNF, delete, history, grading, skip, go to each tab, back). Rebind in Settings; conflicts are refused.
- **Hideable panels:** switch off parts of the Solve and Train screens you do not use (Settings, Screen layout).
- **Import:** csTimer exports (sessions, times, +2/DNF, scrambles, dates; other puzzles are skipped), CSV (TwistyTimer-style and generic), plain lists of times, and best-effort JSON (CubeDesk). Imported sessions are added as new sessions; running an import twice skips duplicates.
- **Settings:** themes (Midnight, AMOLED, High contrast), text size, hold time, inspection, hide time while solving, target recall, backup export/restore.
- **Personalised scheduling:** Settings > Personalise scheduling learns how fast *you* forget from your own review history (FSRS parameter fitting, on-device) and keeps the result only if it predicts held-out cases better than the standard parameters. About 100+ usable reviews are needed; it is checked against simulated learners in the tests.
- **Offline web version (PWA):** `npm run build`, then host `dist/` anywhere (or `npm run preview`) and install it from the browser; a service worker caches the app, fonts and the scramble code. The service worker is not used inside the Android and desktop apps.
- Fonts (Manrope, JetBrains Mono) are bundled, so nothing is fetched at run time.
- Wide windows (desktop) turn the bottom tab bar into a left sidebar.

## Accessibility

Automated checks, run by `npm test`: an axe-core audit of the intro, Solve, Train (Today and session), Library (including an open case), Drills and Settings screens finds no violations (colour contrast is excluded there because the simulated browser cannot compute colours); a separate test checks WCAG contrast (4.5:1 for text, 3:1 for outlines) for every theme directly from `src/app.css`. The app uses labelled landmarks, `aria-current` on the active tab, `aria-pressed` on toggle buttons, live regions for the timer state, a modal intro that traps focus and makes the page inert, visible focus rings, 44 px+ targets, reduced-motion support, and a text-size setting up to 130%.

**Still to do on a real device (cannot be tested here):** TalkBack (Android) or a desktop screen reader walk-through of the timer and trainer, and a visual pass at "Extra large" text on a small phone.

## F2L and ZBLL data

- **F2L:** `scripts/gen-f2l.ts` finds the shortest solution for each of the 41 front-right-slot cases by exhaustive search over R, U and F turns (`npx vite-node scripts/gen-f2l.ts 9`), and `scripts/write-f2l.ts` writes `src/lib/data/f2l-fr.ts`. The other three slots (front-left, back-left, back-right) are the same cases turned about the vertical axis: `src/lib/core/rotate.ts` relabels the moves, with the mapping derived from the simulator and verified for all 164 cases (cross and the other three slots untouched, the right pair disturbed). These algs are valid and short but not always the nicest to execute; swap in your own favourites in the Library (the app checks that they solve the case, allowing an AUF in front).
- **ZBLL:** no algorithms are bundled (493 cases, and I did not want to invent them). Paste your own list in Library > ZBLL, one `name: algorithm` per line. Every line is checked by the simulator (F2L solved, edges oriented). Diagrams, scrambles and spaced repetition then work for them like any other set.

## Known limits / next steps

- Algorithms are starting points. Tests prove each PLL/OLL alg is valid and that all 21 PLLs and 57 OLLs are distinct, but not that the *number* (e.g. "OLL 29") matches your preferred list. OLL 29 was swapped after the distinctness test caught a duplicate, so double check the numbering. F2L numbering is the generator's own order, not a standard list.
- Not done yet: ZBLL bundled algs. Smart cube Bluetooth support was deliberately left out to keep the app simple and fully offline.
- The csTimer import follows csTimer's documented/observed export layout and is unit-tested against it, but not against a real export file. CubeDesk's own backup format could not be verified; its importer is best effort, and CSV or a plain list of times always works.
- Tested in a real desktop browser (Chromium: 27 end-to-end checks) and by 214 unit tests, but not yet on a real phone or inside the Android and Tauri shells, and the GitHub workflows and F-Droid recipe have not been run.

## Licence

Copyright (C) 2026 *your name here*.

Split is free software: you can redistribute it and/or modify it under the terms of the **GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version** (SPDX: `GPL-3.0-or-later`). It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY. See `LICENSE` for the full text. If you prefer GPL-3.0-only, change `license` in `package.json` and this paragraph.

All bundled third-party packages use GPL-3.0-compatible licences (MIT, MPL-2.0 / GPL dual, OFL for the fonts, Unlicense); the list is in `THIRD_PARTY_LICENSES.md` (regenerate with `node scripts/third-party.mjs > THIRD_PARTY_LICENSES.md`).
