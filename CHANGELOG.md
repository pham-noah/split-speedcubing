# Changelog

All notable changes to Split. Format based on [Keep a Changelog](https://keepachangelog.com); versions follow [SemVer](https://semver.org).

## [0.9.0] - 2026-11-14

A 2x2, a split you can correct, a way out to csTimer, and the trainer on the other end of a phase.

### Added
- **2x2.** A puzzle switch on the timer: 3x3 or 2x2. A session belongs to one puzzle, so each keeps its
  own scrambles, history and averages, and switching lands on that puzzle's session (making one the first
  time). 2x2 scrambles are random-state from cubing.js, the fallback is 11 RUF moves, and the 3x3 cube
  walkthrough is not drawn over a 2x2 scramble. A csTimer import now keeps its 2x2 sessions as 2x2.
- **The trainer on the other end of a split.** The phase that took the largest share of a solve is named
  under its bar, with one button into training it: Cross opens the cross drill, F2L / OLL / PLL open that
  set's session, due cases first. With fewer than three marks the tail is *Rest*, which trains nothing, so
  the largest marked phase is named instead.
- **Export for csTimer**, in Settings → Data, in the file shape cstimer.net writes (numbered sessions,
  `[penalty, ms]` rows, a `properties` block that names them and gives 2x2 its `222so` scrambler). Verified
  against csTimer's own storage and import source, and read back in the suite through Split's importer.

### Fixed
- **A mistimed phase mark can be corrected.** While the clock runs an Undo sits beside the Split pill and
  takes the last mark back; in History, a solve's split can be cleared (and that undone). Before, one bad
  tap shaped that solve's phases and the averages that read them for good.

### Changed
- A session now records which puzzle it times, so the Sessions screen names each one's event and a new
  session inherits the one you are timing.

## [0.8.0] - 2026-11-13

Phase splits, a deeper read on your history, and PLL diagrams you can recognise from.

### Added
- **Split timing, off by default.** Settings → Timer turns it on; while the clock runs a Split pill sits
  above the cover, and each tap (or the `/` key, rebindable) marks the end of a phase — Cross, F2L, OLL and
  PLL. Tapping anywhere else still stops the solve, so the stop gesture is untouched. The last solve shows
  its phases as a bar with each phase's delta against your last twelve, History shows the split under any
  solve that has one, and a Phases card counts where the time actually goes.
- **History reads past its first page.** Best ao50 and Best ao100 join ao5 and ao12, with the session mean
  and a spread (standard deviation) beside them, and a *Show older* row pages back through a history the old
  screen stopped at 200 solves.

### Fixed
- A phase is only averaged against solves split the same way: with two marks the third segment is *Rest*, and
  counting that into OLL compared a phase with a phase plus everything after it.

### Changed
- **PLL diagrams carry their colours.** Each case draws the twelve side stickers of the last layer in their
  real colours around the top face, which is what a cuber reads off a PLL; the arrows stay. OLL and ZBLL
  thumbnails get the same wider side band.
- The Settings jump bar clips no chip, and inspection beeps only appear when 15-second inspection is on.

## [0.7.2] - 2026-11-09

A hardening pass over the timer and the import paths, most of it found by trying to break the app on purpose.

### Fixed
- **A stray tap can no longer invent a personal best.** A press under 300 ms after the start is thrown away
  with a short "Too short" note instead of being saved as a 0.05 s solve that sits at the top of Best forever.
- **Stopping the clock no longer presses whatever is behind it.** The tap that stops the timer goes through
  the full-screen colour, and the browser then clicked the element underneath: stopping over the session chip
  also opened Sessions, over a trainer's Skip it also skipped the case.
- **The Settings jump bar no longer covers the page** on a desktop-width window, where it had turned into a
  tall column pinned over the cards.
- **A long session name truncates in the pill** instead of stretching the whole screen sideways.
- **An unreadable import clears its preview** rather than leaving the previous file's solves behind the Import
  button; a deeply nested JSON file now reports "No solves found" instead of failing.
- **The desktop wordmark no longer appears in a phone's tab bar**, where it squeezed five tabs into four.

### Changed
- **A huge imported history no longer stalls the screens.** Opening History with 50 000 solves did about
  300 ms of work on every tab switch; the solve lists are now built once per change (~100 ms on open).
- The README no longer claims Back/Esc cannot abandon a running solve — Esc stops and discards it.

## [0.7.1] - 2026-11-05

A design pass over every screen, and three defects it caught that were not cosmetic.

