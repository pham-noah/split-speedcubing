# Split 0.9.0 — UX audit

**Build audited:** 0.9.0 (commit `60de23a`, `package.json` / `src-tauri/Cargo.toml` / `src-tauri/tauri.conf.json` all 0.9.0, build 11)
**Audited:** 2026-11-14, web build (`npm run dev`, vite) driven in Chromium at **390×844**, **360×640**, **1280×860** and the desktop breakpoint pair **1099 / 1100 px**, theme Midnight, `textSize` both 100 % and 130 %, split timing off and on.
**Not covered:** a real Android device / APK run. Back-button and keyboard items below are verified in the browser and in source, not on hardware.

---

## 1. Stack (for downstream workers)

| | |
|---|---|
| One codebase, three shells | **Svelte 5 + TypeScript + Vite**, shipped as browser/PWA (service worker), **Android via Capacitor 8** (`android/`), **desktop via Tauri 2** (`src-tauri/`) |
| Entry | `index.html` → `src/main.ts` → `src/App.svelte` (HTML splash in `index.html`, removed by an effect once `store.ready`) |
| Views | `src/views/` — `Solve`, `Train`, `Library`, `Drills`, `Settings`; `History` and `TrainHistory` are overlays rendered *inside* Solve / Train |
| State | `src/lib/store.svelte.ts` (one `$state` store), persisted to IndexedDB (`src/lib/storage/`) |
| Styling | one global stylesheet `src/app.css` (1506 lines) + scoped `<style>` per component. Tokens in `:root`: `--bg #0f1115`, `--card #181b22`, `--line #2a2f3a`, `--tx #e8eaf0`, `--mu #a3acba`, `--am #f5b83d` (amber = primary), `--bl #5aa9ff` (blue = timer/cover), `--good #59d98a`, `--bad #ff6b6b` |
| Themes | `midnight`, `amoled`, `contrast` — **all dark**; no light theme. `textSize` 100/115/130 % |
| Nav | `src/lib/nav.svelte.ts`: 5 tabs (`train, lib, solve, drills, set`) + a back stack |
| Platform caps | `src/lib/platform/{web,android,desktop}.ts`: `saveFile`, `fileDialogs`, `openLinks`, `updateCheck`, `fullscreen` differ per shell — Settings hides blocks accordingly |

---

## 2. Who this is for, and what they are trying to do

**Intended user:** a speedcuber (3×3 mostly, sub-60 s down to sub-15 s) who practises in short bursts, phone in hand, often offline. Secondary: desktop users who keep Split open beside a cube.

**The job, stated plainly:** *“Time this solve, tell me the number and whether it was good, then tell me what in it was slow and let me drill that.”* Everything else (library, sessions, import/export, themes) is in service of that loop.

**What the app does well against that job:** the timing loop itself is fast and forgiving (1 gesture from the Solve tab, 300 ms hold, fumble guard under 300 ms, cover flood, instant result). The gap between “number” and “what was slow” — the whole point of the 0.8/0.9 split feature — is where this audit finds most of its material.

---

## 3. Screens and flows inventory

Tap counts are from the Solve tab (the launch screen) unless noted, at 390×844.

