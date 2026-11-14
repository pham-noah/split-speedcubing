# Split 0.9.0 UX changes — implementation mapping and note

Implementer task `t_c8c471cb`. Source of truth: `docs/ux/split-0.9.0-spec.md`, mockups in
`docs/ux/mockups/`. Evidence pack: `docs/ux/evidence/` (index in `evidence/README.md`).
Gates: `npm run check`, `npm test`, `npm run lint` — all green on the tree this note describes.

## 1. Mapping written before editing

Each numbered change → the file(s) that own it. Base commit `60de23a`; every line number below was
checked against that tree, not copied from the spec blindly.

| # | Owns | What changes |
|---|---|---|
| C1 | `src/app.css` `:root` (13–26) | five pill tokens added |
| C2 | `src/app.css` after the `@media (max-width:1099px) .page.fill` block (324) | `.page.solve { padding-bottom: 32px }` |
| C3 | `src/views/Solve.svelte:135`, `src/app.css` | `style="gap:12px"` → `.col.solve-col { gap: 9px }` |
| C4 | `src/views/Solve.svelte:148–161`, `src/app.css` | `.seg` + `New scramble` become one `.setup-row` |
| C5 | `src/views/Solve.svelte:187–195`, `src/app.css` `.timer-slot` (312) | vs-average becomes an absolutely positioned pill |
| C6 | `src/views/Solve.svelte:237–274`, `src/app.css` `.phbar`/`.phrow`/`.ph-l` (1467–1497) | phases card → one 75 px strip with `.pc-row` + `.pc-drill` |
| C7 | `src/views/Solve.svelte:275–290`, `src/app.css` `.stats-dock` (321) | three cards → one `.stats-bar` (new class; `.stats-dock` kept for `margin-top:auto`) |
| C8 | `src/app.css` after `.big` (358) | `@media (max-height:700px)` disc rule |
| C9 | `src/views/Solve.svelte:210–217` | empty-state hint trimmed to one line |
| C10 | `src/views/Train.svelte:458–465`, `src/app.css` | answer card under the timer pad (name, diagram, times, alg) |
| C11 | `src/views/Drills.svelte:230–305` | `<PenaltyRow>` moved out of the aside into the flow |
| C12 | `src/lib/ui/TimerPad.svelte:267–282` | pill contents replaced (rail + next phase + count + always-present Undo) |
| C13 | `src/lib/ui/TimerPad.svelte` scoped `<style>` (291–352) | pill styles v2, on the C1 tokens |
| C14 | `src/lib/ui/TimerPad.svelte:266` | `.sr` live region says `Marked Cross. Next: F2L.` |
| C15 | `src/views/Solve.svelte` (stats slot), `src/app.css` | first-run split-timing nudge |
| C16 | `src/lib/storage/model.ts:8, 15, 120–137` | `splitNudgeSeen` optional field, default, sanitiser |
| C17 | `src/lib/nav.svelte.ts`, `src/views/Settings.svelte` | `settingsFocus` + `onMount` scroll/focus, `#split-toggle` |
| C18 | `src/views/Settings.svelte:198–204` | "Split timing is on" card + `Try it on the timer` |
| C19 | `src/lib/ui/Intro.svelte` (whole file) | 4 slides, Back, fixed three-cell footer, ArrowLeft, trap fix |
| C20 | `src/app.css` | one `:disabled` / `[aria-disabled]` treatment + nav-current exception |
| C21 | `src/App.svelte:104–106, 262–281`, `src/lib/ui/Toast.svelte` (new), `src/views/Solve.svelte:146` | refusal toast |
| C22 | — | verify only (360 dock clearance), folded into C13 numbers |
| C23 | the five files above | the four copy strings (+ C15/C19/C21 strings) |
| C24 | — | proof procedure; run at the end, screenshots into `docs/ux/evidence/` |

Also mapped but deliberately not touched: `docs/ux/*` stays docs-only; version numbers, signing and
store artifacts untouched (release task owns them).

## 2. Deviations from the spec

Everything else in C1–C24 is implemented as written. These are the changes where the spec's letter and
the running app disagreed, or where the spec left a value open.