### Fixed
- **The history chart could paint nothing.** If the oldest solve in the chart's window was a DNF (or any
  solve without a time), the path opened with a line command instead of a move command, which SVG rejects —
  so the whole line silently disappeared and the card looked empty.
- **The timer was left-aligned on a phone.** The button's `align-self` only had an effect inside a flex
  column, which the block it sat in did not become until 1100px wide.
- **Cards on the desktop were clipped.** The body already clears the sidebar's 210px and the split padded
  another 108px on top, leaving a 594px column whose content was cut off at its own edge.
- The Settings accent row rendered a stray `>` after each swatch, which the new six-column grid turned into
  visible chevrons.

### Changed
- **Composition.** The timer centres with the stat row docked above the tab bar instead of ending in a dead
  zone; History reads as a hairline table whose headers sit over their values; the cube and the penalty row
  stop competing with the timer; the desktop sidebar has a wordmark and its shortcut list went from sixteen
  keycap rows to seven plus one line of tab keys.
- **Small screens.** The filter row is five equal cells so "Due" is no longer orphaned onto its own line; six
  accent swatches fit one row; the 30-day counts are a 2×2 instead of four ragged columns; checkboxes are
  drawn by the app rather than by the OS.
- **Settings** has a sticky jump bar, since eight sections is a lot of scrolling on a phone.
- **Library** gives each case diagram 112px on a wide screen, and "Train this case" is the primary action on
  a case instead of "Add algorithm".
- The case grid's dashed cells are legible (`#5E6779`, was `#4A5160`), and the History chart is labelled
  slow-to-fast and capped at 190px instead of growing with the column.

## [0.7.0] - 2026-11-05

A phone on the GitHub build can now update itself, the desktop shell can go fullscreen, and links finally go
somewhere.

### Added
- **Two Android builds from one source.** `store` is what goes to a store: no permissions at all, provably
  offline, exactly as before. `github` — the APK on the releases page — adds one permission, `INTERNET`, for the
  opt-in update check, and is the only build where Settings offers that check. Both share `applicationId` and
  signature, so either installs over the other and your data comes with it. `npm run android:store` and
  `npm run android:github` build them; CI signs and attaches both to a release (`Split-<version>.apk` and
  `Split-<version>-store.apk`), and the F-Droid recipe builds `assembleStoreRelease`.
- **Fullscreen on the desktop.** F11, or the button in Settings. `platform.toggleFullscreen()` sits behind a new
  `caps.fullscreen`, so only the shell that owns a window shows it.

### Fixed
- **Links did nothing on the desktop.** The Tauri capability granted `opener:allow-open-url` without a URL scope,
  so every `openUrl` call was rejected — and the click handler's empty `catch` threw the reason away, which is why
  it looked like the link was simply dead. The capability now scopes `https`, `http` and `mailto`; every shell
  routes links through one `platform.openLink()` (desktop: system browser, Android: Custom Tabs intent, web: a
  tab), and a shell that refuses shows "That link could not be opened" with the URL instead of failing silently.
- The update check picked the first `.apk` on a release, which after this change could be the store build: a phone
  already on the GitHub build would have been pointed at an APK that cannot check for itself.
- `__GITHUB_BUILD__` is a build-time constant (`--mode android-github`), so the store build cannot gain the check
  by accident: the Android bundle shipped to stores contains `updateCheck:!1`.

## [0.6.0] - 2026-11-05

The app now answers when you touch it, and a long history no longer costs you a stutter on every solve.

### Added
- **Press feedback on everything.** Buttons, chips, case cells, segments, tabs and the round Solve button squash to
  0.955 on pointer-down in 90 ms and settle back on a 260 ms spring. Before this the Android tap highlight was
  suppressed and the first visual answer was the click landing, so a press read as nothing happening.
- **The hold has something to watch.** The timer button sinks to 0.93 with a glow while you hold it, and a ring
  draws itself in over exactly the hold time set in Settings (150/300/500 ms).
- **The full-screen cover carries its own state.** It sits above the timer button, so a hold used to hide the
  "Release!" cue and the wait was blind. The flood and its contents are now two layers: a stationary stage at the
  centre of the screen shows the ring, `Hold`, `Release`, then the running time. Its ink is measured from the
  colour it will paint, because white on the default blue did not clear 4.5:1.
- **Motion across the rest of the app:** screens rise 6 px as they open, the tab you land on pops and its icon leans
  in, segment and case cells answer their own press, the intro sheet and the phone case sheet come in rather than
  appearing, undo banners rise from the bottom edge, history rows stagger in, the due badge pops when it changes,
  a new scramble lands one move at a time, and the three stat numbers plus the finished time get an entrance when
  they change. All of it is transform/opacity only, 180–260 ms, and none of it runs under
  `prefers-reduced-motion`.

