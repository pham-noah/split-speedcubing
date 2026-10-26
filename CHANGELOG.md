# Changelog

All notable changes to Split. Format based on [Keep a Changelog](https://keepachangelog.com); versions follow [SemVer](https://semver.org).

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

### Fixed
- Scrambles were drawn without spaces between moves ("R2F2R'B'R...") because Svelte drops whitespace inside an each block; Solve, Train and Drills were all affected.
- "Retry this scramble" did nothing: the request was a plain field read once at startup, so the timer never saw it.
- No sideways overflow at Extra large text on a 360 px phone (tab bar, segmented controls, scramble line).
- Data loss is no longer silent: the pending save is flushed when the app is hidden or closed, write and read errors are shown with a retry, and a backup can no longer bring in NaN/negative times, unknown penalties or duplicate solve ids.
- The IndexedDB connection is opened once instead of once per read and per write, and is closed when another tab upgrades the schema.
- Scramble walkthrough: animation timers are cleared when it unmounts, and a solve started before the first scramble arrived is no longer saved with the "Generating scramble..." text.
- End-to-end suite brought back in line with the UI (penalty keys, reveal instead of a grade dialog, diagram shapes, offline step); it is 29 checks and all of them pass again.
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