| # | Screen / flow | Reached by | What it is for | Taps to the core action | States present | Evidence |
|---|---|---|---|---|---|---|
| 1 | **HTML splash** | app launch | holds a blank frame until the store loads | 0 | loading only | code only (`index.html`) |
| 2 | **Intro** (3 slides, modal, focus-trapped) | first run, or Settings → “Show the intro again” | explain timer / trainer / settings | 2 (Next, Next) + 1 to finish, or 1 to Skip | default only; no per-slide art except slide 1 | `00-intro-step1.png` |
| 3 | **Solve** — empty | launch (tab 3 of 5) | the timer | **1** (hold the disc) | empty (hint copy), post-solve, running, cover flood, “Too short”, deleted+Undo | `01-solve-post-solve.png`, `02-solve-2x2.png`, `10-solve-130.png` |
| 4 | **Solve** — with split phases | after a solve with splits on | read the phase breakdown, jump to a drill | 1 per mark during the run; 1 to reach “Drill Cross” after | phases card, “N% of this solve”, drill CTA | `14-split-pill.png`, `15-split-3of3.png`, `16-solve-phases.png` |
| 5 | **Sessions sheet** | tap the `3x3 · Session 1 ▾` chip | switch / rename / delete / create sessions (puzzle-scoped) | 1 | per-session stats line, current highlight, inline create form | `04-sessions.png` |
| 6 | **History** (overlay) | `History · N` button on Solve | 8 stat cards, Phases card, 50-solve chart, solve rows, per-row expand → retry / penalty / clear split / delete | 1 | rows, expanded row, “Show older” paging, delete + Undo, clear-split + Undo | first-session capture (2 solves) — not re-saved |
| 7 | **Train — Today** | tab 1 | what to practise now | 1 (`Start session`) | due-hero, week averages, 30-day stats, progress bars, quick drills (some disabled) | `03-train-today.png`, `13-desktop-train.png` |
| 8 | **Train — session** (recognition → execution) | `Start session`, a case in Library, or “Drill X” from Solve | drill one case at a time | 1 (hold) then 2 taps (recognition, stop) | scramble card, hint, result line, penalties, Skip case, end-of-session summary | `05-train-session.png`, `06-train-result.png` |
| 9 | **Library** — grid | tab 2 | browse mastery per set | 2 (case set, then a case) | set tabs, filter chips, search, dashed “new” cells, lazy grid | earlier capture (PLL grid) |
| 10 | **Library** — case panel | tap a case cell | one case: stats, algorithms, add your own, train, reset | 3 | default alg, alternates, inline “Add algorithm” error state | `07-library-detail.png` |
| 11 | **Drills** | tab 4, or a quick-drill row on Train | Cross / 2-look OLL / 2-look PLL / BLD memo timing | 1 (hold) — 2 for the 2-look modes | mode tabs, “2-look” hint, result, Next / Success–Failed (BLD) | `08-drills-oll.png` |
| 12 | **Settings** | tab 5 | 9 sections in one page | 1 (tab), then scroll/jump | jump bar, seg controls, checkboxes, colour pickers, import, backup, erase + Undo, update check | `09-settings-130.png`, `09b-settings-130-scrolled.png` |
| 13 | **Import panel** (inside Settings) | Settings → paste/drop zone | csTimer / CubeDesk / CSV import with preview | 2 | idle, preview, “No solves found”, >5 MB refusal | code + tests only |
| 14 | **Global states** | anywhere | error / trust | — | load-error banner + retry, save-error banner + retry, chunk-load error card, screen crash boundary, link-open failure banner | code (`App.svelte` 130–200) |

Everything needed for the loop exists. Nothing is a dead end; Back/Esc unwinds overlay → tab → app.

---

## 4. Findings, ranked by impact × effort

`Impact`: **H** = blocks or misleads the core loop, **M** = adds friction / looks broken, **L** = polish.
`Effort`: **S** ≤ half a day, **M** ≈ 1–2 days, **L** > 2 days.

### Must fix for 0.9.0

