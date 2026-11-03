# Split

![Split trainer on desktop](docs/desktop-trainer.png)

Local-first speedcubing trainer: a solve timer plus drills for **PLL (21)**, **OLL (57)**, **F2L (41 cases in 4
slots)** and **ZBLL (472)**, with recognition/execution timing, case-specific scrambles, spaced repetition and
generated diagrams. No accounts, no tracking, no backend; data stays on the device.

One Svelte 5 + TypeScript codebase, three shells: browser/PWA, Android (Capacitor), desktop (Tauri).

## Run it

```bash
npm install
npm run dev             # http://localhost:5173
npm test                # 800 unit and component tests in 24 files
npm run check           # svelte-check: types
npm run lint            # eslint
npm run e2e             # 43 real-browser checks against a build on :4173
npm run e2e:offline     # the same 43 with the service worker, built into dist-sw/ and served on :4174
npm run version:check   # package.json, Cargo.toml, tauri.conf.json, build.gradle and the changelog agree
```

`npm run e2e` needs `npm run build:web && npm run preview` already running, plus `CHROME_PATH` if Chrome is not in
a standard location. CI runs lint, types, unit and e2e on every push.

## Three builds, one seam

`vite --mode <target>` swaps the adapter in `src/lib/platform/` through a `$platform` alias, and eslint refuses an
`@capacitor/*` or `@tauri-apps/*` import anywhere else — so no shell's dependencies reach another shell's bundle.

```bash
npm run build:web       # dist-web/      PWA + service worker
npm run build:android   # dist-android/  then copied into android/
npm run build:desktop   # dist-desktop/  what Tauri packages
```

| Capability | web | android | desktop |
| --- | --- | --- | --- |
| Hardware Back | – | Capacitor `backButton` | – |
| Service worker | yes | no | no |
| Release check | – | – | yes |
| Backup save/restore | anchor + `<input>` | anchor + `<input>` | anchor + `<input>` |

What a shell cannot do is hidden (`platform.caps.*`), never disabled.

**Releases** are at github.com/pham-noah/split-speedcubing/releases. **Updates** are opt-in (off by default, no
device id): one request to `api.github.com` for the newest release, then a version and a link. Nothing is
downloaded or installed, and the desktop CSP allows exactly `connect-src https://api.github.com` for it. The repo
must stay public — an anonymous request to a private one gets a 404, which also breaks "Report a problem".

## Android

Needs Android Studio (SDK + JDK 17+). `npm run build:android` builds and copies the app in; `npm run android:open`
opens Android Studio.

**Release signing.** `android/app/build.gradle` reads `android/keystore.properties` (gitignored) and signs with
`android/app/split-release.jks`. Back both up permanently: lose the key and nobody who installed the app can be
updated again. Without the properties file a release build falls back to the debug key so a fresh clone still
builds, and that build cannot be updated in place.

The app declares no permissions and turns cloud auto-backup off, which is what makes it provably offline. It
therefore has no `INTERNET` permission either, so the release check is desktop-only and a phone gets its updates
from its store. `docs/fdroid/com.noah.split.yml` is the F-Droid inclusion template; `docs/RELEASING.md` is the
release checklist.

## Desktop

