# Split 0.9.0 — UX implementation spec

**For:** the implementer of `t_c8c471cb`. **Build:** 0.9.0 (`60de23a`), Svelte 5 + Vite, Capacitor Android, Tauri 2.
**Scope:** the five findings the audit called must-fix for 0.9.0 (U1–U5). Nothing else is redesigned; everything else is parked in §7.
**Source of truth for the look:** `docs/ux/mockups/*.png`. Every number in this file was taken from the app's own CSS or from a render of it, never invented. Where a mockup and this file disagree, this file wins and the difference is called out.

How to use it: work **C1 → C24 in order**. Each change names the file and line, the exact before/after, the states it must cover, and how to prove it is done. The token sheet (§2) is the only place colours, sizes and durations are defined — do not inline a new hex, px value or easing curve anywhere else.

---

## 1. What is fixed before you start

| | |
|---|---|
| **Do not change** | gameplay, timing, fumble guard, scoring, scheduling, data format, version numbers, signing, store artifacts |
| **Do not add** | dependencies, fonts, frameworks, icon sets, animation libraries |
| **Reuse** | `src/app.css` tokens and classes, `PenaltyRow.svelte`, `CaseDiagram`/`CaseCube`, `TimerPad.svelte`, the existing `--am`/`--bl`/`--mu` language |
| **Gates that must stay green** | `npm run check`, `npm test`, `npm run lint` |
| **Themes** | all three (`midnight`, `amoled`, `contrast`) — there is no light theme; every new rule must read correctly on `--bg` `#000` with `--line` `#fff` |
| **Text size** | 100 %, 115 %, 130 % — 130 % is an accessibility setting, so every screen here must survive it |

**Not in the app and not to be invented:** there is no gamepad layer in 0.9.0 (`grep -r gamepad src/` → 0 hits) and no hover-only affordance on touch. Keyboard parity is complete and is specified per change; gamepad support is parked (§7.14).

**Mockup index**

| Finding | Mockup | Panels |
|---|---|---|
| U1 | `docs/ux/mockups/u1-solve-fit.png` | before/after at 390×844 and 360×640, split timing on |
| U1 @130 % | `docs/ux/mockups/u1-solve-130.png` | before/after at 390 and 360, text 130 % |
| U2 | `docs/ux/mockups/u2-train-answer.png` | Train before / after / after-DNF / after @130 % |
| U2 | `docs/ux/mockups/u2-drills-penalty.png` | Drills before / after |
| U3 | `docs/ux/mockups/u3-split-pill.png` | shipped pill vs candidate A vs **candidate B** at 0/1/3 marks |
| U4 | `docs/ux/mockups/u4-discovery.png` | first-run nudge before/after, new intro slide, Settings confirmation |
| U5 | `docs/ux/mockups/u5-blocked.png` | fresh install before/after, running before/after + toast |

