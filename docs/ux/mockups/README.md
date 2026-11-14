# Mockups — Split 0.9.0 UX fixes

Seven sheets, one per finding (U3 has one sheet, U1 has two). They are **renders of the app's own
stylesheet**, not drawings: `src/frame.html` loads `../../../../src/app.css` and adds the proposed rules in
a `<style id="proposed" media="not all">` block, which is switched to `all` for every `after`/`u3-[ab]`/`u4`
variant. So a colour or size in a sheet is a colour or size the implementer can copy verbatim.

| Sheet | What it answers |
|---|---|
| `u1-solve-fit.png` | does the timer screen fit at 390×844 and 360×640 with split timing on? |
| `u1-solve-130.png` | and at 130 % text size? |
| `u2-train-answer.png` | case diagram + algorithm + penalties on a phone, before/after/DNF/130 % |
| `u2-drills-penalty.png` | the +2 / DNF / Delete row a drill never had on a phone |
| `u3-split-pill.png` | shipped pill vs two candidates at 0, 1 and 3 marks (B is chosen) |
| `u4-discovery.png` | first-run nudge, new intro slide, Settings confirmation |
| `u5-blocked.png` | disabled treatment on a fresh install and mid-solve, plus the refusal toast |

`frames/` holds every full-page render at 2× DPR (780×1688 for a 390×844 phone). Compose reads those and
crops; it never draws a control.

## Re-rendered after review

Four things were wrong in the first pass and are fixed in the frames, not just in the captions:

- `.pc-drill` was a fixed `88px` wide, so at 130 % the label wrapped to three lines and the phase strip
  grew to 89 px. It is now `width: auto; min-width: 88px` with `white-space: nowrap` on the label
  (strip: 75 px at 100 %, 83 px at 130 %; measured in the app too).
- `u2-drills-after` was captured while `.stats-dock` was still being restyled, so its two stat cards were
  squashed. Re-captured with the `.stats-bar` class split out.
- The fresh-install panels read `History · 12` and showed filled stat cards; they now read `History · 0`
  and `–`, matching a first run.
- All four `u1-after-*` frames were re-captured at 2× after the drill-button fix.

## Re-render one frame

```bash
npm run dev        # from the repo root, port 5173
# then, in a browser at the device size, DPR 2:
http://localhost:5173/docs/ux/mockups/src/frame.html?v=u1-after-390
http://localhost:5173/docs/ux/mockups/src/frame.html?v=u1-after-390&t=130
```

Capture 390×844 (or 360×640) at scale 1 with `Emulation.setDeviceMetricsOverride {width, height, deviceScaleFactor: 2}`
+ `Page.captureScreenshot`, save into `frames/<variant>.png`, then:

```bash
cd docs/ux/mockups/src && python compose.py    # writes ../*.png
```

`compose.py` needs Pillow and reads the captions from its own `sheet(...)` calls — the numbers in the
captions (content ends 754, tab bar 581, …) are measurements of the renders, so update them when you
re-render after a code change.

## Variants

`u1-before-390`, `u1-before-360`, `u1-after-390`, `u1-after-360` (+ `-130`), `u1-first-run-before/after`,
`u2-train-before/after/after-130/dnf`, `u2-drills-before/after`, `u3-old/a/b-{0,1,3}`, `u4-intro`,
`u4-settings`, `u5-fresh-before/after`, `u5-run-before/after`. Full list: the `ROUTES` table at the bottom
of `frame.html`.

## Constraint found the hard way

Chrome's CDP calls against this page need `_response_timeout=60` on this machine, and an iframe-based
sheet (`sheet.html`) wedges the renderer — compose from `frames/` instead.