Needs Rust (https://rustup.rs) and the Tauri prerequisites for your platform.

```bash
npm run desktop:dev     # dev window with hot reload
npm run desktop:build   # installers in src-tauri/target/release/bundle/
```

Icons and the splash come from `scripts/make-icons.py` (`npm run icons`).

## Layout

```
src/lib/core/      pure and tested, no DOM: cube.ts (simulator), alg, stats, srs (FSRS), scramble,
                   importers, hints, shortcuts, targets, twolook, update
src/lib/data/      PLL, OLL, F2L, ZBLL and 2-look tables — generated and validated, never hand-written
src/lib/platform/  web.ts, android.ts, desktop.ts, dom.ts, types.ts — the only place a shell is touched
src/lib/storage/   Storage interface + IndexedDB / memory, and model.ts, the one trust boundary
src/lib/ui/        TimerPad, CaseDiagram, CaseCube, ScrambleWalk, panels
src/views/         Solve, Train, Library, Drills, Settings
src/lib/store.svelte.ts   the single app store (runes)
```

## How it works

- **Diagrams** are drawn, not handmade: the simulator applies a case's inverse algorithm to a solved cube, so a
  diagram always matches its algorithm, including your own edits.
- **Trainer scrambles** are that inverse plus a random AUF, so you meet each case from different angles.
- **Scheduling** is FSRS (`ts-fsrs`) over per-case stability and difficulty, aiming at the recall rate set in
  Settings (80–95%, default 90%). `fsrs-optimize.ts` fits the parameters to your own history and keeps them only if
  they predict held-out cases better.
- **Storage** is IndexedDB behind one interface: settings, cards and sessions in one record and every solve in its
  own, so a new solve writes one entry. Older databases migrate on read; `normalize()` is the only place a backup
  file is trusted.
- **Timer scrambles** are cubing.js random-state scrambles, loaded on demand, with a random-move fallback.

## Features

- **Solve:** hold to start, optional 15 s inspection (warns at 8 and 12 s, +2 at 15, DNF at 17), penalties,
  best/ao5/ao12, sessions with their own history, undoable deletes.
- **Train:** Today (due, new, week averages, weak spots, lapses), then per-set drills with recognition and execution
  timing, attempt grading and FSRS scheduling.
- **Library:** mastery grid per set. F2L lists its 41 cases once and rotates them across FR/FL/BL/BR; ZBLL lists its
  472 filtered by the seven subsets. Several algorithms per case, your default, your own additions
  (machine-checked), per-algorithm stats.
- **Drills:** Cross, 2-look OLL, 2-look PLL, BLD memo.
- **Import:** csTimer, CubeDesk, CSV and plain time lists. Sessions, penalties and scrambles survive; other puzzles
  are skipped with a note, duplicates are skipped, and files over 5 MB are refused instead of parsed on the main
  thread.
- **Settings:** three themes, text size to 130%, hold time, inspection, recall target, personalised scheduling,
  backup export/restore, screen layout.
- **Keyboard:** every action is a named, rebindable command. Android Back / Esc closes the top-most thing first.
- **Accessibility:** labelled landmarks, live regions, a focus trap on the intro, reduced motion; an axe-core audit
  of every screen and a WCAG contrast check of every theme run in the suite.
- **Offline web:** host `dist-web/` and install from the browser; the worker caches the app, fonts and scrambles.

## Algorithm data

F2L, PLL, OLL and ZBLL come from [SpeedCubeDB](https://speedcubedb.com) with its numbering and grouping, so "F2L 23"
means the case in the tutorial you are watching, and each case defaults to the algorithm that page lists first.
Every line is re-checked by the simulator before it is written: it must keep F2L solved, solve its own case, and
leave the cases distinct up to AUF. Generators are `scripts/gen-*-scdb.ts`; pasted lists still work, and a line
that names a case adds to it instead of making a duplicate. ZBLL is 472 cases rather than the 493 usually quoted
because the 21 PLL cases are their own set here.

## Known limits

- Algorithms are machine-checked starting points, not a claim about what you like executing. Swap the default per
  case in the Library.
- Not yet used on a real phone for a full session, and no TalkBack/screen-reader pass.
- csTimer and CubeDesk are the only importers read from the other app's own code rather than guessed: csTimer is
  covered by a file cstimer.net wrote (`src/lib/core/fixtures/cstimer-export.json`), CubeDesk by its export/import
  source, because cubedesk.io keeps export behind an account.

## Licence

Copyright (C) 2026 Noah Pham. Split is free software under the **GNU GPL v3 or later** (SPDX: `GPL-3.0-or-later`),
with no warranty; see `LICENSE`. Bundled third-party packages are GPL-compatible and listed in
`THIRD_PARTY_LICENSES.md`.