The mockups were produced by `docs/ux/mockups/src/frame.html` (the app's real `src/app.css` + the proposed rules in a `media="not all"` block) and composed by `src/compose.py`. To re-render a frame after changing the app: serve the repo with `npm run dev`, open `http://localhost:5173/docs/ux/mockups/src/frame.html?v=u1-after-390` at that device size with DPR 2, capture 390×844, then `python compose.py` from `src/`. Do not hand-edit the PNGs.

**Design decision already taken:** U3 ships **candidate B** (the fixed three-dash rail). Candidate A (four phase names in the pill) is rejected: its width has to grow as names tick off, which is the defect being fixed. Do not implement A.

---

## 2. Tokens — by value

### 2.1 Colour (existing, unchanged)

| Token | midnight | amoled | contrast |
|---|---|---|---|
| `--bg` | `#0f1115` | `#000` | `#000` |
| `--card` | `#181b22` | `#0b0b0d` | `#000` |
| `--line` | `#2a2f3a` | `#22262e` | `#fff` |
| `--tx` | `#e8eaf0` | — | `#fff` |
| `--mu` | `#a3acba` | — | `#e0e0e0` |
| `--am` (primary) | `#f5b83d` | — | `#ffe600` |
| `--bl` (timer / cover) | `#5aa9ff` | — | `#00d5ff` |
| `--on-am` | `#1a1300` | — | — |
| `--good` | `#59d98a` | — | — |
| `--bad` | `#ff6b6b` | — | — |

A dash means "same as midnight". `--am` is also user-replaceable by `accent` (`#5AA9FF`, `#59D98A`, `#FF6B6B`, `#B58CFF`, `#F2F2F2`) — anything you colour `var(--am)` must stay legible in all six accents and in `contrast`, so never colour text with `--am` at a size below 0.8 rem.

### 2.2 Colour (new — add to `src/app.css :root`, C1)

| Token | Value | Used by |
|---|---|---|
| `--pill` | `rgba(10, 12, 16, 0.66)` | split pill + Undo, over the cover flood |
| `--pill-edge` | `rgba(255, 255, 255, 0.26)` | their 1 px border |
| `--pill-rail` | `rgba(255, 255, 255, 0.26)` | unfilled rail dash |
| `--pill-rail-on` | `#fff` | filled rail dash |
| `--on-pill` | `#fff` | pill text on all five floods |

There is **no new hue**. Everything else is an existing token.

### 2.3 Type

| Role | Font | Size / line-height / weight |
|---|---|---|
| UI default | Manrope (body copy in `app.css`) | 1 rem / 1.5 / 400 |
| Section label `.mu` | Manrope | 0.85 rem / 1.4 / 600, `--mu` |
| Stat label (`.stats-dock .mu`) | Manrope | 0.64 rem / 1.3 / 600, `--mu` |
| Stat value (`.stats-dock b`) | JetBrains Mono | 0.92 rem / 1.2 / 800, `--tx` |
| Phase label `.ph-l` | Manrope | 0.58 rem / 1.3 / 700, `--mu`, `letter-spacing: .06em`, `uppercase`, `nowrap` |
| Phase time `.ph-t` | JetBrains Mono | 0.8 rem / 1.25 / 800, `--tx` (`.worst` → `--am`) |
| Phase delta `.ph-d` | JetBrains Mono | 0.58 rem / 1.25 / 700, `--good` or `--bad` |
| Answer name `.ac-name` | Manrope | 0.95 rem / 1.3 / 800, `--tx` |
| Answer times `.ac-times` | JetBrains Mono | 0.74 rem / 1.45 / 600, `--mu` |
| Algorithm `.ac-alg` | JetBrains Mono | 0.82 rem / 1.45 / 600, `--tx` |
| Pill label `.sp-label` | Manrope | 0.86 rem / 1.2 / 800, `--on-pill`, `letter-spacing: .02em` |
| Pill count `.sp-n` | JetBrains Mono | 0.74 rem / 1 / 800, `opacity: .8` |
| Undo label | Manrope | 0.82 rem / 1 / 800, `--on-pill` |
| Toast | Manrope | 0.82 rem / 1.3 / 700, `--tx` |
| Nudge text `.sn-txt` | Manrope | 0.74 rem / 1.35 / 600, `--mu`; `<b>` `--tx`, 800 |
| Drill button `b` / `span` | Manrope / JetBrains Mono | 0.72 rem / 1.2 / 800; 0.6 rem / 1.2 / 700 `--mu` |

Type scale stays in `rem` so `html { font-size: 130% }` still scales everything (the app never sets a fixed px font size on these elements).

### 2.4 Space, radius, motion, z-index

| | |
|---|---|
| Spacing unit | 2 px. Gaps used: 2, 6, 8, 9, 10, 12, 16 |
| Radius | `10px` control, `18px` card, `999px` pill/chip, `3px` rail dash, `6px` phase bar (`3px` when the bar is 6 px tall, C6) |
| Card padding | `16px` default; `8px 12px 9px` phase strip; `10px 12px` answer card; `9px 12px` nudge |
| Motion — press | `transform: scale(.95)` on `:active`, `transform .12s ease` (pill); the app's shared system is `transform .26s cubic-bezier(.34, 1.46, .64, 1)` for `.btn/.chip/.seg/nav` — do not add a third curve |
| Motion — colour | `background-color .12s ease, border-color .12s ease, color .12s ease` (already global) |
| Motion — none | `@media (prefers-reduced-motion: reduce)` → no transform at all; the toast must still appear (opacity only, no slide) |
| z-index | phase strip and cards: auto; **split dock `42`**; toast **`60`** (above dock and nav) |
| Nav | bar `58px` tall, round Solve button `68×68` with `margin-top: -26px` → it reaches **15 px above** the bar |
| Safe area | every fixed element keeps `env(safe-area-inset-bottom)` |

---

## 3. Change list

Numbered top to bottom; each is shippable on its own and none depends on a later one.

### C1 — Add the pill tokens to `:root`

**File:** `src/app.css`, `:root` block ending line 27.
**Before:** the five pill colours exist only inside `TimerPad.svelte`'s scoped `<style>`.
**After:** append `--pill`, `--pill-edge`, `--pill-rail`, `--pill-rail-on`, `--on-pill` with the values in §2.2. No other rule changes in this step.
**Why:** C12/C13 move them out of the component so the spec has one definition and the toast/pill can be checked against one table.
**States:** none (tokens only). **A11y:** none. **Done when:** `grep -c -- '--pill' src/app.css` ≥ 5 and `npm run check` is clean.

### C2 — Stop the Solve page padding for a bar it already subtracted

**File:** `src/app.css` — add after the `@media (max-width: 1099px) { .page.fill { … } }` block (line 325).
**Before:** `.page` (line 107) has `padding: 14px 18px calc(104px + env(safe-area-inset-bottom))`. `.page.fill` already sets `min-height: calc(100dvh − 58px)`, so on Solve the extra 104 px of bottom padding is a dead band the content cannot use — measured 73 px of grey under the stats bar at 390×844.
**After:**

```css
@media (max-width: 1099px) {
  .page.solve { padding-bottom: calc(32px + env(safe-area-inset-bottom, 0px)); }
}
```

32 px clears the round Solve button's 15 px overhang with 16 px to spare.
**States:** all. **A11y:** none. **Done when:** the bottom of the stats bar sits ≥ 16 px above the top edge of the round button at 390×844 and 360×640.

> **Read this before you measure.** `.timer-slot { margin-block: auto }` inside a column with `flex: 1` means freed height is *absorbed by the timer's own margins* whenever the stack is shorter than the viewport. So at 390×844 the document height barely moves while the disc grows — that is the layout working, not failing. The measurement that matters is `scrollHeight` vs viewport and "does any card end below the nav": at 390 the shipped build ends 2 px behind the round button; at 360 it is 182 px behind. Expect C2–C9 together to be worth ~198 px at 360 and ~18 px of visible content at 390.

### C3 — Tighten the Solve column

**File:** `src/views/Solve.svelte:140` (`<div class="col" style="gap:12px">`), `src/app.css`.
**Before:** 12 px between every row of the Solve stack.
**After:** `<div class="col solve-col">` and

```css
.col.solve-col { gap: 9px; }
```

**States:** all. **Done when:** no row overlaps and the total stack is 3 px × (rows−1) shorter.

### C4 — One row for puzzle + New scramble

**File:** `src/views/Solve.svelte:147-163` (the `.seg` block and the `New scramble` button are two separate rows), `src/app.css`.
**Before:** `.seg` (`width: 9.5rem`, `align-self: flex-start`) on its own line, then a 40 px `New scramble` button on the next, centred.
**After:** wrap both in one element, and add

```css
.setup-row { display: flex; align-items: stretch; gap: 8px; }
.setup-row .seg { flex: 0 0 7.6rem; }
.setup-row .seg button { flex: 1 1 0; min-height: 40px; padding: 0 6px; }
.setup-row .new-scramble { flex: 1 1 auto; min-height: 50px; }
```

Markup:

```svelte
<div class="setup-row">
  <div class="seg" role="group" aria-label="Puzzle">
    {#each ['333', '222'] as e (e)}
      <button class:on={event === e} aria-pressed={event === e}
        onclick={() => store.setEvent(e as '333' | '222')}>{EVENT_NAME[e]}</button>
    {/each}
  </div>
  <button class="btn new-scramble" onclick={newScramble}>New scramble</button>
</div>
```

Both `3x3`/`2x2` buttons must be **40 px** tall inside a 50 px row; the row is the target, so a misplaced tap between them still lands on the segment. The `New scramble` button keeps `min-height: 50px` — it is the second most-tapped control on the screen.
**States:** default; `2x2` active (`class:on` + `aria-pressed`); scramble still generating (`New scramble` unchanged, no disabled state — see C9); 130 % (labels never wrap: `.seg button { white-space: nowrap; overflow: hidden; text-overflow: ellipsis }` is already global).
**A11y:** group label `Puzzle` unchanged; 44 px floor is met by `New scramble` (50) and not by the segment (40) — the segment is pre-existing (U15, parked); do not shrink it further.
**Done when:** the two rows collapse to one at 390 and 360 with no clipped label at 130 %.

### C5 — Move "vs average" out of the stack and onto the timer

**File:** `src/views/Solve.svelte:171-179`, `src/app.css` `.timer-slot` (line 312).
**Before:** a full-width centred line `+0.68 vs average` in its own flex row (~20 px + 9 px gap).
**After:** an absolutely positioned pill at the top-right of the timer slot; `.timer-slot { position: relative; }` (add) and

```css
.vs-avg {
  position: absolute; top: -4px; right: 0;
  font: 800 0.76rem/1 'JetBrains Mono', monospace;
  padding: 4px 8px; border-radius: 999px;
  background: var(--card); border: 1px solid var(--line);
}
.vs-avg.good { color: var(--good); }
.vs-avg.bad { color: var(--bad); }
```

Markup — keep the existing `vsAvg` derivation and the exact strings, drop the word "vs average" from the visible text and keep it in the accessible name:

```svelte
<span class="vs-avg" class:good={vsAvg < 0} class:bad={vsAvg >= 0}
      aria-label="Compared with your session average">
  {vsAvg < 0 ? '−' : '+'}{(Math.abs(vsAvg) / 1000).toFixed(2)}
</span>
```

The minus sign is **U+2212 `−`**, not a hyphen (already the case). Copy change: the visible string becomes `+0.68` / `−0.68`; the sentence moves to `aria-label`.
**States:** absent when `vsAvg == null` (fewer than 2 solves, or a DNF last solve — unchanged rule); `good` when faster; `bad` when slower; 130 % (pill grows leftwards, it is right-anchored, never pushes the disc).
**A11y:** contrast 9.61:1 (`--good`) and 6.21:1 (`--bad`) on `--card` at 100 %, ≥ 6.2:1 at all sizes; it is not a control.
**Done when:** the timer disc's centre does not move more than 2 px between a state with and without the pill.

### C6 — The Phases card becomes a one-row strip

**File:** `src/views/Solve.svelte:237-283` (the whole `{#if split}` card), `src/app.css` (`.phbar` line 1467, `.phrow` 1480, `.ph-l` 1488).
**Before:** a card with a header row (`Phases` + `vs your last 12 splits`), a 9 px bar, a four-column `phrow` of label + 0.95 rem time + delta (≈ 62 px), then a footer row with `Cross is 50% of this solve` + a 32 px `Drill Cross` button — **148 px** (measured at 360×640: top 508, bottom 656). At 360×640 this card is the block that runs under the tab bar (nav top 581): `CROSS / F2L / OLL / PLL` visible, times hidden.
**After:** the same information in **one 75 px strip**: 6 px bar, then one row of four phases (label over time over delta) with the drill button at the right.

```css
.phases-card { padding: 8px 12px 9px; }
.phases-card .phbar { height: 6px; border-radius: 3px; }
.pc-row { display: flex; align-items: stretch; gap: 8px; margin-top: 6px; }
.pc-row .phrow { flex: 1 1 auto; margin: 0; gap: 6px; }
.phases-card .ph-l { font-size: 0.58rem; letter-spacing: 0.06em; line-height: 1.3; }
.phases-card .ph-t { display: block; font-size: 0.8rem; font-weight: 800; line-height: 1.25; white-space: nowrap; }
.phases-card .ph-t.worst { color: var(--am); }
.phases-card .ph-d { display: block; font-size: 0.58rem; font-weight: 700; line-height: 1.25; white-space: nowrap; }
.pc-drill {
  flex: none; width: auto; min-width: 88px; min-height: 44px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;
  padding: 0 10px; border-radius: 10px;
}
.pc-drill b { font-size: 0.72rem; font-weight: 800; white-space: nowrap; }
.pc-drill span { font: 700 0.6rem/1.2 'JetBrains Mono', monospace; color: var(--mu); }
```

`width: auto; min-width: 88px` plus `white-space: nowrap` on the label is not cosmetic: with a fixed 88 px the button wraps to **three** lines at 130 % (`Drill / Cross / 50%`), 58 px tall, and the whole strip grows to 89 px. Letting the button take the width it needs keeps the label on two lines and the strip at 83 px at 130 % (measured, both widths).

Markup (replaces lines 237-283; `split`, `phaseAvg`, `comparable`, `worst`, `drill()` all stay):

```svelte
{#if split.length}
  <div class="card phases-card" aria-label="Phase splits for the last solve">
    <div class="phbar" aria-hidden="true">
      {#each split as ms, i (i)}<span style="flex:{ms};opacity:{1 - i * 0.19}"></span>{/each}
    </div>
    <div class="pc-row">
      <div class="phrow" style="grid-template-columns:repeat({split.length},minmax(0,1fr))">
        {#each split as ms, i (i)}
          {@const avg = phaseAvg[i]}
          {@const d = avg == null ? null : ms - avg}
          <div>
            <div class="ph-l">{phaseLabels(split.length)[i]}</div>
            <b class="ph-t mono" class:worst={worst?.label === phaseLabels(split.length)[i]}>{formatTime(ms)}</b>
            {#if comparable && d != null && Math.abs(d) >= 60}
              <span class="ph-d mono" style="color:{d < 0 ? 'var(--good)' : 'var(--bad)'}">
                {d < 0 ? '−' : '+'}{(Math.abs(d) / 1000).toFixed(2)}
              </span>
            {/if}
          </div>
        {/each}
      </div>
      {#if worst}
        <button class="btn pc-drill" onclick={() => drill(worst.label)}
          aria-label="{worst.label} is {worst.share}% of this solve. Drill {worst.label}.">
          <b>Drill {worst.label}</b><span>{worst.share}%</span>
        </button>
      {/if}
    </div>
  </div>
{/if}
```

Notes the implementer must not "improve" away:
- The header row and the sentence `Cross is 50% of this solve` are **deleted**; the share moves onto the button (`Drill Cross` / `50%`), the "vs your last 12 splits" caption moves nowhere — the deltas under each time already say what they are compared with, and the drill button's `aria-label` states the share for screen readers.
- `worstPhase()` returns `{ label, share } | null`, not an index (`src/lib/core/stats.ts:151`), so the "worst" cell is matched by label as shown above — do not change its arithmetic or its "largest marked trainable phase" rule.
- With a 2-mark split (`['Cross','F2L','Rest']`) the grid is `repeat(3,…)` and everything still fits: the strip is the same height at 3, 4 and 2 segments because no cell wraps.
- `worst` may be `null` (no trainable phase) → the button is omitted and `.phrow` takes the width.

**States:** default; `comparable === false` (no deltas, `.ph-t` only — the strip is ~12 px shorter, that is fine); 2, 3 and 4 segments; `worst === null`; 130 % (times stay `nowrap`, labels ellipsis at 4 columns — accept `CROS…` only below 340 px, verify at 360).
**A11y:** the card keeps `aria-label="Phase splits for the last solve"`; the drill button is 88×44 at 100 % and 98×52 at 130 % (meets the 44 px floor at every size), its accessible name includes the phase and the share; the bar stays `aria-hidden` (the times carry the meaning); `--am` on 0.8 rem bold on `--card` = 9.69:1.
**Done when:** the strip measures **75 px at 100 %** and **83 px at 130 %** — measured in the real app at 390×844 and 360×640 with one 4-phase solve, not estimated (see C24.4). Anything above 86 px means the drill button wrapped again or a cell wrapped its delta.

### C7 — The stats dock becomes one bar

**File:** `src/views/Solve.svelte:276-289`, `src/app.css` (`.stats-dock`, line 321).
**Before:** three bordered `.card`s (66 px), each with a label above a value.
**After:** one bordered bar, three columns split by a hairline, label beside value — **36 px**.

Use a **new class name**. `.stats-dock` is shared with Drills (`src/views/Drills.svelte:274` renders `<div class="row stats-dock">` with `.card` children), so restyling `.stats-dock` turns Drills' two cards into a squashed grid — that is exactly what an earlier render of `u2-drills-penalty.png` showed, and why that sheet was re-rendered. The Solve bar keeps `.stats-dock` (for its `margin-top: auto`) and adds `.stats-bar` for the layout:

```css
.stats-bar {
  display: grid; grid-template-columns: repeat(3, 1fr);
  padding: 7px 0; gap: 0; margin-top: auto;
}
.stats-bar > div {
  display: flex; align-items: baseline; justify-content: center; gap: 5px;
  min-width: 0; padding: 0 6px;
}
.stats-bar > div + div { border-left: 1px solid var(--line); }
.stats-bar .mu { font-size: 0.64rem; }
.stats-bar b { font-size: 0.92rem; line-height: 1.2; white-space: nowrap; }
```

Markup:

```svelte
{#if store.shown('solve.stats')}
  <div class="card stats-dock stats-bar" role="group" aria-label="Session statistics">
    <div><span class="mu">Best</span><b class="mono num">{formatTime(best(solves))}</b></div>
    <div><span class="mu">ao5</span><b class="mono num">{formatTime(averageOf(solves, 5))}</b></div>
    <div><span class="mu">ao12</span><b class="mono num">{formatTime(averageOf(solves, 12))}</b></div>
  </div>
{/if}
```

Keep the `{#key …}` wrappers if they are what animates a changed value — the key blocks exist to retrigger the value animation, so keep `{#key formatTime(best(solves))}` around each `<b>`.
**States:** empty (`–` for each, still one bar); 130 % (the three values stay on one line — at 130 % the longest, `15.08`, is ~62 px, the column is ≥ 108 px at 360); `solve.stats` hidden in Settings → whole bar absent (unchanged).
**A11y:** `role="group"` + label; contrast `--mu` on `--card` 7.52:1, `--tx` 14.33:1; values are not announced on change (they never were — the `sr` live region in `TimerPad` already announces the time).
**Done when:** the bar is one card and ≤ 38 px tall at 100 % and ≤ 46 px at 130 %.

### C8 — Give the disc room on a short phone

**File:** `src/app.css` after `.big` (line 358), and `.timer-slot` (line 312).
**Before:** `.big` is `min(180px, 23vh)` with `min-width/height: 128px` → on a 640-tall phone it is 147 px, and at 130 % the scramble's third line eats that back.
**After:**

```css
@media (max-height: 700px) {
  .timer-slot { gap: 4px; }
  .big { width: min(168px, 19vh); height: min(168px, 19vh); min-width: 116px; min-height: 116px; }
}
```

At 640 tall: 19vh = 121 px, i.e. a 121 px disc with a 116 px floor — still the largest thing on the screen and still ≥ 44 px by a wide margin.
**States:** 360×640 with and without a split solve; 130 %; landscape phones (max-height 700 also catches a 740×360 landscape — the disc becomes 116 px, correct).
**Done when:** at 360×640 @130 % with one split solve, `document.documentElement.scrollHeight <= 640`.

### C9 — Trim the empty-state hint to one line

**File:** `src/views/Solve.svelte:210-218`.
**Before:** bold `Ready for your first solve` + `Hold the big button (or the spacebar) until it says Release, then let go to start. Tap anywhere to stop.` — three lines at 360.
**After:** `Hold until it says Release, let go to start, tap to stop.` (one line at 360 @100 %, two at 130 %) and `<div class="empty" style="padding:0">`. The keyboard parenthesis is deleted here because the same hint is in the intro, in Settings → Layout shortcuts and in `ShortcutsSide` on desktop.
**States:** first run only (`{#if !solves.length}`, unchanged); with the nudge present (C15) the hint and the nudge are both on screen — verify they do not both claim the bottom slot: the hint sits under the disc, the nudge takes the stats-dock slot.
**Done when:** at 360×640 the fresh-install screen has no scroll with hint + nudge + disabled pens.

### C10 — The trainer's answer sheet, in the flow

**File:** `src/views/Train.svelte:456-466`, `src/app.css` (append near the phase-strip rules).
**Before:** after an attempt the phone shows one grey line: `Last 2.36 · recog 0.50 · exec 1.86 · Aa-perm`. The diagram and the algorithm live in `<aside class="side">` (`app.css:675`), which is `display: none` below **1100 px** — so the answer is unreachable on every phone.
**After:** a card under the timer pad, three lines in two columns:

```css
.answer-card {
  display: grid; grid-template-columns: 64px minmax(0, 1fr);
  gap: 2px 10px; align-items: start;
  padding: 10px 12px;
}
.answer-card .ac-diagram { grid-row: span 2; }
.answer-card .ac-name { font-weight: 800; font-size: 0.95rem; line-height: 1.3; }
.answer-card .ac-times { font: 600 0.74rem/1.45 'JetBrains Mono', monospace; color: var(--mu); }
.answer-card .ac-alg {
  grid-column: 1 / -1; margin-top: 8px;
  font: 600 0.82rem/1.45 'JetBrains Mono', monospace; color: var(--tx);
  word-break: break-word; user-select: text; -webkit-user-select: text;
}
```

Markup, replacing the `{#if result}` grey line (keep the `{:else}` hint line exactly as it is):

```svelte
{#if result}
  <div class="card answer-card" aria-label="The case you just did">
    {#if current.set === 'F2L'}
      <div class="ac-diagram"><CaseCube {alg} slotId={current.slot} size={64} /></div>
    {:else}
      <div class="ac-diagram"><CaseDiagram {alg} mode={current.set === 'OLL' ? 'oll' : 'pll'} size={64} slot={current.slot} /></div>
    {/if}
    <div>
      <div class="ac-name">{current.name}{#if current.nick} ({current.nick}){/if}</div>
      <div class="ac-times">{#if result.recog != null}recog {formatTime(result.recog)} · exec {formatTime(result.ms - result.recog)}{:else}{formatTime(result.ms)}{/if}</div>
    </div>
    {#if alg}<div class="ac-alg">{alg}</div>{/if}
  </div>
{:else}
  … existing hint line, unchanged …
{/if}
```

Rules:
- `CaseDiagram` and `CaseCube` accept only their declared props in Svelte 5 (`alg`, `mode`, `size`, `slot` / `alg`, `slotId`, `size`) — **no `class`** — so each is wrapped in a plain `<div class="ac-diagram">` to carry the grid placement. Do not add a `class` prop to those components.
- **Drill mode** (`drill != null`) has no recognition split: show the time in `.ac-times` as `2.36` instead of `recog … · exec …` (there is no `result.recog`) — the `{:else}` branch above does exactly that.
- If the case has no algorithm yet (`alg === ''`), the `.ac-alg` line is omitted and the card is 2 lines — do not print an empty box.
- The DNF state does **not** change the card: the case and the algorithm are what you are drilling; the DNF shows in the `PenaltyRow` below (`class:on`).
- The aside keeps its desktop job unchanged; at ≥ 1100 px the answer is visible twice (card + aside). That is acceptable for 0.9.0 and is parked as a dedupe (§7.10) — **do not** hide the card at desktop width, the card is the only copy that sits next to the timer.

**States:** before the attempt (no card, hint line only); after; after a DNF; after `+2`; drill mode (no recog); case with no alg; 130 % (the algorithm wraps to 2–3 lines, card grows — verify the disc stays above the fold at 390×844); 360×640 (Train scrolls, that is allowed; the card must not overlap the nav).
**A11y:** `aria-label` on the card; `CaseDiagram` already renders `role="img"` with a derived label (verify the label names the case); the algorithm is `user-select: text` so it can be copied; contrast `--mu` 7.52:1, `--tx` 14.33:1.
**Done when:** at 390×844 the case name, its diagram and its algorithm are all on screen after an attempt, with no scroll needed to see them.

### C11 — Drills gets its penalty row back

**File:** `src/views/Drills.svelte:299-305` (aside) and the result block around `:231-260`.
**Before:** `<PenaltyRow>` is inside `<aside class="side">`, 0×0 below 1100 px → a drill cannot be penalised or deleted on a phone.
**After:** move the `<PenaltyRow>` out of the aside to the flow, immediately **after** the `{#if pending}` time/memo block and **before** `<div class="row stats-dock">`:

```svelte
{#if results.length}
  <PenaltyRow pen={results.at(-1)?.pen ?? ''} onpen={togglePen} ondelete={dropDrill} />
{/if}
```

and delete it from the aside (leaving `Deltas` + `ShortcutsSide` there). Moving, not copying: at ≥ 1100 px it must not render twice.
**States:** no drills yet (row absent); after a drill; `+2` active (`class:on` + `aria-pressed`); DNF active; after Delete (row reverts to the previous drill's state, unchanged behaviour); 2-look modes (the row sits under the stage split line); 130 % (three buttons stay one row — `.btn` is `flex: 1`).
**A11y:** the component already has `role="group" aria-label="Penalty and delete"`; buttons are 38 px tall — they inherit the shared `:disabled` rule from C20 and are pre-existing 44 px failures (U15, parked).
**Done when:** at 390×844 a drill can be given +2, DNF, or deleted without opening anything.

### C12 — Replace the split pill's contents

**File:** `src/lib/ui/TimerPad.svelte:268-283`.
**Before:** a pill reading `Split 0/3` plus a `/` key badge; `Undo` is rendered only when `marks.length > 0`, which makes the dock change width mid-solve (measured: pill x = 120 → 78, a 42 px jump).
**After:** three rail dashes, the next phase's name, the count, and an `Undo` that is **always in the DOM** and disabled at 0 marks.

```svelte
{#if splits && st === 'run'}
  <div class="split-dock">
    <button class="split-press" type="button" onclick={() => mark()}
      disabled={marks.length >= PHASES.length - 1}
      aria-label={marks.length >= PHASES.length - 1
        ? 'All phases marked'
        : `Mark the end of ${PHASES[marks.length]}. ${marks.length} of ${PHASES.length - 1} marks.`}>
      <span class="sp-rail" aria-hidden="true">
        <i class:on={marks.length >= 1}></i><i class:on={marks.length >= 2}></i><i class:on={marks.length >= 3}></i>
      </span>
      <span class="sp-label">{marks.length >= PHASES.length - 1 ? 'All marked' : `Next: ${PHASES[marks.length]}`}</span>
      <span class="sp-n">{marks.length}/{PHASES.length - 1}</span>
    </button>
    <button class="split-undo" type="button" onclick={() => unmark()}
      disabled={!marks.length} aria-label="Undo the last phase mark">Undo</button>
  </div>
{/if}
```

Copy table — these are the only four strings the pill may show:

| marks | rail | label | count | press | Undo |
|---|---|---|---|---|---|
| 0 | ○○○ | `Next: Cross` | `0/3` | live | **disabled**, `opacity: .35` |
| 1 | ●○○ | `Next: F2L` | `1/3` | live | live |
| 2 | ●●○ | `Next: OLL` | `2/3` | live | live |
| 3 | ●●● | `All marked` | `3/3` | **disabled** | live |

Semantics, stated once: **the pill marks the end of the phase named on it.** Three marks cut four phases (Cross · F2L · OLL · PLL) — hence `n/3` for marks and a label that names a phase, never a number of phases. Do not "fix" this to `n/4`.
The `/` key badge is removed from the pill: the pill now carries 3 elements in a fixed 212 px and the shortcut is documented in Settings → Timer and in `ShortcutsSide`. `store.key('split')` keeps working.
**States:** 0/1/2/3 marks; Undo enabled/disabled; press disabled at 3; 130 % (the label ellipsises, the rail and count never squeeze — `.sp-label` is the only flexible child); cover on (all five colours) and cover off.
**A11y:** accessible name states the phase **and** the count; the press is a real `disabled` at 3 marks so it is skipped by Tab and announced as unavailable; `Undo`'s name says what it undoes; both are ≥ 48 px tall (52).
**Done when:** the pill's left edge x is identical at 0, 1, 2 and 3 marks (measure `getBoundingClientRect().x` in all four states).

### C13 — Split pill styles v2

**File:** `src/lib/ui/TimerPad.svelte` scoped `<style>` (lines 287-340).
**Before:** intrinsic width (`padding: 11px 17px`), no rail, `gap: 8px` in the dock.
**After:** the exact block below, referencing the C1 tokens (delete the old `.split-press`/`.split-undo` rules):

```css
.split-dock {
  position: fixed; left: 50%; bottom: calc(96px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%); z-index: 42;
  display: flex; align-items: center; gap: 16px;
}
.split-press {
  display: inline-flex; align-items: center; gap: 9px;
  width: 212px; height: 52px; padding: 0 12px;
  border-radius: 999px; border: 1px solid var(--pill-edge);
  background: var(--pill); color: var(--on-pill);
  font: inherit; font-size: 0.86rem; font-weight: 800; letter-spacing: 0.02em;
  cursor: pointer; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  transition: transform 0.12s ease;
}
.sp-rail { display: flex; gap: 2px; flex: none; }
.sp-rail i { display: block; width: 11px; height: 6px; border-radius: 3px; background: var(--pill-rail); }
.sp-rail i.on { background: var(--pill-rail-on); }
.sp-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp-n { font: 800 0.74rem/1 'JetBrains Mono', monospace; opacity: 0.8; flex: none; }
.split-undo {
  width: 58px; height: 52px; flex: none;
  border-radius: 999px; border: 1px solid var(--pill-edge);
  background: var(--pill); color: var(--on-pill);
  font: inherit; font-size: 0.82rem; font-weight: 800;
  cursor: pointer; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  transition: transform 0.12s ease;
}
.split-press:active:not(:disabled), .split-undo:active:not(:disabled) { transform: scale(0.95); }
.split-press:disabled { cursor: default; }
.split-undo:disabled { opacity: 0.35; cursor: default; }
.split-press:focus-visible, .split-undo:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
```

- `width: 212px` is the fix for the jump: the pill is **fixed width at every mark count**, and `gap: 16px` between a 212 px pill and a 58 px Undo means the dock is 286 px wide in all four states, centred — so nothing moves when Undo appears or the label changes.
- Undo sits 16 px to the right of the press: outside a thumb's natural travel on the primary target, inside reach.
- The press at 3 marks is `disabled` and must **not** be dimmed by the C20 rule to the point of looking gone: the pill is over a flood, so C20's exception applies to `.split-press:disabled` — keep it at full opacity with `cursor: default` and no press scale (a solver finishing a solve still needs to read `All marked`). Add `.split-press:disabled { opacity: 1; }` after the global rule if the cascade needs it.
**States:** hover (desktop, pointer only) — none added; `:active` scale .95; `:disabled` (press at 3, Undo at 0); `:focus-visible` white outline; `prefers-reduced-motion` (no transform).
**A11y:** contrast measured on the composite over every flood — white on pill **9.0–11.3:1** (blue 10.46, gold 9.01, green 8.96, red 11.25, purple 10.58), rail filled-vs-empty **4.4–5.3:1** (passes 1.4.11 for a non-text indicator), Undo at 35 % is exempt (inactive) and is announced `disabled`.
**Done when:** at 390 and 360, in all five cover colours, the label is legible and the outline is visible at 3:1+ against the flood.

### C14 — Announce the mark

**File:** `src/lib/ui/TimerPad.svelte:266` (the `.sr` live region).
**Before:** `Timer running, 1 of 3 phases marked`.
**After:** `Marked Cross. Next: F2L.` / `All phases marked.` — the same phase word the pill shows, so a blind solver learns what the sighted pill says.

```svelte
<div class="sr" aria-live="polite" aria-atomic="true">
  {st === 'run'
    ? (splits && marks.length
        ? (marks.length >= PHASES.length - 1 ? 'All phases marked.' : `Marked ${PHASES[marks.length - 1]}. Next: ${PHASES[marks.length]}.`)
        : '(splits ? 'Timer running, split timing on.' : 'Timer running'))
    : …unchanged…}
</div>
```

Keep the rest of the chain (`ready`, `hold`, `inspection`, `too short`, `Time …`) byte for byte.
**States:** every existing state; the new one is the mark announcement. **A11y:** `aria-live="polite"` + `aria-atomic="true"`; the announcement must not fire on `unmark` with stale text (it re-renders, so verify after Undo it reads the earlier phase again).
**Done when:** with a screen reader (or by watching `aria-live` in the a11y pane), each mark produces one short sentence, not the whole pill.

### C15 — First-run nudge: the one affordance for split timing

**File:** `src/views/Solve.svelte` (in the slot C7 occupies), `src/app.css`.
**Before:** on a fresh install the bottom slot holds three `–` cards; nothing anywhere mentions split timing.
**After:** when `!store.data.settings.splits && !solves.length && !store.data.settings.splitNudgeSeen`, the stats bar is replaced by a nudge card. It disappears for good at the first solve, at the first tap of `Turn on`, or at dismissal.

```css
.split-nudge { display: flex; align-items: center; gap: 10px; padding: 9px 12px; }
.split-nudge .sn-txt { flex: 1 1 auto; min-width: 0; font-size: 0.74rem; line-height: 1.35; color: var(--mu); }
.split-nudge .sn-txt b { color: var(--tx); font-weight: 800; }
.split-nudge .btn { flex: none; min-height: 44px; padding: 0 12px; font-size: 0.82rem; }
```

```svelte
{#if !store.data.settings.splits && !solves.length && !store.data.settings.splitNudgeSeen}
  <div class="card split-nudge">
    <span class="sn-txt"><b>Want the phase breakdown?</b><br />Cross · F2L · OLL · PLL, marked mid-solve.</span>
    <button class="btn" onclick={enableSplits}>Turn on</button>
  </div>
{:else if store.shown('solve.stats')}
  … the C7 stats bar …
{/if}
```

`enableSplits()` = `store.update({ splits: true, splitNudgeSeen: true }); nav.settingsFocus = 'tm-h'; nav.go('set');` — one tap turns the feature on **and** shows where it lives, which is the whole point (a user who taps is taken to the switch, already on, with the confirmation from C18 in view). The mockup's button is 38 px; 44 px is required for a new control and adds 6 px of card height — re-check the 360×640 fresh-install fit, which has ≈ 90 px of slack.
**States:** fresh install (nudge, no stats); after the first solve (stats, no nudge); splits already on (stats, no nudge); Settings → Layout hides `solve.stats` (the nudge still shows — it is not a stats panel; do **not** route it through `store.shown`); 130 % (two-line text + 44 px button, verify at 360).
**A11y:** the `<b>` is the heading of a two-clause card, so the button's name must stand alone: give it `aria-label="Turn on split timing"` (visible text stays `Turn on`, which alone would be ambiguous). Contrast `--mu` 7.52:1, `--tx` 14.33:1.
**Done when:** from a fresh install, split timing can be on and the timer reached in ≤ 3 taps: `Turn on` → `Try it on the timer` (C18) → disc.

### C16 — Persist the dismissal

**Files:** `src/lib/storage/model.ts:8` (interface), `:15` (`defaultSettings`), `:120-137` (`cleanSettings`).
**Before:** `Settings` has no `splitNudgeSeen`.
**After:** add `splitNudgeSeen?: boolean` to the interface, `splitNudgeSeen: false` to `defaultSettings()`, and one sanitiser line in `cleanSettings`: `d.splitNudgeSeen = d.splitNudgeSeen === true;` (the spread at line 121 already carries unknown keys through, the line just normalises the type).
**Why optional + sanitised:** `normalize()` must stay able to read a 0.9.0 backup without the field, and an imported backup must not be able to set it to a string.
**States:** fresh data; existing data (field absent → false → nudge shows once for current users, which is intended); imported backup without the field; imported backup with `"yes"` (→ false).
**Done when:** `npm test` passes and a reload after dismissing does not bring the nudge back.

### C17 — Deep link that actually lands on the switch

**Files:** `src/lib/nav.svelte.ts` (add state), `src/views/Settings.svelte` (`onMount` + the split checkbox at 188-204).
**Before:** `Settings` has a jump bar (`.secnav`) that scrolls to `#tm-h`; nothing can deep-link, and the Timer section is ~700 px down a 3450 px page.
**After:**

```ts
// src/lib/nav.svelte.ts, inside class Nav
settingsFocus = $state<string | null>(null);
```

```ts
// src/views/Settings.svelte, in a new onMount
onMount(() => {
  const id = nav.settingsFocus;
  if (!id) return;
  nav.settingsFocus = null;
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ block: 'start' });
    document.getElementById('split-toggle')?.focus({ preventScroll: true });
  });
});
```

and give the split checkbox `id="split-toggle"`. The `requestAnimationFrame` is required: the page is `content-visibility: auto`, so the section's height is a placeholder until it is laid out.
**States:** arrival with focus on the checkbox (visible `:focus-visible` ring 3 px `--bl`); arrival with `prefers-reduced-motion` (use `behavior: 'auto'`, i.e. omit smooth — `scrollIntoView` with no options is already instant); arrival when the section is already in view (no jump, focus still moves).
**A11y:** focus must land on a **checkbox input**, not a heading, so Space toggles immediately; the screen reader reads the label (`Split timing`) and the sub-label; the jump bar keeps its own `aria-label="Settings sections"`.
**Done when:** `nav.settingsFocus = 'tm-h'; nav.go('set')` puts the split checkbox under the focus ring with the Timer heading at the top of the viewport, at 390 and at 1100+.

### C18 — Settings → Timer: confirm, then offer the timer

**File:** `src/views/Settings.svelte:196-204`.
**Before:** when `splits` is on, a paragraph appears: `A Split pill appears over the timer while it runs; tap it (or press /) to end a phase. Tapping anywhere else still stops the clock.`
**After:** a bordered card with a bold line, one body line, and a button that returns to Solve:

```svelte
{#if s.splits}
  <div class="card" style="border-color:var(--am);display:flex;flex-direction:column;gap:8px;align-items:flex-start">
    <b style="font-size:.92rem">Split timing is on</b>
    <span class="mu" style="font-size:.8rem;line-height:1.45">
      Tap Split (or <b class="mono" style="color:var(--tx)">{store.key('split') === 'Slash' ? '/' : store.key('split')}</b>)
      once per phase while the clock runs. 3 marks = 4 phases.
    </span>
    <button class="btn" style="min-height:44px" onclick={() => nav.go('solve')}>Try it on the timer</button>
  </div>
{/if}
```

- The copy drops "A Split pill appears over the timer…" (the pill now names its phase) and "Tapping anywhere else still stops the clock" is kept in spirit by `3 marks = 4 phases` — the number is the thing people get wrong.
- `3 marks = 4 phases` is also the line the intro states; do not vary it.
- The sub-label under the toggle (`Cross · F2L · OLL · PLL, marked while the clock runs · 3x3 only`) stays as is — it is what the user reads *before* switching on.
**States:** off (no card, paragraph absent — unchanged); on (card); 130 % (the card grows, the button stays left-aligned); `contrast` theme (border `--am` `#ffe600` on `#000`, 16.6:1; the amber border is decoration, the bold line carries the meaning).
**A11y:** the card is not a live region — the toggle's own state is announced by the checkbox; the button is 44 px; contrast `--tx` 14.33:1 / `--mu` 7.52:1.
**Done when:** toggle on → card visible without scrolling away from the toggle → button returns to Solve with the pill active on the next run.

### C19 — Intro: say it, and stop the buttons from moving

**File:** `src/lib/ui/Intro.svelte` (43 lines, whole file).
**Before:** 3 slides; `Skip` disappears on the last one and the logo appears only on the first, so `Next` sits at y ≈ 611 / 573 / 547 — a double-tap at the first position misses the second slide. No way back.
**After:** 4 slides, the split slide inserted as **slide 3** (Train stays 2, "Make it yours" moves to 4), a `Back` button, and a footer that cannot move.

```ts
const slides = [
  { title: 'Welcome to Split', body: '…existing…' },
  { title: 'Time solves, train cases', body: '…existing…' },
  { title: 'Split a solve into phases', body: 'Turn on split timing, then tap Split once per phase while the clock runs. Cross, F2L, OLL, PLL. Afterwards Split remembers your worst phase and offers a drill for it.' },
  { title: 'Make it yours', body: '…existing…' },
];
```

Slide 3 renders, under the paragraph, the same markup the Solve phase strip uses — a `.phbar` with four equal segments and the four `.ph-l` labels under it — so the reader sees what they are about to turn on. No new art, no new colours (`--bl` segments at `opacity: 1 / .81 / .62 / .43`, exactly as Solve draws it).

Footer, replacing the current `.row`:

```svelte
<div class="intro-foot">
  <button class="btn" disabled={i === 0} onclick={() => i--}>Back</button>
  {#if !last}<button class="btn" onclick={onDone}>Skip</button>{/if}
  <button class="btn p" data-first onclick={() => (last ? onDone() : i++)}>{last ? 'Get started' : 'Next'}</button>
</div>
```

```css
/* three fixed cells: the primary never moves, whichever of Back/Skip is present */
.intro-foot { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; min-height: 44px; align-items: stretch; }
.intro-foot > .btn { min-height: 44px; }
.intro-foot > .btn:last-child { grid-column: 3; }
```

- `Back` is present on every slide (`disabled` on slide 1) so the left cell never changes width.
- The logo stays slide 1 only — the footer no longer depends on it because the grid, not the flow, positions the buttons.
- `ArrowLeft` also goes back, matching the Android back handler that currently skips the intro: `onkeydown` → if `e.key === 'ArrowLeft' && i > 0` then `i--` (do not change what system Back does).
**States:** slides 1–4; `Back` disabled on 1; `Skip` absent on 4; focus trap (keep it — the trap walks `dialog.querySelectorAll('button')`, which now includes a disabled Back: a disabled button is not focusable, so the trap's first/last computation must filter `!b.disabled`, otherwise Tab from the last button lands on nothing).
**A11y:** `aria-live="polite"` on the `Step n of 4` line stays; the trap fix above is required; the phase bar is decorative (`aria-hidden="true"`) — the body text names the phases; all three buttons 44 px.
**Done when:** `Next`'s bounding box is identical on slides 1, 2, 3 and 4 at 390 and at 360 @130 %.

### C20 — One "blocked" treatment for every control that cannot act

**File:** `src/app.css` (append after the `.btn` press block, ~line 240).
**Before:** `grep -c ':disabled\|\[aria-disabled\]' src/app.css` → **0**. `.btn` sets `color: inherit`, which beats the browser's grey, so `disabled` computes to `opacity: 1`, full colour. On a fresh install `+2 / DNF / Delete` look live; mid-solve the four nav tabs are `aria-disabled="true"` at opacity 1 and a tap does nothing.
**After:**

```css
button[disabled],
button[aria-disabled='true'],
[role='button'][aria-disabled='true'] { opacity: 0.45; cursor: not-allowed; }
button[disabled]:active,
button[aria-disabled='true']:active { transform: none !important; filter: none !important; }
/* the current tab stays live even while the clock runs (Solve sits inside .mid) */
nav[aria-label='Main'] .on[aria-disabled='true'] { opacity: 1; cursor: pointer; }
```

- 45 % is the value the audit proposed and the mockup renders; it maps to 2.57:1 for `--mu` on `--card`, which is **below** 4.5:1 — and that is correct, because WCAG 1.4.3 exempts inactive controls and the real fix is that the control is now *identifiable as inactive*. Never rely on the dim alone: the control must also carry `disabled`/`aria-disabled` so it is announced.
- `.split-press:disabled` is the one exception to the dim (C13): it stays legible over the flood.
- Do **not** add `pointer-events: none` — that kills the toast in C21.

**States:** fresh install (`+2/DNF/Delete`); mid-solve nav tabs; mid-solve `History`; Train's `Weak spots` / `Lapsed` rows (already `disabled` at `Train.svelte:382-386`); Settings' disabled rows; hover on a disabled button (no change); 130 %.
**A11y:** `aria-disabled` keeps the element focusable and announced ("dimmed"/unavailable) while still firing click for the toast; `disabled` removes it from the tab order — use `aria-disabled` where a tap must answer (nav, History), `disabled` where nothing should happen (`+2/DNF/Delete`, split press at 3).
**Done when:** every control that cannot act is visually distinct at a glance, and no control anywhere computes `opacity: 1` while refusing to act.

### C21 — Say why: one toast, one place

**Files:** `src/App.svelte:262-281` (nav), `src/app.css`, a new `src/lib/ui/Toast.svelte`.
**Before:** tapping a disabled tab while the clock runs changes nothing and says nothing.
**After:** a single shared refusal line above the nav.

`src/lib/ui/Toast.svelte` (new, ~25 lines):

```svelte
<script lang="ts">
  const { msg, onDone }: { msg: string; onDone: () => void } = $props();
  $effect(() => { const t = setTimeout(onDone, 1500); return () => clearTimeout(t); });
</script>
<div class="toast" role="status" aria-live="polite">{msg}</div>
<style>
  .toast {
    position: fixed; left: 50%; transform: translateX(-50%);
    bottom: calc(66px + env(safe-area-inset-bottom, 0px));
    z-index: 60; white-space: nowrap;
    background: var(--card); border: 1px solid var(--line); border-radius: 10px;
    padding: 9px 14px; font-size: 0.82rem; font-weight: 700; color: var(--tx);
    box-shadow: 0 10px 30px -12px #000;
  }
  @media (prefers-reduced-motion: reduce) { .toast { transition: none; } }
</style>
```

In `App.svelte`: `let toast = $state('')`, `function refuse(msg: string) { toast = msg; }`, render `{#if toast}<Toast msg={toast} onDone={() => (toast = '')} />{/if}` **after** `<nav>` so it paints above it, and add to the four non-current nav tabs `onclick={() => (store.timerRunning ? refuse('Stop the timer first') : go(v))}`.

Copy is fixed: **`Stop the timer first`** for the nav, **`Stop the timer first`** for `History` (Solve, mid-solve), **`No solve yet`** for `+2/DNF/Delete` on a fresh install *if* they are converted from `disabled` to `aria-disabled` — see the note; otherwise they stay `disabled` and silent.
`History` (`Solve.svelte:146`) changes from `disabled={store.timerRunning}` to `aria-disabled={store.timerRunning}` + the same guard, because it is the control people actually try mid-solve.
`+2/DNF/Delete` keep native `disabled` (C20 dims them; the empty state explains the rest) — converting them would mean a click handler that lies about state for no gain.
**States:** toast shown (1.5 s) → gone; repeated taps restart the message, never stack; `prefers-reduced-motion` (appears, no animation); 130 % (text stays one line — `Stop the timer first` is 19 chars at 0.82 rem ≈ 148 px, the toast is centred, the safe width is 360 − 24); a toast while the split dock is visible (dock is z 42, toast z 60, dock bottom 96 px, toast bottom 66 px — they do not overlap).
**A11y:** `role="status"` + `aria-live="polite"` announces it once; it is not focusable, so nothing steals focus mid-solve; the tab is `aria-disabled` so the state is still programmatic.
**Done when:** mid-solve, a tap on Train/Drills/Library/Settings or History shows `Stop the timer first` for 1.5 s and the screen stays put.

### C22 — Verify the 360 dock clearance (no code change)

**File:** `src/app.css` (fold into C13's numbers; no new rule).
**Purpose:** an explicit cross-check, not a new change. At 360 the dock is 286 px wide inside a 360 px viewport → 37 px of clearance each side; at 130 % the label ellipsises to `Next: F…` before the rail or count shrink. Verify, do not redesign.

### C23 — Copy: the four strings that change

| Where | Before | After |
|---|---|---|
| Solve, vs-average | `+0.68 vs average` (full row) | `+0.68` pill, sentence in `aria-label` |
| Solve, phases footer | `Cross is 50% of this solve` | `Drill Cross` + `50%` on the button |
| Solve, split pill | `Split 0/3 /` | `Next: F2L` + `1/3` + rail |
| Settings → Timer, splits on | `A Split pill appears over the timer while it runs; tap it (or press /) to end a phase. Tapping anywhere else still stops the clock.` | `Split timing is on` / `Tap Split (or /) once per phase while the clock runs. 3 marks = 4 phases.` / `Try it on the timer` |

Plus the new strings introduced by C15 (`Want the phase breakdown?` / `Cross · F2L · OLL · PLL, marked mid-solve.` / `Turn on`), C19 (slide 3 title + body) and C21 (`Stop the timer first`). No other user-visible text changes. The audit's copy defects (`2x2 · 2x2 ▾`, `learning · 1 attempts`, `last 12 of 1 split solves`, …) are **not** in this change set — §7.7.

### C24 — Prove the fit

Not a code change: the acceptance procedure, run once at the end.

1. `npm run check && npm test && npm run lint`.
2. `npm run dev`; open `http://localhost:5173` at **390×844** and **360×640**, DPR 2, theme midnight.
3. Settings → Timer → split timing on; time one solve; tap Split once before stopping.
4. In the console: `document.documentElement.scrollHeight` must be **≤ 844** at 390 and **≤ 640** at 360. Measure the nav: `document.querySelector('nav[aria-label=Main]').getBoundingClientRect().top` and confirm no `.card` bottom is greater than that top minus 16.
5. Repeat with `html { font-size: 130% }` and with `data-theme` set to `contrast` and `amoled`.
6. Repeat with 0, 1, 2 and 3 marks, and record `document.querySelector('.split-press').getBoundingClientRect().x` at each — all four must be equal.
7. Fresh profile (clear IndexedDB): confirm the nudge → `Turn on` → Settings focused → `Try it on the timer` → Solve in three taps.
8. Mid-solve: tap Train. Toast appears, view does not change.
9. After an attempt in Train and in Drills: the algorithm and the `+2/DNF/Delete` row are on screen at 390×844.
10. Capture one screenshot per change into `docs/ux/evidence/` (`<change>-390.png`, `<change>-360.png`), named by the C-number.

---

## 4. Accessibility, stated once

### 4.1 Contrast — measured, not estimated

Composited with the WCAG 2.x formula, sRGB, no rounding shortcuts.

| Pair | midnight | amoled | contrast |
|---|---|---|---|
| `--tx` on `--card` | 14.33 | 14.33 | 21.00 |
| `--mu` on `--card` | 7.52 | 8.58 | 15.91 |
| `--mu` on `--bg` | 8.25 | — | — |
| `--am` on `--card` | 9.69 | 11.06 | 16.57 |
| `--good` on `--card` | 9.61 | — | — |
| `--bad` on `--card` | 6.21 | — | — |
| white on `--pill` over blue / gold / green / red / purple flood | 10.46 / 9.01 / 8.96 / 11.25 / 10.58 | identical | identical |
| rail filled vs unfilled, on the same composites | 4.94 / 4.44 / 4.44 / 5.25 / 4.92 | — | — |
| `--on-am` on `--am` | 10.38 | — | — |
| cover time ink `#06121f` on the five floods | 7.68 / 10.60 / 10.52 / 6.79 / 7.32 | — | — |
| disabled at 45 % on `--card` (`--mu` / `--tx` / `--am`) | 2.57 / 3.91 / 2.98 | — | — |

Rules that follow: every text pair above clears 4.5:1 at its rendered size (all are ≥ 12 px bold; 4.5:1 is the AA bar, 7:1 is met nearly everywhere). The disabled row is below AA **by design** and is exempt (WCAG 1.4.3 excludes inactive controls) — the mitigation is that the same state is exposed as `disabled`/`aria-disabled`, never colour alone. The only non-text indicators (rail dashes, the 3 px focus ring) are 4.4:1 and 4.9:1+ against their own backgrounds, above the 3:1 bar (1.4.11).

### 4.2 Targets

| Control | Size | Bar |
|---|---|---|
| Split press | 212 × 52 | 48 ✓ |
| Undo | 58 × 52 | 48 ✓ |
| Drill button (phase strip) | 88 × 44 | 44 ✓ |
| Nudge `Turn on` | 44 tall | 44 ✓ |
| Intro Back / Skip / Next | 44 tall | 44 ✓ |
| Settings `Try it on the timer` | 44 tall | 44 ✓ |
| Nav tabs | 78 × 58 (Solve 68 × 68) | 44 ✓ |
| Undo ↔ press gap | 16 px | ≥ 8 ✓ |
| Pre-existing under 44 (chip 34, `.seg` 36-40, `.btn` 38, `History` 36) | unchanged | **parked, §7.11** |

### 4.3 Focus order (unchanged except where noted)

- **Solve:** session chip → `History` → puzzle segment (2 stops) → `New scramble` → timer disc → `+2` → `DNF` → `Delete` → drill button (when the strip shows) → nudge `Turn on` (when it shows) → nav (Train, Library, Solve, Drills, Settings). The phase strip's bar and labels are not focusable; the strip's one control is the drill button.
- **Train:** `History` → `End session` → timer → penalties → `Skip case`. Focus moves to nothing automatically after an attempt — do not add auto-focus, it would steal a Space press.
- **Drills:** mode segment → timer → penalties (new, in flow) → `Next`/`Success`/`Failed`.
- **Intro:** Back → Skip → Next, trap kept, trap must skip `disabled` Back on slide 1 (C19).
- **Settings arrival from the nudge:** focus on `#split-toggle` (C17).
- The split press is reachable only while the clock runs; it is `disabled` at 3 marks, so Tab order shrinks by one at the end of the solve — acceptable (it is not focusable in any other state either).

### 4.4 Keyboard parity

Existing map (`src/lib/core/shortcuts.ts`, user-remappable): `Space` timer, `/` split mark, `Z` +2, `X` DNF, `C` delete, next-case key in Train. **Every new control must be operable from the keyboard via its native element** — that is why the nudge and the Settings button are `<button>`, the split press is a `<button>` and not a `<div>`, and nothing here needs a new shortcut. Two additions: `ArrowLeft` = intro Back (C19); `Esc`/Android Back unchanged.

### 4.5 Gamepad

Not supported in 0.9.0 and not added by this spec. A gamepad layer (mark/stop/undo on face buttons) is parked (§7.14) because it needs a new input abstraction and would touch gameplay timing — out of scope for a UX pass.

### 4.6 Screen-reader announcements (nothing else fires)

| Event | Region | Text |
|---|---|---|
| split marked | `TimerPad` `.sr`, polite, atomic | `Marked Cross. Next: F2L.` / `All phases marked.` |
| undo | same | `Marked Cross. Next: F2L.` (recomputed) |
| timer state | same | existing strings, unchanged |
| refusal | `Toast`, `role="status"` | `Stop the timer first` |
| answer sheet | not announced (static content, focus stays on the timer) | — |
| phase strip | not announced (the drill button carries its name) | — |

---

## 5. Order of work and what to check after each step

| Step | Changes | Check |
|---|---|---|
| 1 | C1, C2, C3, C4 | Solve stack shortens; nothing clipped at 360 @130 % |
| 2 | C5, C6, C7, C8, C9 | `scrollHeight ≤ viewport` at 390 and 360, split on, 100 % and 130 % |
| 3 | C10, C11 | answer card + algorithm + penalties on screen at 390×844 |
| 4 | C12, C13, C14 | pill x identical at 0/1/2/3 marks; label legible on all 5 floods |
| 5 | C15, C16, C17, C18, C19 | fresh install → splits on → timer in 3 taps; `Next` never moves |
| 6 | C20, C21 | no control looks live while refusing; toast fires mid-solve |
| 7 | C23, C24 | copy audit; screenshot pack |

If a measurement fails, the answer is in the numbers already in this file — the two budgets are 844 − 58 (nav) − 32 (bottom pad) at 390 and 640 − 58 − 32 at 360.

**These numbers were re-measured in the running app, not only in the mockup frame.** C2–C9 were applied to `http://localhost:5173` (the real `Solve.svelte` DOM, real `TimerPad`, real fonts) and measured at both sizes, at 100 % and 130 %, in the post-solve state (one 4-phase solve on screen). Result:

| | 390×844 | 360×640 |
|---|---|---|
| document height (100 % and 130 %) | **844** (= viewport, no scroll) | **640** (= viewport, no scroll) |
| bottom of the stats bar | **754** | **550** |
| top of the nav bar | 785 | 581 |
| clearance to the nav bar | **31 px** | **31 px** |
| phase strip | 75 / 83 px (100 % / 130 %) | 75 / 83 px |
| stats bar | 36 / 39 px | 36 / 39 px |

The round Solve button reaches 15 px above the nav top, so the real clearance to the button is **16 px** in all four combinations. If a later change eats 16 px, C24 fails and the answer is C8's disc rule or C5's pill — not a new row.

One state that is *not* in the fit budget, because it cannot occur in use: the first-run hint (`{#if !solves.length}`) and the phase strip (`{#if split.length}`) never appear together, since a strip needs a solve. If you measure a fresh install you are measuring the hint, not the strip.

---

## 6. What the mockups do **not** cover

- **Hover.** There is no hover state in this app (touch-first); desktop pointer hover exists on `.cell`/`nav` only, and no change here adds one. Do not invent hover styles.
- **Loading.** The only loading state on any changed screen is the scramble placeholder `Generating scramble…`; the phase strip, answer card and nudge simply do not render until data exists. No skeletons.
- **Error.** The app's error surfaces (load banner, save banner, chunk-load card) are untouched; no change adds an error state to a component that has none.
- **Landscape.** Only C8's `max-height: 700px` rule targets it. A full landscape pass is parked (§7.13).

---

## 7. Next version — parked, do not ship in 0.9.0

| # | Item | Why parked |
|---|---|---|
| 7.1 | History's 6 empty stat cards and the 250 px one-line chart (audit U6) | needs a threshold rule and a new empty state — a design of its own |
| 7.2 | Settings' jump bar hides 5 of 9 sections at 390 (U7) | wants a scroll affordance (fade + chevron) and possibly a two-row bar; more than a token change |
| 7.3 | 130 % truncates `High contr…` and `Walk…` (U8) | needs a responsive segmented control (wrap or icon+label), touches every `.seg` in Settings |
| 7.4 | Two identical segmented rows in Library (U9) | wants a labelled filter group — new component |
| 7.5 | `History` renders as a full-width bar on Train and a chip in Library (U10) | component unification, not a fix |
| 7.6 | The aside breakpoint at exactly 1100 px = the Tauri window width (U11) | needs a decision about the shipped window size; touching it changes the desktop layout |
| 7.7 | The 7 copy defects (`2x2 · 2x2 ▾`, `learning · 1 attempts`, `+0.68 vs average` in red against 2 solves, …) (U13) | one-liners that belong in a copy sweep with their own diff, so they do not hide inside this one |
| 7.8 | Two primaries: timer `--bl`, actions `--am`; a green accent leaves checkboxes blue (U14) | brand decision, needs Noah's call |
| 7.9 | Drills' ~260 px dead space and missing hint copy (U12) | a layout of its own; Drills only got its penalty row back here |
| 7.10 | Answer shown twice at ≥ 1100 px (card + aside) | harmless duplication; hiding one needs a breakpoint decision |
| 7.11 | The 8 Solve targets still under 44 px tall (chip 34, `.seg` 36-40, `.btn` 38, `History` 36) (U15) | raising them costs 6-8 px each on a screen that just got its height back; do it with the next height budget |
| 7.12 | Mobile "recent attempts" deltas in Train | would push the disc off a 640-tall phone |
| 7.13 | A real landscape pass for Solve/Train/Drills | only the disc is handled (C8) |
| 7.14 | Gamepad input layer | new input abstraction, touches timing |
| 7.15 | A light theme | the app is dark-only by design |
| 7.16 | Intro slide art (the only slide with an image is slide 1) | needs illustration, not layout |

---

## 8. Reference — where every number came from

| Number in this spec | Source |
|---|---|
| `.page` 104 px bottom pad, 18 px side pad, 12 px gap | `src/app.css:107-115` |
| `.page.fill` `calc(100dvh − 58px)` | `src/app.css:325-330` |
| `.chip` min-height 34, `.btn` 38, `.seg button` 36, `nav > *` 58, `.mid button` 68 / −26 | `src/app.css:168, 195, 527, 575, 586, 622` |
| `.phbar` 9 px, `.phrow` gap 8, `.ph-l` .66 rem | `src/app.css:1467-1493` |
| `.big` `min(180px, 23vh)`, floor 128 | `src/app.css:358-372` |
| `.side { display: none }` → `@media (min-width: 1100px)` | `src/app.css:675, 713` |
| split dock / pill as shipped (151×50, x 120→78) | `src/lib/ui/TimerPad.svelte:287-340`, audit §4 U3 |
| phase order `['Cross','F2L','OLL','PLL']`, `phaseLabels(n)` | `src/lib/core/stats.ts:105-133` |
| `marks` capped at `PHASES.length − 1` | `src/lib/ui/TimerPad.svelte:131` |
| Settings sections + `#tm-h` | `src/views/Settings.svelte:99-109, 144-145` |
| split toggle + sub-label | `src/views/Settings.svelte:188-204` |
| `Settings` interface / defaults / `cleanSettings` spread | `src/lib/storage/model.ts:8, 15, 120-137` |
| nav `aria-disabled` with no CSS | `src/App.svelte:262-281`, audit §4 U5 |
| Train result line, aside, `PenaltyRow` | `src/views/Train.svelte:456-466, 474, 483-517` |
| Drills aside `PenaltyRow` | `src/views/Drills.svelte:299-305` |
| intro slides and footer | `src/lib/ui/Intro.svelte:6-10, 34-41` |
| focus ring `3px solid var(--bl)` | `src/app.css:276-283` |
| contrast values | computed from the token hex values (§4.1) |
| heights after the change (754 / 550 / 640-640) | measured twice: in the mockup frame, then in the real app DOM with C2–C9 applied at 390×844 and 360×640, 100 % and 130 % (§5). Re-measure on the implemented build per C24. |
