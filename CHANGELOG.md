# Changelog

All notable changes to Split. Format based on [Keep a Changelog](https://keepachangelog.com); versions follow [SemVer](https://semver.org).

## [0.3.0] - 2026-10-19

Browser/trainer update.

### Added
- 3D scramble walkthrough: the scramble played move by move on a draggable cube, with step / play / reset. Auto-play is a setting (off by default) with a speed choice, and the cube itself can be hidden.
- Case codes: press F in the Library, every case shows a short code (Jb -> jb, OLL 29 -> 29) and typing it opens that case; Enter trains it.
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
