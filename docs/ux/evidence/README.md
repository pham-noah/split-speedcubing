# Evidence pack — Split 0.9.0 UX changes (C1–C24)

Every image here was captured from a running build, not composed. `after` frames come from the
implemented tree via `npm run dev` + `scripts/ux-0.9.0-evidence.mjs`; `before-*` frames come from
`60de23a` (the shipped 0.9.0 tree) served from a throwaway git worktree with the same seed data, so
each pair is the same screen with the same numbers on it. Device pixel ratio 2, theme `midnight`
unless the file name says otherwise; sizes are the CSS viewport.

Raw numbers for everything below: `measurements.json` (sizes, states, checks). Procedure and the one
open deviation: `../implementation-note.md` §3.

## Change → frame

| # | Frame | What it proves |
|---|---|---|
| C1 | — | tokens only (`--pill`, `--pill-edge`, `--pill-rail`, `--pill-rail-on`, `--on-pill`); visible in every pill frame below and in `c00-theme-*` |
| C2, C3, C5, C6, C7 | `c02-c03-c05-c06-c07-solve-390.png`, `…-360.png` | post-solve stack: 9 px gaps, vs-average pill on the disc, 75 px phase strip, one stats bar, nothing under the nav |
| C2/C24 fit | `c24-worst-390-130.png`, `c24-worst-360-130.png` | the **worst** frame of 8 sampled scrambles at 130 % — the case closest to failing (see the note for the 360 px number) |
| C4 | `c04-setup-row-390.png`, `c04-setup-row-360.png` | puzzle segment + `New scramble` in one row, 40 px segment inside a 50 px row |
| C6, C7 @130 % | `c06-c07-solve-130-390.png`, `…-360.png` | strip 83 px, stats bar 39 px, drill button label on two lines, no clipped label |
| C8 | `c08-short-360-130.png` | 360×640 @130 %: 121 px disc, document height 640, stats bar bottom 550 |
| C9, C15, C20 | `c09-c15-c20-fresh-390.png`, `…-360.png` | first run: one-line hint, split nudge in the stats slot, `+2/DNF/Delete` dimmed to 0.45 |
| C10 | `c10-train-answer-390.png`, `c10-train-answer-360.png` | Train after an attempt: diagram, case name, recog/exec, algorithm — all on screen at 390 |
| C11 | `c11-drills-penalty-390.png`, `c11-drills-penalty-360.png` | Drills: `+2 / DNF / Delete` in the flow, rendered once (`inAside: 0`) |
| C12 | `c12-pill-0-marks-390.png`, `c12-pill-1-marks-390.png`, `c12-pill-3-marks-390.png` | rail 0/1/3 filled, label `Next: Cross` → `Next: F2L` → `All marked`, press disabled at 3, Undo disabled at 0 |
| C13 | `c13-pill-contrast-390.png` | the pill over the blue flood on `contrast` — one rail dash filled, label and Undo legible |
| C14 | `c14-all-marked-390.png` | the frame whose live region reads `All phases marked.` (Undo re-read is in `measurements.json → checks.undoAnnounce`) |
| C17 | `c17-settings-arrival-390.png` | arriving from the nudge: Timer heading at the top, `#split-toggle` focused |
| C18 | `c18-settings-confirm-390.png` | "Split timing is on" card + `Try it on the timer` under the toggle |
| C19 | `c19-intro-slide-1..4-390.png`, `c19-intro-slide-4-360-130.png` | four slides, Back on all of them, `Next` in the same box on every slide (390 and 360 @130 %) |
| C20, C21 | `c20-c21-toast-mid-solve-390.png` | mid-solve: other tabs at 0.45, current tab live, `Stop the timer first` toast above the dock |
| C24.5 | `c00-theme-contrast-390.png`, `c00-theme-amoled-390.png` | the same post-solve screen in the two other themes — hairlines, strip and cards all read |

## Before / after pairs

| Before (`60de23a`) | After | Shows |
|---|---|---|
| `before-solve-390.png`, `before-solve-360.png` | `c02-c03-c05-c06-c07-solve-390.png`, `…-360.png` | three stat cards → one bar; `+0.68 vs average` row → pill; 148 px phases card → 75 px strip; two rows of puzzle/new scramble → one |
| `before-solve-390-130.png`, `before-solve-360-130.png` | `c06-c07-solve-130-390.png`, `…-360.png` | at 130 % the old stack pushed the phase times under the tab bar; the new one does not |
| `before-train-390.png` | `c10-train-answer-390.png` | one grey line of numbers → answer card with diagram and algorithm |
| `before-drills-390.png` | `c11-drills-penalty-390.png` | penalties were in a `display:none` aside below 1100 px |
| `before-pill-0-marks-390.png`, `before-pill-1-marks-390.png` | `c12-pill-0-marks-390.png`, `c12-pill-1-marks-390.png` | unlabelled `Split 0/3` pill that shifted 42 px when Undo appeared → fixed-width pill with a named phase |
| `before-fresh-390.png`, `before-fresh-360.png` | `c09-c15-c20-fresh-390.png`, `…-360.png` | `–` stat cards and live-looking penalties → nudge + dimmed penalties |
| `before-intro-1-390.png`, `before-intro-3-390.png` | `c19-intro-slide-1-390.png`, `c19-intro-slide-3-390.png` | 3 slides, moving footer → 4 slides, fixed footer, new split slide |
| `before-settings-timer-390.png` | `c18-settings-confirm-390.png` | paragraph that appeared on toggle → confirmation card with a route to the timer |