| ID | Finding | Where | Observed (reproducible) | Impact | Effort |
|---|---|---|---|---|---|
| **U1** | The timer screen no longer fits on a phone once split timing is on | `src/views/Solve.svelte:237-290` (Phases card + stats dock), `src/app.css:325` (`.page.fill` is `min-height`, so content simply grows) | 390×844, one 3×3 solve with a split: document height **889 px** vs 844 viewport — the `Best / ao5 / ao12` row is cut in half behind the tab bar (`16-solve-phases.png`). At 360×640: **808 px** vs 640, and the Phases card (top 508, bottom 656) runs underneath the fixed nav (top 581) — `CROSS / F2L / OLL / PLL` labels visible, times hidden. Requires a scroll on the app's primary screen. | H | M |
| **U2** | The trainer gives no case feedback on a phone | `.side { display:none }` (`app.css:675`) is only re-enabled at **≥1100 px** (`app.css:713`); `Train.svelte:492-517` and `Drills.svelte:299-305` put the case diagram, the **algorithm**, the attempt deltas and the **+2 / DNF / Delete row** inside that aside | After a PLL attempt at 390×844 the visible screen reads `Last 2.36· recog 0.50 · exec 1.86 · Aa-perm` — the case *name* only; the algorithm it was solved with and the diagram are unreachable (`06-train-result.png`, aside measured `0x0`). In Drills the same aside holds `PenaltyRow`, so **a drill cannot be penalised or deleted at all** on a phone. On Android — the shipped mobile target — the trainer teaches recognition but hides the answer. | H | M |
| **U3** | Marking a phase is blind, and the target moves under the finger | `src/lib/ui/TimerPad.svelte:270-282`, `.split-dock` CSS at `TimerPad.svelte:294-324` | The pill reads only `Split 0/3` (`14-split-pill.png`): no phase names, no “next: cross”, no indication that 3 marks = 4 phases in a fixed order. When the first mark lands, `Undo` appears and the pill re-centres — measured shift **x = 120 → 78** (42 px left) mid-solve (`15-split-3of3.png`). Marks are the feature 0.9.0 set out to make correctable; the user is tapping a moving, unlabelled target to produce them. | H | S |
| **U4** | Split timing (and 2×2) are undiscoverable from the first run | `Settings.svelte:188-204` (toggle, ~700 px down a **3450 px** page), `Intro.svelte:6-10` (no slide mentions splits or 2×2), `Solve.svelte` (no affordance) | From launch: Settings tab → jump bar/scroll to Timer → toggle → back to Solve = **4 taps + a scroll**, and the toggle’s own sub-label is the only explanation (`09-settings-130.png`). The intro says nothing about the 0.9.0 headline features, and a new user has no reason to hunt for them: the Solve screen with splits off looks complete. | H | S |
| **U5** | Silent refusals: controls that look live do nothing | `App.svelte:262-281` (`aria-disabled={store.timerRunning}` with **no CSS for `[aria-disabled]`**), `Solve.svelte:220-234` (`disabled` on `+2/DNF/Delete`), `Solve.svelte:146` (`History` disabled) | There is no `:disabled` or `[aria-disabled]` rule anywhere in `app.css` (grep: zero matches). During a running solve the Train tab has `aria-disabled="true"`, computed `opacity: 1`, and clicking it leaves `main h1` unchanged — measured. On a **fresh install** the very first Solve screen shows `+2 / DNF / Delete` fully lit although all three are disabled (no solve yet); tapping `Delete` does nothing and says nothing. Same for the disabled `History` button mid-solve. A user concludes the app is broken rather than blocked. | H | S |

### Post-0.9.0

| ID | Finding | Where | Observed | Impact | Effort |
|---|---|---|---|---|---|
| U6 | History is mostly empty on first serious use | `History.svelte:145-183` | With 2 solves: 8 stat cards, **6 of them `–`**, a 250 px chart drawn as a single diagonal line, and the solve list pushed below the fold. The chart needs a threshold (~10 solves) before it earns that space. | M | S |
| U7 | Settings is one 3450 px page and the jump bar hides 5 of its 9 sections | `Settings.svelte:99-109`, `.secnav` | At 390 the jump bar shows `Appearance Timer Colours Walk…` — 4 chips with the 4th clipped at the screen edge, 5 sections (`Training, Scheduling, Layout, Data, About`) off-screen with no fade, chevron or scroll hint. Reachable by swiping, undiscoverable by looking. | M | M |
| U8 | 130 % text size truncates the controls it is meant to help | `Settings.svelte:115` (`High contrast`) segmented control | At 130 % the theme button reads **`High contr…`** and the jump bar clips `Walk…` (`09-settings-130.png`). The accessibility setting degrades the accessibility of its own screen. | M | S |
| U9 | Two identical segmented rows read as one 8-option control | `Library.svelte:478-500` | `PLL OLL F2L ZBLL` then `All New Learning Mastered Due`, same pill treatment, same amber active state, 12 px apart. Nothing marks the second as a *filter on the first*. | M | S |
| U10 | The same control, two shapes: “History” | `Train.svelte:277` vs `Library.svelte` header | In Train it renders as a **full-width bar** under the title (`.page` is `flex-direction: column`, so `flex:none` stretches) — it reads as a tab strip; in Library it is a right-aligned chip beside the `h1`. Confirmed at 1280 too (`13-desktop-train.png`). | M | S |
| U11 | The desktop side panels disappear 1 px below the shipped window width | `app.css:675/713`, `src-tauri/tauri.conf.json:16` | Measured: viewport 1099 → aside `HIDDEN`; 1100 → aside `250 px`. The Tauri window opens at exactly **1100×760**, so any resize or WM frame shaves the case panel, algorithm and shortcuts rail off a desktop build that is *supposed* to have them. | M | S |
| U12 | Drills teaches nothing and looks like it has controls it does not | `Drills.svelte:183-211, 261-272` | No hint copy (Solve has an empty-state hint; Drills has none), ~260 px of dead space between the disc and the stat cards, and `Cross colour ● Blue` is static text styled like a chip — it is randomised per drill and not tappable. | M | S |
| U13 | Copy and spacing defects, all user-visible | see list | `2x2 · 2x2 ▾` (event badge + auto-named session duplicate, `02-solve-2x2.png`); `learning · 1 attempts`; `Next review in 10 min· recall ≈ 100%`; `Last 2.36· recog 0.50`; `2-look · tap when edges, then stop`; `last 12 of 1 split solves`; `+0.68 vs average` shown in red against a 2-solve session mean. Each is a one-line fix; together they read as an unfinished build. | M | S |
| U14 | Two primaries: the timer is blue, everything actionable is amber | `app.css:19-20`, `input[type='checkbox']:checked { background: var(--bl) }` | `Hold to start` disc, cover flood and checkmarks are `--bl #5AA9FF`; tabs, primary CTAs, active segments and the accent setting are `--am #f5b83d`. Choosing a Green accent repaints `--am` only, so checkboxes and the flood stay blue. Nothing tells the user which colour means “do the thing”. | L | S |
| U15 | Tap targets under the 44 px guideline on the timer screen | `app.css:168` (`.chip` min-height 34), `.seg`, `.btn` | Measured at 390: session chip **110×37**, `History` **116×36**, puzzle segment **92×34**, `New scramble` **154×40**, `+2/DNF/Delete` **115×36** — 8 of 14 targets on the Solve screen are under 44 px tall (all above the WCAG 2.2 24 px floor). | L | S |
| U16 | Intro shifts its own buttons between slides | `Intro.svelte:34,38-41` | The logo renders on slide 1 only, and `Skip` disappears on slide 3: `Next` sits at y ≈ 611 / 573 / 547. A double-tap at the first position misses the second slide entirely (I reproduced this while auditing). No Back between slides. | L | S |