1. **C7 uses `.card.stats-bar`, not `.stats-bar`.** The phone block's `.card { padding: 12px }` comes
   later in `app.css` at equal specificity and would win, so the bar would be ~10 px too tall (44 px,
   over C7's 38 px ceiling). The markup is `class="card stats-dock stats-bar"`; `.stats-dock` is
   untouched, so Drills keeps its two cards. Measured: **34 px at 100 %, 39 px at 130 %**
   (ceilings 38 / 46).
2. **C14's markup differs from the snippet.** The spec writes a nested ternary containing an
   unbalanced quote (`'(splits ? …`). The implementation keeps the same four strings in a
   parenthesised chain: `All phases marked.` / `Marked X. Next: Y.` / `Timer running, split timing on.`
   / `Timer running`. `aria-atomic="true"` added as specified. Verified after Undo: it re-reads
   `Marked Cross. Next: F2L.`, not the stale sentence.
3. **C19's ArrowLeft needed a fix outside the file the spec names.** See §3 — `ScrambleWalk` swallowed
   every arrow in the capture phase, so ArrowLeft never reached the intro. One guard line was added to
   `src/lib/ui/ScrambleWalk.svelte`: arrows stand down while `[aria-modal="true"]` is on screen. Without
   it the spec's ArrowLeft requirement cannot pass on a fresh install, and arrows were also driving the
   cube behind the modal.
4. **C19's footer columns are `1fr 1fr 1.5fr`, not `1fr 1fr 1fr`.** At 360 px @130 % "Get started" does
   not fit a third of the sheet and wraps, which makes the row taller and moves the primary button —
   the exact defect C19 exists to fix. The last cell is wider; the primary's box is still identical on
   all four slides at 390 and at 360 @130 % (measured, §3).
5. **`Nav.refuse` / `nav.toast` hold the toast message** instead of a local `let toast` in `App.svelte`.
   The control that refuses (the `History` button in `Solve.svelte`) and the toast that explains it are
   in different components; a store field is the same pattern the file already uses for `settingsFocus`
   and `trainSet`. `App.svelte` renders `<Toast>` after `<nav>` exactly as specified.
6. **`go()` in `App.svelte` returns early when the tab is already current.** `nav.go()` already does
   this; without the guard, tapping the Solve tab mid-solve would raise `Stop the timer first` about a
   tab you are already on.

## 3. Verification (C24), measured in the running app

`npm run dev` → `scripts/ux-0.9.0-evidence.mjs` (Chromium, DPR 2, seeded IndexedDB, real pointer events
for every hold/tap). Raw numbers in `docs/ux/evidence/measurements.json`; screenshots indexed in
`docs/ux/evidence/README.md`. Post-solve state: four solves on screen, the last one with four phase
splits, split timing on.

| | 390×844 | 360×640 |
|---|---|---|
| document height, 100 % / 130 % | **844 / 844** (no scroll) | **640 / 640** (no scroll) |
| bottom of stats bar | 754 | 550 (100 %), 563 (130 %, 3-line scramble) |
| top of nav bar | 785 | 581 |
| clearance to nav bar | **31 px** | 31 px (100 %), **18 px** (130 %, 3-line scramble) |
| phase strip | **75 / 83 px** | **75 / 83 px** |
| stats bar | **34 / 39 px** | **34 / 39 px** |
| drill button | ≥ 88 × 44 at 100 % | same |

- **C24.4** passes: no card bottom exceeds `navTop − 16` in any state measured, and the document height
  equals the viewport at both sizes at 100 % and 130 %.
- **C24.5** — `contrast` and `amoled` measured on the same post-solve screen at 390×844: doc 844,
  stats bar 754, strip 75, clearance 31, identical to midnight. Pill tokens resolve in both themes
  (`docs/ux/evidence/c00-theme-*.png`); the pill over the flood on `contrast` is in
  `c13-pill-contrast-390.png` with one rail dash filled.
- **C24.6** — `.split-press` `getBoundingClientRect().x` = **52 at 0, 1, 2 and 3 marks**, dock width
  286 px in all four states (the audit's 42 px jump is gone).
- **C24.7** — fresh install → `Turn on` → Settings with `#split-toggle` focused and the confirmation
  card in view → `Try it on the timer` → Solve. Recorded as `checks.nudgeDeepLink`
  (`focused: split-toggle`, `splitsOn: true`, `cardShown: true`) and `settingsBackToSolve: Solve`.
  The nudge stays dismissed after a reload (`nudgeStillHiddenAfterReload: true`).
- **C24.8** — mid-solve tap on Train: `toast.text = "Stop the timer first"`, view stays `Solve`, toast
  gone after 1.5 s. Nav tabs dim to `opacity: 0.45`, the current tab stays at 1.
- **C24.9** — after an attempt, Train's answer card ends at 507 px (390) / 460 px (360) with the
  diagram, name, times and algorithm; Drills' `+2 / DNF / Delete` row renders once, in the flow
  (`inAside: 0`), ending at 473 / 424 px.
- **C24.10** — one screenshot per change in `docs/ux/evidence/`, plus 13 real **before** frames
  captured from `60de23a` in a throwaway worktree (`before-*.png`), so every "after" has its pair.

### The one number that does not match §5

At **360×640 @130 % with a three-line scramble**, the stats bar ends at **563 px**, not 550: 18 px of
clearance to the nav bar, i.e. **3 px** to the top of the round Solve button instead of the 16 px C2
asks for. `c24-worst-360-130.png` is that frame.

- It is not a scroll or an overlap: `scrollHeight` is still 640, nothing is clipped, and the circle is
  the only thing within 16 px of the bar. C24.4's own test (`card bottom ≤ navTop − 16`) still passes.
- Cause: the scramble goes from 2 to 3 lines at 130 % on a 360 px screen (+40 px). §5's figure was
  measured with a two-line scramble, which is the common case — the same screen measures **550 px and
  31 px of clearance** for it (`c08-short-360-130.png`, `states.c08`).
- Not fixed here on purpose. The two fixes the spec points at both cost the normal case: dropping
  `.big` to `17vh` shrinks the disc 13 px at 100 % too (where the stack already fits exactly), and
  tightening `.col.solve-col`'s 9 px gap departs from C3. Shrinking a 44 px+ target on the shortest
  phone to buy clearance for an edge case is the wrong trade without a design call, so it is flagged
  rather than invented — see §4.

## 4. Deferred / for the next pass

- **360×640 @130 % + 3-line scramble** (§3 above): needs a decision — shrink the disc on short phones
  only, or let the scramble take a tighter line-height at 130 %. 0.9.0 ships without either.
- **§7's 16 parked items are untouched**, as instructed: no History empty-state work, no Settings jump
  bar, no `.seg`/`.chip`/`.btn` target growth (U15), no answer-card/aside dedupe at ≥ 1100 px, no light
  theme, no gamepad layer, no landscape pass beyond C8's `max-height: 700px` rule.
- **Real device** (Android/Tauri) not exercised — the same limit the audit and the spec ran under. The
  evidence is Chromium at the two CSS sizes the app targets.

## 5. Files changed

Source: `src/app.css`, `src/App.svelte`, `src/lib/nav.svelte.ts`, `src/lib/storage/model.ts`,
`src/lib/ui/Intro.svelte`, `src/lib/ui/TimerPad.svelte`, `src/lib/ui/ScrambleWalk.svelte` (one guard,
§2.3), `src/lib/ui/Toast.svelte` (new), `src/views/Solve.svelte`, `src/views/Train.svelte`,
`src/views/Drills.svelte`, `src/views/Settings.svelte`, `src/app.test.ts`,
`src/lib/storage/storage.test.ts`.

Evidence: `scripts/ux-0.9.0-evidence.mjs` (C24 proof harness), `docs/ux/evidence/*` (30 after frames,
13 before frames, `measurements.json`, `README.md`).

Not touched: `package.json`/`package-lock.json`, `src-tauri/Cargo.toml`, `android/`, `fastlane/`,
`CHANGELOG.md`, signing and store metadata — release task (`t_8e502951`) owns all of it.
