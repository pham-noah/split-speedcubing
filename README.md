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
npm run e2e        # 38 end-to-end checks in a real browser against the build on :4173 (3 offline checks skip)
npm run e2e:offline  # builds the web target with the service worker into dist-sw/, serves :4174, runs all 38
npm test           # 300 tests: simulator, every PLL/OLL/F2L alg, stats, grading, FSRS (+ personalisation), storage and backups, sessions, importers, shortcuts, back handling, contrast, and a full-app UI test with an axe accessibility audit
npm run check      # type-check
npm run lint       # eslint: shadowing, dead code, unkeyed each blocks, bare $effect expressions
npm run build      # the web build into dist-web/ (the one the PWA and `npm run preview` use)
npm run version:check   # the five version numbers agree
```

## The three builds

One codebase, three shells, one output directory each. `vite --mode <target>` swaps the adapter in
`src/lib/platform/`, so no shell's dependencies reach another shell's bundle: `@capacitor/*` and
`@tauri-apps/*` are blocked by eslint outside that directory.

```bash
npm run build:web       # dist-web/      PWA + service worker
npm run build:android   # dist-android/  then copied into android/
npm run build:desktop   # dist-desktop/  what Tauri packages
```

What actually differs between shells, and where it lives:

| Capability | web | android | desktop |
|---|---|---|---|
| Back button | - | Capacitor `backButton` | - |
| Service worker | yes | no | no |
| Backup save/restore | anchor + `<input>` | anchor + `<input>` | anchor + `<input>` |

The UI hides what a shell cannot do (`platform.caps.*`) rather than disabling it.

**Updates.** Settings > About has an opt-in check (off by default, no device id) that asks GitHub for the
newest release and matches the asset to the shell. It reads `pham-noah/split-speedcubing`, which is public:
an anonymous request gets a 404 for a private repo, so the release channel has to be public for a check
(and the "Report a problem" button) to work. Installing the update is left to the user or the store;
nothing is downloaded or installed automatically.

## Android (Capacitor)

Needs Android Studio (SDK + JDK 17+).

```bash
npm run build:android  # web build into dist-android/ and into android/app/src/main/assets/public
npm run android:open   # opens Android Studio; press Run on a device/emulator
```

**Release signing.** `android/app/build.gradle` reads `android/keystore.properties` (gitignored) and signs
release builds with `android/app/split-release.jks`. Both are gitignored: the key and its passwords must be
backed up somewhere permanent, because a lost key means nobody who installed the app can be updated again.
Without the properties file, release builds fall back to the debug key so a fresh clone still builds.

Updating in place works when the phone already has a build signed with this key. A phone holding a build
signed with a different key (an older debug-key APK) needs that one uninstalled once; after that, every
build installs over the last.

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
src/lib/core/      cube.ts (3x3 simulator), alg.ts, stats.ts, srs.ts, targets.ts, scramble.ts   (pure, tested)
src/lib/data/      pll.ts, oll.ts                                                  (alg data)
src/lib/storage/   Storage interface + IndexedDB / memory implementations, backup model
src/lib/ui/        TimerPad, CaseDiagram, ScrambleWalk, PenaltyRow, Deltas, LazyBox, panels
src/views/         Solve, Train, Library, Drills, Settings
```

## How the pieces work

- **Case diagrams** are not hand-drawn data: the simulator applies the inverse of the case's algorithm to a solved cube and draws the top layer. A diagram therefore always matches its algorithm, including algorithms you change.
- **Case scrambles** are the inverse of the algorithm with a random AUF in front, so you meet each case from different angles.
- **Scrambles for the Solve timer** use cubing.js random-state scrambles (loaded on demand), falling back to random-move scrambles if it cannot load.
- **Scheduling** uses FSRS (via the open-source `ts-fsrs` library) in `srs.ts`: each case has a stability and difficulty, reviews are scheduled for a target recall you choose in Settings (80-95%, default 90%), and the Library shows the estimated recall for a case. Cards from the earlier box-based version are migrated on their next review. Parameters can be personalised from your own history (see `src/lib/core/fsrs-optimize.ts`: log-loss search pulled towards the defaults and validated on held-out cases).
- **Storage** is behind one interface (`src/lib/storage/index.ts`). IndexedDB keeps the settings, cards and sessions in one small record and each solve as its own record, so adding a solve writes one entry instead of the whole history; older databases are migrated on first read.

## Testing

- `npm test`: 285 unit and component tests (including an axe-core accessibility audit and WCAG contrast checks).
- `npm run e2e`: 37 end-to-end checks in a **real Chrome/Chromium**: first launch, timing with real pointer input, persistence across reloads (IndexedDB), keyboard shortcuts, retrying a scramble from History, the training flow, csTimer import, no sideways overflow at Extra large text on a 360 px phone, offline mode (service worker, scrambles still work), and no console errors. `npm run e2e` runs them against the build on :4173, where the three offline checks skip; `npm run e2e:offline` builds with `VITE_SW=1` into `dist-sw/`, serves it on :4174 and runs all 37, which is what CI does. Set `CHROME_PATH` if Chrome is not in a standard location. The checks run in CI (`.github/workflows/ci.yml`).
- `npm run lint`: ESLint over `src/` and `scripts/` (svelte-check catches types, this catches the classes of bug that type-check fine: a name shadowing another, a dead variable, an unkeyed each block, a bare expression used as an `$effect` dependency). Run by CI before the tests.
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
- **Train:** opens on a **Today** screen (cases due, new cases, this week's recognition and execution averages, last 30 days at a glance, progress per set, quick drills, "weak spots" = your 10 slowest cases, plus "lapsed" = the cases the scheduler marked as lapses). Then PLL, OLL, F2L (the 41 cases practised in all four slots, so 164 cards) and ZBLL (your own imported list) with case-specific scrambles, recognition vs execution timing, attempt-based grading (a DNF, a missed recognition or a very slow solve counts as a lapse) and FSRS spaced repetition. On wide screens a side panel shows the algorithm, recent attempts and shortcuts.
- **Library:** PLL / OLL / F2L / ZBLL tabs, mastery grid; the F2L tab lists the 41 cases once, filtered by the six groups speedcubedb uses (Connected, Corner In Slot, Disconnected, Edge In Slot, Free, Pieces In Slot) with a mastered/total count on each, and the case you open has **FR / FL / BL / BR** tabs to see that same case from any slot; PLL cases are drawn as movement arrows, F2L as small cubes with only the pair in colour (flat SVG in the grid, a live 3D cube for the case you open); several algorithms per case, pick your default, add your own (checked by the simulator to really solve that case), per-algorithm stats, estimated recall, case codes (press F) and a Trainer view for one case inside the Library.
- **Attempts panel:** every screen has a right-hand column with the recent attempts or solves and three deltas — previous, ao5, ao12 — green when faster, red when slower. History carries the same deltas on every row.
- **Drills:** Cross only, 2-look OLL, 2-look PLL, BLD memo.
- **First launch:** a short three-step intro (replay it from Settings) and helpful empty states.
- **Android Back button:** closes the top-most thing first (open case, history, a trainer session, an inspection), then goes to the previous tab, and exits only from the first screen. Esc does the same on desktop.
- **Keyboard shortcuts, rebindable:** every action is a named command (timer, +2, DNF, delete, history, new scramble, skip, go to each tab, back). Rebind in Settings; conflicts are refused, and the default aliases (P for +2, W for the scramble) stand down once you rebind. The ones you will actually use: **Space** start/stop (Enter or the timer key also begins a session and trains the selected case), **W** next case / new scramble, **Z / X / C** +2, DNF and delete on whatever was recorded last — on Solve, Train, Library and Drills alike, **A / D** previous or next case set (Library) and previous or next drill mode (Drills), **S** back to the timer from History or Sessions, **F** the find overlay in the Library (type a code *or* a case name; Enter opens the first match) and the two-look toggle inside the OLL and PLL drills, **End** shows or hides the scramble cube.
- **Hideable panels:** switch off parts of the Solve and Train screens you do not use (Settings, Screen layout).
- **Import:** csTimer exports (sessions, times, +2/DNF, scrambles, dates; other puzzles are skipped), CSV (TwistyTimer-style and generic), plain lists of times, and best-effort JSON (CubeDesk). Imported sessions are added as new sessions; running an import twice skips duplicates — for a file with no dates the duplicate check only works on the same day, because those solves get their timestamps from the import date. Files over 5 MB are refused rather than parsed on the main thread.
- **Settings:** themes (Midnight, AMOLED, High contrast), text size, hold time, inspection, hide time while solving, target recall, backup export/restore.
- **Personalised scheduling:** Settings > Personalise scheduling learns how fast *you* forget from your own review history (FSRS parameter fitting, on-device) and keeps the result only if it predicts held-out cases better than the standard parameters. About 100+ usable reviews are needed; it is checked against simulated learners in the tests.
- **Offline web version (PWA):** `npm run build`, then host `dist/` anywhere (or `npm run preview`) and install it from the browser; a service worker caches the app, fonts and the scramble code. The service worker is not used inside the Android and desktop apps.
- Fonts (Manrope, JetBrains Mono) are bundled, so nothing is fetched at run time.
- Wide windows (desktop) turn the bottom tab bar into a left sidebar.

## Accessibility

Automated checks, run by `npm test`: an axe-core audit of the intro, Solve, Train (Today and session), Library (including an open case), Drills and Settings screens finds no violations (colour contrast is excluded there because the simulated browser cannot compute colours); a separate test checks WCAG contrast (4.5:1 for text, 3:1 for outlines) for every theme directly from `src/app.css`. The app uses labelled landmarks, `aria-current` on the active tab, `aria-pressed` on toggle buttons, live regions for the timer state, a modal intro that traps focus and makes the page inert, visible focus rings, 44 px+ targets, reduced-motion support, and a text-size setting up to 130%.

**Still to do on a real device (cannot be tested here):** TalkBack (Android) or a desktop screen reader walk-through of the timer and trainer, and a visual pass at "Extra large" text on a small phone.

## How an F2L case is drawn

One module decides what a case looks like: `src/lib/ui/caseCubeView.ts` finds the two pieces that belong in the slot by their colours, picks the camera angle that keeps them in sight, projects the stickers and says which three faces point at the viewer. `CaseCube` (the 3D cube you see when a case is open) and `CaseThumb` (the flat `<svg>` in the 41-cell grid) both read from it, so a thumbnail and the detail view cannot frame the same case differently. The grid uses SVG because 41 live CSS-3D scenes cost 2,900 DOM nodes and 3,700 ms of blocked main thread on a phone-sized viewport; the same grid as SVG is 1,100 nodes and 460 ms, with the same three faces in view.

## Algorithm data (PLL, OLL, F2L, ZBLL)

- **F2L:** the 41 cases are the standard table in the community's numbering, taken from [SpeedCubeDB](https://speedcubedb.com/a/3x3/F2L) (`scripts/data/f2l-speedcubedb.json`, front-right slot, the highest-voted algorithm per case). `scripts/gen-f2l-scdb.ts` writes `src/lib/data/f2l-fr.ts` and re-checks every line with the simulator first: the case must disturb the front-right pair and nothing else, the alg may be at most 12 moves, and no two cases may be the same shape (compared up to an AUF). The other three slots (front-left, back-left, back-right) are the same cases turned about the vertical axis: `src/lib/core/rotate.ts` relabels the moves, with the mapping derived from the simulator and verified for all 164 cases (cross and the other three slots untouched, the right pair disturbed). These are the algorithms people actually execute; swap in your own favourites in the Library (the app checks that they solve the case, allowing an AUF in front).
- **PLL and OLL:** the 21 and 57 cases in the standard letter and number naming, taken from [SpeedCubeDB](https://speedcubedb.com/a/3x3/PLL) (`scripts/data/pll-speedcubedb.json`, `oll-speedcubedb.json`). Each case ships the algorithm that page marks standard, plus up to three further algorithms from the same page; 52 of those alternatives are bundled. `scripts/gen-lastlayer-scdb.ts` writes both data files and refuses to write unless every line keeps F2L solved, solves its own case, and the 21 permutations (PLL) or 57 orientation patterns (OLL) are all distinct. `scripts/check-oll-names.ts` re-checks the nicknames in `src/lib/data/oll-names.ts` against the algs, so the numbering is the standard one rather than a guess.
- **ZBLL:** no algorithms are bundled (493 cases, and I did not want to invent them). Paste your own list in Library > ZBLL, one `name: algorithm` per line. Every line is checked by the simulator (F2L solved, edges oriented). Diagrams, scrambles and spaced repetition then work for them like any other set.

## Known limits / next steps

- Algorithms are starting points: a default plus the alternatives SpeedCubeDB lists, all of them machine-checked, but they are not guaranteed to be the ones you like executing. Swap the default in the Library per case (the app checks that an alg really solves the case before it accepts it), and check any line against your own reference if you care about a specific numbering.
- Not done yet: ZBLL bundled algs. Smart cube Bluetooth support was deliberately left out to keep the app simple and fully offline.
- The csTimer import follows csTimer's documented/observed export layout and is unit-tested against it, but not against a real export file. CubeDesk's own backup format could not be verified; its importer is best effort, and CSV or a plain list of times always works.
- Tested in a real desktop browser (Chromium: 37 end-to-end checks) and by 285 unit tests, but not yet on a real phone or inside the Android and Tauri shells, and the GitHub workflows and F-Droid recipe have not been run.

## Licence

Copyright (C) 2026 *your name here*.

Split is free software: you can redistribute it and/or modify it under the terms of the **GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version** (SPDX: `GPL-3.0-or-later`). It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY. See `LICENSE` for the full text. If you prefer GPL-3.0-only, change `license` in `package.json` and this paragraph.

All bundled third-party packages use GPL-3.0-compatible licences (MIT, MPL-2.0 / GPL dual, OFL for the fonts, Unlicense); the list is in `THIRD_PARTY_LICENSES.md` (regenerate with `node scripts/third-party.mjs > THIRD_PARTY_LICENSES.md`).