### Changed (speed)
- **A save copies only what changed.** `$state.snapshot(this.data)` walked the whole history on every write:
  measured 960 ms per save at 10 000 solves in Chrome. The store keeps the plain copies it last handed to storage
  and refreshes only what differs, comparing a solve on the two fields that can still change. Same build, same
  data: 14 ms. A test mutates a solve and a card straight on the state object — where no store method marks
  anything — and requires both to survive a reload, so a stale copy cannot pass quietly.
- **Cards have their own IndexedDB store.** They used to live inside the `kv['app']` blob, so every solve and every
  penalty tap rewrote 2 MB of card records (472 cases × 60 attempts). They are now keyed, written as a delta from
  the ids the store touched, and deleted when they leave the data. One changed solve: 38.6 ms at 1 000 solves and
  99.1 ms at 50 000 before; 1.6 ms and 54.3 ms after.
- **The FSRS optimiser runs in a worker.** Replaying thousands of reviews used to churn the main thread for 4.6 s
  at 2 512 usable reviews; it now takes 3.1 s off-thread with one 150 ms frame instead of a hundred small ones, and
  falls back to the same function inline where there is no `Worker`.
- **History derives only the rows it draws.** The ao5/ao12 deltas were computed for the whole session while the
  list shows the last 200 rows: 62.5 ms at 50 000 solves, 0.29 ms over the 211 solves whose windows those rows
  actually read, with identical numbers on every row on screen.
- **The Library's hint overlay is no longer quadratic.** It called `byName()` inside the grid's `{#each}` — 472
  filter-and-sort passes per keystroke on ZBLL. Hoisted to one `$derived`: 90.8 ms to 27.0 ms per keystroke,
  measured in the same browser probe before and after.

### Fixed
- `normalize()` checked the numbers a backup carries but not the strings: a hand-edited file could keep
  `{ alg: 5, name: 7 }` and throw inside the ZBLL importer. Own ZBLL cases and drill rows are now validated like
  solves are, and cube colours must be hex.
- Due counts read `Date.now()` inside a `$derived`, which only recomputes when something else writes, so a case
  that came due while the app sat open stayed invisible. The store owns the clock and refreshes it once a minute;
  every screen reads `store.now`.
- `deleteSession()` wrote its snapshot into the slot "Undo restore" reads, so that button started bringing back
  data a restore never replaced. A session delete has its own undo, and the button names the action it undoes.
- A new ZBLL case imported without a name was numbered `length + added + 1`, growing twice per push, so own cases
  would have been named 1, 3, 5 ….
- `npm run e2e` could not run on Windows: the csTimer fixture was written to `/tmp` (which node resolves on the
  current drive while Chrome resolves it elsewhere, so the upload never attached), and `npm run e2e:offline`
  could not start at all — it spawned the `.bin` shim, which is a shell script with no `.cmd` on Windows, found the
  port holder with `ss`, and bound `localhost` (::1) while its readiness probe asked 127.0.0.1. Both suites now run
  here: 38 checks on a plain build, 41 with the worker.
- The README is curated rather than stale: counts matched to the code, the e2e section says how to get a browser,
  and the measured costs above are written down as known limits.

## [0.5.0] - 2026-10-30

The F2L library is now the standard one, and so are PLL and OLL.

### Changed (packaging)
- The app's store identity is `com.noah.split` instead of Capacitor's `org.example.split` placeholder: `applicationId` in `android/app/build.gradle`, `appId` in `capacitor.config.ts`, `identifier` in `src-tauri/tauri.conf.json`, and the package name and URL scheme in `res/values/strings.xml`. Two Capacitor leftovers went with it: `res/drawable-v24/ic_launcher_foreground.xml` (the stock Capacitor logo as a vector) and `res/values/ic_launcher_background.xml` (`#FFFFFF`). Nothing referenced either any more — the adaptive icon in `mipmap-anydpi-v26` points at the generated `@mipmap/ic_launcher_foreground` PNGs and the generated background — so they were only waiting to be picked up by mistake.

The Android **namespace** is deliberately still `org.example.split`, because that is the Java package `MainActivity` lives in and the manifest's `.MainActivity` resolves against it; renaming it means moving the Java package, which needs a gradle build to verify.