**What already works — do not churn it:** contrast is genuinely clean (I measured every text node on Solve and Settings against its composited background: **0** below its WCAG threshold, and the suite enforces it per theme); the hold→release→run→stop gesture with the colour flood and the 300 ms fumble guard; `Too short` instead of a fake PB; delete + Undo on both Solve and History; the Sessions sheet; the phase bar and “Drill Cross” hand-off; per-case “tap to make it your default” algorithms; `Show older` paging that holds at 50 000 solves.

---

## 5. Top 5 for 0.9.0 — briefs a designer can mock up directly

### 5.1 — U1: make the timer screen fit again (390×844 and 360×640)

**Screens to draw:** Solve, post-solve, split timing **on**, one solve with 4 phases — at 390×844 and 360×640.
**Constraint:** everything currently on the screen must stay reachable **without scrolling**: scramble, `New scramble`, last time, the disc, `+2 / DNF / Delete`, phase summary, `Best / ao5 / ao12`.
**Direction to explore:** the Phases card becomes a **one-row strip** under the penalty row — phase bar (full width, 6 px, as today) with the four phase labels *under* it and only the **worst phase** called out in words (`Cross 45% · Drill Cross`), times on the labels or on tap. The `Best / ao5 / ao12` dock stays, but as one compact row of three. Free the ~120 px the four-column `phrow` block currently takes.
**Must cover in the mockup:** with and without a split solve, 100 % and 130 % text size, and the 360×640 height, where the difference has to be paid for.
**Acceptance:** document height ≤ viewport height at both sizes, no element intersecting the 58 px bottom nav.

### 5.2 — U2: bring the trainer’s answer sheet to the phone

**Screens to draw:** Train session, *after* an attempt, 390×844; and Drills, 390×844, after an attempt.
**Must include (currently desktop-only):**
1. the case **diagram** (the existing `CaseDiagram`, ~96 px) + the case **name** + the **algorithm used** — the single most important missing piece;
2. the `+2 / DNF / Delete` row for **Drills** (Train already shows one inline) — the same `PenaltyRow` component, just placed in the flow for narrow widths instead of in the aside;
3. recent attempts for this case, if it fits without pushing the disc off-screen (2–3 rows, deltas as green/red, same rules as `Deltas.svelte`).
**Direction:** the result line becomes a card under the timer — `Aa-perm · recog 0.50 · exec 1.86`, diagram to the left, algorithm in mono below, penalties right — and the aside keeps its current desktop job (`@media (min-width:1100px)` unchanged).
**State coverage:** before the attempt (no answer revealed), after the attempt, after a DNF, after a penalty, 130 % text.

