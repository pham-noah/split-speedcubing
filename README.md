# Split

![Split trainer on desktop](docs/desktop-trainer.png)

Local-first speedcubing trainer: a solve timer plus drills for **PLL (21)**, **OLL (57)**, **F2L (41 cases in
4 slots)** and **ZBLL (472)**, with recognition/execution timing, case-specific scrambles, spaced repetition and
generated case diagrams. No accounts, no tracking; data stays on the device.

One codebase (Svelte 5 + TypeScript + Vite) for three shells: browser/PWA, Android (Capacitor), desktop (Tauri).

## Run it

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # 795 unit and component tests in 24 files
npm run check          # type-check (svelte-check)
npm run lint           # eslint
npm run e2e            # 38 real-browser checks against the build on :4173
npm run e2e:offline    # builds dist-sw/ with the service worker, serves :4174, runs all 38
npm run version:check  # the five version numbers agree
```

`npm run e2e` needs a build being served (`npm run build && npm run preview`) and `CHROME_PATH` if Chrome is
not in a standard location. CI runs lint, types, unit and e2e on every push.

## The three builds

`vite --mode <target>` swaps the adapter in `src/lib/platform/`, so no shell's dependencies reach another
shell's bundle; eslint blocks `@capacitor/*` and `@tauri-apps/*` outside that directory.

```bash
npm run build:web       # dist-web/      PWA + service worker
npm run build:android   # dist-android/  then copied into android/
npm run build:desktop   # dist-desktop/  what Tauri packages
```

| Capability          | web                | android                | desktop            |
| ------------------- | ------------------ | ---------------------- | ------------------ |
| Back button         | -                  | Capacitor `backButton` | -                  |
| Service worker      | yes                | no                     | no                 |
| Backup save/restore | anchor + `<input>` | anchor + `<input>`     | anchor + `<input>` |

The UI hides what a shell cannot do (`platform.caps.*`) instead of disabling it.

**Releases** are published at github.com/pham-noah/split-speedcubing/releases. **Updates:** Settings > About
has an opt-in check (off by default, no device id) that reads the newest release there and matches the asset
to the shell. It must stay public: an anonymous request gets a 404 for a private repo, which also breaks the
"Report a problem" button. Nothing is downloaded or installed automatically.

## Android

Needs Android Studio (SDK + JDK 17+).

```bash
npm run build:android  # builds the web app and copies it into android/app/src/main/assets/public
npm run android:open   # opens Android Studio; press Run
```

**Release signing.** `android/app/build.gradle` reads `android/keystore.properties` (gitignored) and signs with
`android/app/split-release.jks`. Back both up somewhere permanent: a lost key means nobody who installed the
app can be updated again. Without the properties file, release builds use the debug key so a fresh clone still
builds — that build cannot be updated in place, so uninstall it once when moving to a signed one.

No permissions are declared and cloud auto-backup is off, so the app is provably offline.

## Desktop

Needs Rust (https://rustup.rs) and the Tauri prerequisites for your platform.

```bash
npm run desktop:dev     # dev window with hot reload
npm run desktop:build   # installers in src-tauri/target/release/bundle/
```

`src-tauri/tauri.conf.json` sets a strict CSP with no network access. Icons and the splash come from
`scripts/make-icons.py` (`npm run icons`).

## Project layout

```
src/lib/core/      cube.ts (3x3 simulator), alg.ts, stats.ts, srs.ts, scramble.ts, update.ts   (pure, tested)
src/lib/data/      pll.ts, oll.ts, f2l-fr.ts                                   (alg data)
src/lib/platform/  web.ts, android.ts, desktop.ts, dom.ts, types.ts           (one adapter per shell)
src/lib/storage/   Storage interface + IndexedDB / memory, backup model
src/lib/ui/        TimerPad, CaseDiagram, CaseCube, ScrambleWalk, panels
src/views/         Solve, Train, Library, Drills, Settings
```

## How the pieces work

- **Case diagrams** are not drawn by hand: the simulator applies the inverse of a case's algorithm to a solved
  cube and draws the top layer, so a diagram always matches its algorithm, including your own edits.
- **Case scrambles** are that inverse with a random AUF in front, so you meet each case from different angles.
- **Timer scrambles** use cubing.js random-state scrambles (loaded on demand), falling back to random moves.
- **Scheduling** is FSRS (`ts-fsrs`) in `srs.ts`: each case has stability and difficulty, and reviews are
  scheduled for the recall target set in Settings (80-95%, default 90%). `fsrs-optimize.ts` fits the parameters
  to your own history on device and keeps the result only if it predicts held-out cases better.
- **Storage** is behind one interface: settings, cards and sessions in one record, each solve in its own, so a
  new solve writes one entry. Older databases migrate on first read.

## Features

- **Solve:** hold-to-start, optional 15 s inspection (beeps at 8 and 12 s, +2 after 15, DNF after 17), penalties,
  best/ao5/ao12, sessions with their own history.
- **Train:** Today (due, new, week averages, weak spots, lapses), then PLL, OLL, F2L and ZBLL drills with
  recognition/execution timing, attempt grading and FSRS scheduling.
- **Library:** mastery grid per set; F2L lists the 41 cases once, filtered by the six SpeedCubeDB groups, each
  open case rotatable across FR/FL/BL/BR; ZBLL lists its 472 cases once, filtered by the seven subsets. Several
  algorithms per case, your default, your own additions (machine-checked), per-algorithm stats and estimated
  recall.
- **Drills:** Cross, 2-look OLL, 2-look PLL, BLD memo.
- **Import:** csTimer, CubeDesk, CSV (TwistyTimer-style and generic), plain time lists. Sessions, penalties
  (+2 and DNF) and scrambles survive; other puzzles and trainer solves are skipped with a note. Duplicates are
  skipped and files over 5 MB are refused rather than parsed on the main thread.
- **Settings:** themes (Midnight, AMOLED, High contrast), text size to 130%, hold time, inspection, recall
  target, personalised scheduling, backup export/restore, screen layout.
- **Keyboard:** every action is a named, rebindable command (Space, W, Z/X/C, A/D, S, F, End by default).
  **Android Back / Esc** closes the top-most thing first, then the previous tab, and exits from the first screen.
- **Accessibility:** labelled landmarks, live regions, focus trap on the intro, 44 px targets, reduced motion.
  Tests run an axe-core audit of every screen and check WCAG contrast for every theme.
- **Offline web:** host `dist-web/`, install from the browser; the worker caches the app, fonts and scrambles.

## Algorithm data

- **F2L:** the 41 cases from [SpeedCubeDB](https://speedcubedb.com/a/3x3/F2L), front-right slot, highest-voted
  algorithm per case. `scripts/gen-f2l-scdb.ts` re-checks each line with the simulator (disturbs the FR pair and
  nothing else, at most 12 moves, no two cases the same shape) before writing `src/lib/data/f2l-fr.ts`. The other
  slots are the same cases turned about the vertical axis (`rotate.ts`), verified for all 164.
- **PLL / OLL:** the 21 and 57 standard cases from [SpeedCubeDB](https://speedcubedb.com/a/3x3/PLL), each with
  the standard algorithm plus up to three alternatives (52 bundled). `scripts/gen-lastlayer-scdb.ts` refuses to
  write unless every line keeps F2L solved, solves its own case, and all cases stay distinct.
- **ZBLL:** the 472 cases from [SpeedCubeDB](https://speedcubedb.com/a/3x3/ZBLL)'s seven subsets, every line
  re-checked by the simulator (F2L solved, edges oriented, the algorithm solves its own case, all 472 distinct
  up to AUF) — `scripts/gen-zbl-scdb.ts`. 427 bundled alternatives. The 21 PLL cases are their own set, which is
  why this is 472 and not the 493 usually quoted. A pasted list keeps working: a line that names a case (`U1`,
  `T 4`) or solves one adds your algorithm to that case, anything else becomes its own case.

## Known limits

- Algorithms are machine-checked starting points, not a claim about what you like executing; swap the default per
  case in the Library.
- Not tested on a real phone or inside the Tauri shell yet, and no TalkBack/screen-reader pass.
- csTimer and CubeDesk are the only importers read from the apps' own code rather than guessed: csTimer's export
  is covered by a real file that cstimer.net wrote (`src/lib/core/fixtures/cstimer-export.json`), CubeDesk's by
  its export/import source (`types/solve.ts`, `types/session.ts`, `server/models/solve.ts`) and not a downloaded
  file, because cubedesk.io now keeps export behind an account.

## Licence

Copyright (C) 2026 Noah Pham. Split is free software under the **GNU GPL v3 or later** (SPDX:
`GPL-3.0-or-later`), with no warranty; see `LICENSE`. Bundled third-party packages are GPL-compatible (MIT,
MPL-2.0, OFL fonts, Unlicense) and listed in `THIRD_PARTY_LICENSES.md`.