### Added
- A CubeDesk export is read as what it is instead of being guessed at: sessions come from the file's own session
  list, a solve belongs to the session it names, a DNF (stored as `time: -1` with the real time in `raw_time`)
  is now imported as a DNF rather than silently dropped, and a +2 is taken from `raw_time` because CubeDesk has
  already added the two seconds to `time`. Other puzzles and trainer solves are skipped with a note.
- The csTimer importer is checked against a file cstimer.net itself wrote
  (`src/lib/core/fixtures/cstimer-export.json`, three 3x3 solves plus one 4x4, produced by the app's own
  `storage.exportAll()`), so the empty-session padding, the numeric session names and the `+2`/DNF rows are
  covered by a real export rather than by a fixture that agreed with the parser.
- ZBLL ships its 472 cases: the seven SpeedCubeDB subsets, each case with the algorithm that page lists first
  plus up to three more the simulator accepts (427 bundled alternatives). `scripts/gen-zbl-scdb.ts` writes the
  seven data files and refuses to write unless every line keeps F2L solved with the last-layer edges oriented,
  solves its own case and all 472 patterns stay distinct up to AUF. The Library gains a subset filter row
  (U, L, T, H, Pi, S, AS) and Train schedules the 472 as cards. Pasting your own list still works and is now
  smarter: a line that names a case (`U1`, `T 4`, `ZBLL U 1`) or solves one adds your algorithm to that case
  instead of creating a duplicate, only genuinely new cases are stored as yours, and "Remove mine" takes back
  both.
- Five end-to-end checks for the F2L library, so tonight's UI cannot silently regress: 41 cells listed once, speedcubedb's six groups present with their counts, one group narrowing the grid to its own 6 cases, the opened case offering FR / FL / BL / BR, and choosing FL showing that slot's rotated algorithm (`U R U' R'` -> `U F U' F'`). 37 checks in all.

### Fixed
- `npm run e2e` reported three failures on any normal build — service worker, offline load, offline scrambles — because a plain build never registers the worker. They now skip with the command that runs them, and `npm run e2e:offline` builds with `VITE_SW=1` into `dist-sw/`, serves it on :4174 and runs all 33 checks including the offline ones. CI builds that way already, so it sets `EXPECT_SW=1` and keeps the coverage. - `dist-sw/` is now in eslint's ignore list. The offline build made a build directory the linter walked into, and `npm run lint` went from clean to 1 526 errors without a single line of source changing.
A preview left listening on :4174 by an earlier run is now detected by port and replaced, and the server is confirmed gone before the script exits — that leftover was what made one offline run report "preview never answered", and `--strictPort` turns it into a silent failure.

### Fixed
- Two tests in `stats.test.ts` measured the clock, so they failed whenever the machine was busy (a build running beside them) and passed on an idle one. The 150 000-solve case now has an explicit timeout, and the "single pass over 20 000 solves" case counts how many times the list is read (a Proxy), which a re-sorting or naive rescan blows past by three orders of magnitude. Verified by putting the naive version back: it reads 200 009 990 times against the 120 000 limit.

### Changed
- The F2L tab lists the 41 cases once. A filter row carries speedcubedb's own six groups (Connected Pairs, Corner In Slot, Disconnected Pairs, Edge In Slot, Free Pairs, Pieces In Slot — alphabetical, the same order as their sidebar) with a mastered/total count on each; the four-slot cubes that used to sit above the grid are gone, and the case you open has **FR / FL / BL / BR** tabs instead, so the same case can be read in any slot without leaving it. Each slot still keeps its own progress and its own rotated algorithms; Train schedules all 164 as before.
- A selected case is now looked up in the whole set rather than in the filtered grid, which is what lets the slot tabs open a sibling the current filter does not contain.
- The F2L grid draws each case as a flat `<svg>` (`CaseThumb`) instead of a live CSS-3D scene, and both it and the 3D `CaseCube` read their framing from one new module, `src/lib/ui/caseCubeView.ts` (the pair, the camera angle, the projection, which faces point at the viewer). Measured on a phone-sized viewport, the 41-cell F2L grid settles in 828 ms with 459 ms of blocked main thread and 1,131 DOM nodes, against 4,451 ms, 3,671 ms and 2,931 nodes for the same grid built from CSS-3D cubes. The cube you open in the Library and the Trainer keeps the 3D renderer; the unused three-face culling path is gone with it.