### 5.3 — U3: tell the cuber which phase they are marking, and stop moving the target

**Screens to draw:** Solve, clock running, split timing on — at 0 marks, 1 mark, 3/3 — 390×844 and 360×640.
**Replace `Split 0/3` with a phase-labelled control.** Two candidate directions to draw side by side:
- **A — labelled pill:** `Split · Cross → F2L → OLL → PLL` with the *current* phase word bolded and the done ones ticked, count as a small `2/4`; the same width at every mark count.
- **B — four-dot rail:** a fixed-width pill with 4 segments that fill left-to-right, the next phase name under the pill, `Undo` **always present but disabled** (so it never appears mid-solve and never shifts the pill).
**Rules for both:** the control must not move or resize between 0/3 and 3/3 marks (today it moves 42 px); the tap area ≥ 48 px tall; `Undo` must never sit within 16 px of the primary hit area in the direction of travel; keep it above the flood (`z-index: 42`) and legible on all five cover colours (the existing dark translucent pill works — reuse it).
**Copy:** the phase order is fixed (`phaseLabels()` in `core/stats.ts`), so the labels can be read from the same source.

### 5.4 — U4: let people find the 0.9.0 features

**Three placements to mock up (all small):**
1. **Solve screen, first run only** — one line under the disc replacing nothing: `Phases? Turn on split timing` + `Turn on` → deep-links to Settings → Timer with the toggle in view. Dismisses for good on use or dismissal.
2. **Intro slide** — extend the existing 3 slides with the split/2×2 story, or add a 4th: `Split a solve into Cross · F2L · OLL · PLL` with the phase bar drawn.
3. **Settings → Timer** — when split timing is toggled on, the explanation that currently appears below the toggle (a paragraph) becomes a one-line confirmation with a `Try it on the timer` button that returns to Solve.
**Acceptance:** from a fresh install, split timing can be on and used in **≤ 3 taps**, and the 2×2 switch on the Solve screen is explained the first time it is used.

### 5.5 — U5: no silent refusals

**Screens to draw:** Solve with the clock running (the whole screen: flood + pill + nav), and the disabled `History` button state.
**Direction:** any control that cannot act must *look* like it cannot act — one shared “blocked” treatment (e.g. 45 % opacity + no press-scale, tokens `--mu` at 60 %) applied to the 4 nav tabs and `History` while `timerRunning`. Add **one** feedback line where the action was attempted: under the nav, `Stop the timer first` (auto-dismiss 1.5 s, `role="status"`). Same treatment for the disabled `Weak spots / Lapsed` rows on Train, which currently explain themselves in a long parenthetical instead of looking disabled.
**Do not** dim the Solve tab (it is the current tab and stays live).

---

## 6. Appendix — measurements used above

| Measurement | Value |
|---|---|
| Solve document height, 1 split solve, 390×844 / 360×640 | **889 px / 808 px** (viewports 844 / 640) |
| Phases card box at 360×640 | top 508, bottom 656; fixed nav top **581** |
| Settings page height, 390×844, 100 % / 130 % | **3450 px / 3784 px** |
| Split pill | **151×50**; x = 120 at 0 marks → **78** at 1+ marks |
| Nav tabs (icon / Solve) | 78×58 / 68×68 |
| Solve controls | chip 110×37, History 116×36, segment 92×34, New scramble 154×40, +2 115×36 |
| Aside visibility | `HIDDEN` at 1099 px, `250 px` at 1100 px; Tauri window width **1100** |
| Text below WCAG contrast threshold (Solve + Settings, Midnight) | **0** nodes |
| Targets < 44 px tall (Solve) | **8 of 14** |

Screenshots: `docs/ux/shots/` — `00-intro-step1`, `01-solve-post-solve`, `02-solve-2x2`, `03-train-today`, `04-sessions`, `05-train-session`, `06-train-result`, `07-library-detail`, `08-drills-oll`, `09-settings-130`, `09b-settings-130-scrolled`, `10-solve-130`, `12-desktop-solve`, `13-desktop-train`, `14-split-pill`, `15-split-3of3`, `16-solve-phases`.

Not captured, verified by reading source only: History overlay (screenshots from the audit run were not saved), Import panel states, the global error banners, `prefers-reduced-motion` behaviour.