### Added
- A test for the one-time F2L migration (`src/lib/migrate.test.ts`): it seeds a pre-0.5.0 save and checks that F2L progress is cleared, that an algorithm which still solves its case survives while one that solves a different case is dropped, that PLL and OLL progress is untouched, and that a second load does not clear anything again. Verified by disabling the migration and watching the test fail.
- PLL and OLL now come from SpeedCubeDB as well: the standard letter and number naming, each case carrying the algorithm that page marks standard plus up to three further algorithms that the simulator accepts (52 bundled). Nicknames moved to `src/lib/data/oll-names.ts`, and `scripts/check-oll-names.ts` re-checks all 57 against the new algorithms, so the numbering is verified rather than assumed.
- `scripts/gen-lastlayer-scdb.ts` writes both data files and re-checks every line first: F2L must stay solved, the algorithm must solve its own case, and the 21 PLL permutations or 57 OLL orientation patterns must all be distinct.
- The 41 F2L cases are the standard table in the community's numbering, taken from SpeedCubeDB: their case order, their six groups (Free Pairs, Connected, Disconnected, Corner In Slot, Edge In Slot, Pieces In Slot) and, for each case, the highest-voted algorithm that the cube simulator accepts for this slot. So "F2L 23" now means the same case here as in a tutorial.
- `scripts/gen-f2l-scdb.ts` writes the data file and re-checks every line with the simulator first: the case must disturb the front-right pair and nothing else, the alg may be at most 12 moves, and no two cases may be the same shape (compared up to an AUF).
- Each case carries up to three further algorithms from that page as bundled alternatives, so the Library shows the whole set for a case (the default first, then the others at 71 in total) instead of a single line. A bundled algorithm is marked as built-in and cannot be deleted; your own additions sit beside them as before, and any of them can be made the default.

### Fixed
- F2L progress from the old numbering is reset once, because case N is now a different shape than it was: that progress would otherwise schedule the wrong case. Algorithms you added are kept only where they still solve the case they now sit on, and the reset is written to the data so it happens once.

### Changed
- F2L thumbnails in the Library draw only the three faces the fixed camera can actually see, instead of all six faces of every cubie: 57 face elements per cube instead of 156, 2,337 across the grid instead of 6,396. Measured on the grid: main-thread blocks of 94-147 ms each became 54-89 ms, and switching to F2L costs about a third of the paint time it did. The picture is unchanged by construction (a face is only dropped when it was already backface-hidden), which was checked on all 41 cells rather than by eye.
- The F2L algorithms are no longer generated by exhaustive search over R, U and F: `scripts/gen-f2l.ts` and `scripts/write-f2l.ts` are gone.

### Added (shells)
- `src/lib/platform/`: one adapter per shell (web, android, desktop) chosen by `vite --mode`, so the
  back button, the service worker and file save/restore live in one place per shell instead of as
  `if (android)` in views. The builds write `dist-web/`, `dist-android/` and `dist-desktop/`; eslint
  rejects `@capacitor/*` and `@tauri-apps/*` outside that directory, so the boundary cannot rot.
- `npm run build:web|android|desktop`, plus `preview` serving `dist-web/`.
- Settings > About credits the author, links github.com/pham-noah, and offers "Report a problem" (a
  pre-filled GitHub issue carrying the version and shell) and "Open issues".
- The public home is github.com/pham-noah/split-speedcubing: it is what the update check reads and what
  the issue buttons open, because an anonymous request cannot see a private repository.
- `src/lib/core/update.ts`: an opt-in check against GitHub releases (off by default, no device id),
  with the asset matched to the shell — the arm64 APK on Android, the setup exe on desktop. It reports
  the release page; installing stays with the user or the store. A 404 is reported as "no public
  releases", not as a network failure: an anonymous check cannot see a private repository, so the
  releases have to be published publicly for this to find anything.

### Changed
- Release builds are signed with a dedicated key (`android/app/split-release.jks` +
  `android/keystore.properties`, both gitignored) instead of the debug key, so updates install in place.
  A phone holding a debug-signed build needs that one uninstalled once.
- `app.test.ts` waits up to 4 s for a lazy screen chunk instead of 1 s: the old budget failed whenever
  a build ran beside the tests.

### Fixed
- The release check is offered only where it can succeed. `Caps` gained `updateCheck`, the desktop adapter is the
  only one that sets it, and Settings gates on it instead of `kind !== 'web'`. Android declares no `INTERNET`
  permission — that is what makes the app provably offline — so every check there could only ever have reported
  "Could not reach GitHub", with no way for the user to fix it.
- Docs caught up with the app: the README's test and e2e counts (800 and 43, not 795 and 38), its "44 px targets"
  claim (the controls are 34-38 px on purpose), its "strict CSP with no network access" line (the updater needs
  `connect-src https://api.github.com`) and its project layout, which had never listed ZBLL. `PRIVACY.md` no longer
  claims the app never touches the network, and describes the opt-in check in its own section.
- The F-Droid template is named for the real application id (`docs/fdroid/com.noah.split.yml`) and pins 0.5.0 /
  code 5, and `docs/RELEASING.md` no longer tells you to `rm -rf android`, which would have deleted the gitignored
  signing key with it.

### Changed (internals)
- One `mean()` in `core/stats.ts` replaces six hand-rolled copies across the views and panels, so "every displayed
  average uses the same rules" is a single function rather than a habit.
- The `format` script is gone: `prettier --write .` rewrites `app.css` from 790 lines to 1 500 and buries any real
  diff.

## [0.4.0] - 2026-10-26

Trainer polish, and the trainer now grades itself.

### Added
- Train home: the last 30 days at a glance (solves, training attempts, minutes on the clock, days practised), progress per set with a bar each, session averages, BLD memo accuracy.
- Training history: slowest cases and attempts per week.
- Lapsed quick drill, and a penalty row (+2 / DNF / delete) on Train, Library and Drills like the timer has.
- History: "Retry this scramble" puts that solve's scramble straight back into the timer.
- Settings: a backup restore can be undone, and a banner appears if saving or loading ever fails.
- Two rebindable commands for the drills (next scramble, one look / two look); W stays an alias for the new-scramble key.

### Changed
- The trainer grades every attempt from the result instead of recording "Good" every time: a DNF, a case you never recognised, or a very slow solve is recorded as a lapse, so the schedule, the Lapsed drill and the optimiser all see failures.
- Every hardcoded key now goes through the command table, so rebinding really moves every action (S also closes History and Sessions, as before).
- A session starts with Enter or with whatever the timer key is bound to.
- Solves live in their own IndexedDB store now (schema v2, migrated automatically from v1), and a save writes only the records that changed instead of re-cloning and rewriting the whole history: measured at 20 000 solves, 19 ms per save against 2.5 s for the old full rewrite.
- There is a lint gate: `npm run lint` (ESLint + typescript-eslint + eslint-plugin-svelte) runs in CI beside `svelte-check`. Turning it on found ~20 dead variables, three names shadowing others and two `$effect`s that leaned on bare expressions.

### Fixed
- The square overlay when tapping a tab on Android was the platform's tap highlight drawing a rectangle over the round Solve button; it is transparent now (the tab colours already show the press).
- Phones: the tab bar is icons for Train, Library, Drills and Settings, with the label still announced by screen readers and shown in full on the desktop sidebar; Solve stays the round button.
- Phones: the first-run explanation is back on every screen size (an over-eager height rule had cut it), the lone dash the timer showed before your first solve is gone instead of looking like a stray divider, and every button is smaller: .btn 46->38 px, chips 44->34, segmented controls 44->36, tab bar 58->50, the round timer button 172->146 px.
- Tapping the tab bar (or History / Sessions on the timer) no longer throws away a live solve: pointer navigation is blocked while the clock runs, exactly like the keyboard already was. +2 / DNF / Delete also stand down during a run instead of silently penalising the previous solve.
- "Reset progress on this case" now really keeps the algorithms you added and your chosen default; it used to delete the whole card, and the test meant to guard it asserted nothing.
- Train's "Last 30 days" counts the device, like the training attempts and drills beside it, instead of only the current session.
- A screen that throws shows an error card instead of a white page.
- Rebinding a command onto a stock alias (P, W) is refused instead of firing two commands.
- Drills: the BLD memo time no longer picks up the previous drill's penalty before the attempt is recorded.
- `npm run seed` / `npm run screenshots` work again (`vite-node` is a real devDependency).
- Phones: the timer is smaller (last-solve time 48-58 px -> 38-42 px, the running time on the full-screen colour 102-128 px -> 77-80 px), so the Solve screen fits a 640 px phone without scrolling; the first-run explanation is hidden on short screens because the button already says what to do. The session chip is a 44 px tap target like every other control.
- The ao5/ao12 in the side panels and History were plain means, so the panel said 12.40 while the ao5 card on the same screen said 11.00. They now use the same WCA rules as the cards (`runningAverage`, one pass), and a single DNF inside the window no longer blanks the column.
- A DNF'd solve vanished from "Recent solves" instead of showing as DNF.
- A +2 / DNF put on a training attempt reached no number: every average used the raw time and a DNF could still be recorded as your best. Attempt times now go through `attemptExec` everywhere (Train, Library, Train History, the weak-spot list), and non-finite times are excluded from averages and bests.
- "Erase all data" no longer throws away the app's own undo slot: it can be undone like a backup restore.
- Deleting a session (and its solves) is undoable too, and no longer asks through a blocking `confirm()`, matching how deleting a single solve works.
- The attempt panels are real tables for screen readers now (rows grouped, each row read as time / prev / ao5 / ao12), and the import panel refuses files over 5 MB instead of parsing them on the main thread.
- `npm run version:check` now also covers the Android `versionCode` and the per-build store changelog (`fastlane/.../changelogs/<versionCode>.txt`), so a release cannot go out without its "what's new".
- Storage: a failed migration is retried instead of being marked done, and a change to a solve's `event` is written.
- The storage ordering test used fixture ids whose key order already matched time order, so it passed with the sort deleted; it now fails without it.
 ("R2F2R'B'R...") because Svelte drops whitespace inside an each block; Solve, Train and Drills were all affected.
- "Retry this scramble" did nothing: the request was a plain field read once at startup, so the timer never saw it.
- No sideways overflow at Extra large text on a 360 px phone (tab bar, segmented controls, scramble line).
- A solve in progress is no longer thrown away by leaving the screen: Esc / Back stops the clock instead of navigating, tab shortcuts are ignored while the timer runs, and Esc in the Library search box clears the search or closes the case panel.
- CI runs on the branch that exists (master), so the checks the README points at really run on every push; `*.jks` and `*.p12` are ignored so an upload key cannot be committed by accident.
- An imported DNF with no time is no longer deleted on the next launch, and importing the same date-less file twice is recognised as duplicates (invented timestamps are anchored to the start of the day, not the clock).
- Best ao5 / ao12 is a single pass now: it took 0.5 s per call at 20 000 solves, twice per History render.
- A null cards field, or a backup from a newer version, is refused instead of quietly wiping the data.
- ZBLL import reports the file's own line numbers; the weak-spot and lapsed drills follow their own order; right-click no longer starts the timer; a zero delta is not coloured as slower; a fast tab switch on a cold cache can no longer show the wrong screen.
- Undo after deleting a solve puts it back where it belonged in a second or later session (the index was taken from the session's solves and applied to the whole list).
- Drill penalties now reach the numbers: a +2 adds two seconds and a DNF drops out of the average, instead of only lighting up the button.
- "Try again" on a failed screen load really retries it instead of sitting on "Loading…".
- Esc during a solve releases the screen wake lock; `best` no longer spreads the whole list into `Math.min` (a RangeError past ~130k solves); the scramble timeout is cleared; a backup from a newer version says so in the error message.
- Data loss is no longer silent: the pending save is flushed when the app is hidden or closed, write and read errors are shown with a retry, and a backup can no longer bring in NaN/negative times, unknown penalties or duplicate solve ids.
- The IndexedDB connection is opened once instead of once per read and per write, and is closed when another tab upgrades the schema.
- Scramble walkthrough: animation timers are cleared when it unmounts, and a solve started before the first scramble arrived is no longer saved with the "Generating scramble..." text.
- End-to-end suite brought back in line with the UI (penalty keys, reveal instead of a grade dialog, diagram shapes, offline step); it is 31 checks and all of them pass again.
- The four version numbers (package.json, Cargo.toml, tauri.conf.json, Android) agree, and `npm run version:check` fails CI if they drift.

## [0.3.0] - 2026-10-19

Browser/trainer update.

### Added
- 3D scramble walkthrough: the scramble played move by move on a draggable cube, with step / play / reset. Auto-play is a setting (off by default) with a speed choice, and the cube itself can be hidden.
- Case codes: press F in the Library, every case shows a short code (Jb -> jb, OLL 29 -> 29) and typing it opens that case; Enter trains it.
- Train home: last 30 days at a glance (solves, training attempts, minutes on the clock, days practised).
- Sessions: average time and when each session was last used.
- BLD memo drills show how many of the last ten memos were correct.
- +2 / DNF / Delete on Train, Library and Drills (Z / X / C), matching the timer screen.
- W is the next-case / new-scramble key everywhere; N no longer used.
- S returns to the timer from Sessions and History.
- Drills: the two look modes are now called OLL and PLL; F switches between two looks and one look, and one look stops on a single press.
- OLL cases are labelled by name (Sune, Zamboni…) in the Library, and F can find a case by name as well as by code.
- Space starts a Train session and trains the selected Library case.
- A / D switch Drills modes.
- Scramble walkthrough: the left arrow key now plays the move backwards like the ‹ button did, instead of jumping.
- The screen stays awake while the timer runs (where the browser supports a wake lock).
- New quick drill: Lapsed — the cases FSRS marked as lapsed (you got them wrong), up to 15 of them.
- Training history: slowest cases (avg / best / attempts) and an attempts-per-week chart for the last 8 weeks.
- Fixed a crash in training history when two cases had an attempt in the same millisecond.
- Settings: the 23-row shortcut editor is collapsed behind "Show all 23", cutting the page from ~4,900 px to ~1,000 px.
- Cube thumbnails still appear on webviews without IntersectionObserver.
- History: "Retry this scramble" loads that solve's scramble straight back into the timer.
- The web manifest exists in dev too (no more console syntax error on first load), and Solve and the training session have proper page headings.
- Train Today shows progress for every set (mastered / learning / new) with a bar per set.
- If a screen's code fails to download, the app says so and offers Try again instead of a blank page.
- Reset progress on a single case from its panel (two taps, algorithms kept).
- Settings shows when you last exported a backup, and nudges once there is something to lose.
- The case grid renders a screenful immediately and fills the rest of the list in idle time (same look, faster switch).
- Training reveals the case you just did: its name and diagram/cube appear in the side panel after an attempt.
- Start on tap (Settings → Timer), an undo bar after deleting a solve (Solve and History), and the last solve shown against your session average under the timer.
- Session finished summary on End: attempts, best, average.
- Phones: the Library case panel opens as a sheet over the grid.
- Library search (name or case code) and a progress filter: All / New / Learning / Mastered / Due.
- Case sets switch with A and D inside the Library.
- Recognition and algorithm drills are separate modes with their own header; the per-algorithm Train button drills execution only.
- Recent attempts everywhere: last solves (Solve) and last attempts on a case (Train) with deltas against the previous attempt, ao5 and ao12, green when faster and red when slower.
- Settings: accent colour, six cube colours plus a red/orange swap, scramble walkthrough options.
- Hover switches the tabs inside a page (case sets, F2L slots, drill types); the main tabs stay click-only.

### Changed
- Every screen now has a right-hand information column like the trainer: recent attempts (or recent solves) with ao5/ao12 and deltas on top, keyboard shortcuts underneath.
- History has a button on Library and Train, and every solve row carries the same prev / ao5 / ao12 deltas, green when faster and red when slower.
- Training a case from the Library happens inside the Library now, with the trainer's layout and execution-only timing — no recognition phase, no jump to another tab, and no per-algorithm Train button.
- F2L cases follow the usual reference style: a 3D cube, everything grey, only the pair's stickers in colour.
- PLL cases are drawn with arrows instead of colours: one double-headed arrow per swap, a 3-cycle drawn as three, with any AUF removed so the picture is the case itself.
- F2L cases are 3D cubes showing only the slot's pair.
- Solve screen fits a phone without scrolling; the 3D walkthrough is desktop-only.

## [0.2.0] - 2026-10-18

First public-ready version.

### Added
- Solve timer with hold-to-start (touch and keyboard), optional 15 s inspection with beeps, +2 / DNF, best / ao5 / ao12, history with progress chart, and separate sessions.
- Training for PLL (21), OLL (57), F2L (41 cases in each of four slots) and ZBLL (import your own algorithms), with case-specific scrambles, separate recognition and execution timing and generated case diagrams.
- FSRS spaced repetition with a target-recall setting, and optional personalisation of the parameters from your own history (validated on held-out cases).
- Several algorithms per case: choose your default, add your own (checked to solve the case), per-algorithm statistics.
- Drills: cross only, 2-look OLL, 2-look PLL, BLD memo.
- Today screen with due cases, weekly averages, quick drills and "weak spots".
- First-launch intro, empty states, Android Back button handling, rebindable keyboard shortcuts, hideable panels.
- Import from csTimer, CSV, plain lists of times and best-effort JSON (CubeDesk); export and restore of backups.
- Themes (Midnight, AMOLED, High contrast), text size up to 130%, bundled fonts.
- Offline web version (PWA), Android app (Capacitor) and desktop app (Tauri).
- App logo, splash screen, GPL-3.0-or-later licence, privacy policy.

### Fixed
- Random-state scrambles now run in the browser (the scramble worker was loading the app bundle and failing); a timeout falls back to random-move scrambles so the timer never waits.
- Settings no longer overflows sideways at Extra large text on small phones.
- Solve and trainer screens fit their main controls on small phones.

## [0.1.0] - 2026-10-17

Prototype: timer, PLL trainer, simple scheduling.
