"""Compose the Split 0.9.0 mockup sheets from the per-frame renders.

Each frame is frame.html?v=<variant>(&t=<text size>) rendered by Chrome at that device size and
2x DPR (see README.md). This script only arranges them: it never draws a control, so what you see
in a sheet is what the app's own CSS produced.

    python compose.py            # writes ../*.png
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FRAMES = os.path.join(os.path.dirname(HERE), "frames")
OUT = os.path.dirname(HERE)

S = 2  # the frames are 2x renders; the sheet is laid out in the same pixels
BG = (7, 9, 12)
TX = (232, 234, 240)
MU = (143, 153, 168)
DIM = (125, 135, 152)
OK = (89, 217, 138)
NO = (255, 107, 107)

F = "C:/Windows/Fonts/"
def font(name, px):
    return ImageFont.truetype(os.path.join(F, name), px)

FT = font("segoeuib.ttf", 23 * S)
FH = font("segoeui.ttf", 13 * S)
FC = font("segoeuib.ttf", 12 * S)
FD = font("segoeui.ttf", 11 * S)
FM = font("consola.ttf", 11 * S)

PAD = 28 * S
GAP = 26 * S
CAP = 84 * S          # caption block height


def wrap(draw, text, fnt, maxw):
    words, lines, cur = text.split(" "), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=fnt) <= maxw:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def sheet(fn, title, sub, cols, cells, crop=None):
    """cells: list of dicts {img, w, h, cap, detail, tone}  (w/h in CSS px)"""
    cellw = max(c["w"] for c in cells) * S
    cellw = max(cellw, 300 * S)
    colw = cellw
    # measure the header
    probe = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    body = wrap(probe, sub, FH, cols * colw + (cols - 1) * GAP)
    head = 23 * S + 6 * S + len(body) * 17 * S + 22 * S
    rows = (len(cells) + cols - 1) // cols
    rowhs = [max(c["h"] for c in cells[r * cols:(r + 1) * cols]) * S + CAP for r in range(rows)]
    W = PAD * 2 + cols * colw + (cols - 1) * GAP
    H = PAD * 2 + head + sum(rowhs) + (rows - 1) * GAP
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    y = PAD
    d.text((PAD, y), title, font=FT, fill=TX)
    y += 23 * S + 6 * S
    for line in body:
        d.text((PAD, y), line, font=FH, fill=MU)
        y += 17 * S
    y += 22 * S
    for i, c in enumerate(cells):
        cx = PAD + (i % cols) * (colw + GAP)
        cy = y + sum(rowhs[:i // cols]) + (i // cols) * GAP
        src = Image.open(os.path.join(FRAMES, c["img"]))
        if crop:
            src = src.crop((0, src.height - crop * S, src.width, src.height))
        src = src.resize((c["w"] * S, int(src.height * (c["w"] * S) / src.width)), Image.LANCZOS)
        im.paste(src, (cx, cy))
        d.rectangle([cx, cy, cx + src.width - 1, cy + src.height - 1], outline=(42, 47, 58))
        ty = cy + src.height + 9 * S
        d.text((cx, ty), c["cap"], font=FC, fill=TX)
        ty += 15 * S
        for line in wrap(d, c["detail"], FD, colw):
            d.text((cx, ty), line, font=FD, fill=c.get("tone", DIM))
            ty += 15 * S
    im.save(os.path.join(OUT, fn), optimize=True)
    print(fn, im.size)


def cell(img, w, cap, detail, tone=None):
    return {"img": img, "w": w, "h": 844 if w == 390 else 640, "cap": cap, "detail": detail,
            "tone": tone or DIM}


# 1 — U1 fit ------------------------------------------------------------------
sheet("u1-solve-fit.png",
      "U1 — the timer screen fits again",
      "Solve, post-solve, split timing on. Left of each pair = the 0.9.0 build, right = the proposal. "
      "Both are the app's real src/app.css rendered at the stated device size; the numbers under each "
      "phone are measured in that render after layout (device pixels / 2). The tab bar starts 59 px above "
      "the bottom, and its round Solve button reaches 15 px higher than that.",
      2,
      [cell("u1-before-390.png", 390, "BEFORE · 390×844 · shipped 0.9.0",
            "content ends 772 · round Solve button 770 · 2 px of the stats bar sits behind it", NO),
       cell("u1-after-390.png", 390, "AFTER · 390×844 · proposed",
            "content ends 754 · clears the button by 16 px and the bar by 31 px", OK),
       cell("u1-before-360.png", 360, "BEFORE · 360×640 · shipped 0.9.0",
            "content ends 748, tab bar at 581 · 182 px of the stack is hidden, stats bar first", NO),
       cell("u1-after-360.png", 360, "AFTER · 360×640 · proposed",
            "content ends 550 · document 640/640, nothing to scroll", OK)])

# 2 — U1 at 130 % ------------------------------------------------------------
sheet("u1-solve-130.png",
      "U1 — the same screen at 130 % text",
      "Text size 130 % is the accessibility setting the app ships. The strip is one layout at every text "
      "size and every width — no second \"compact mode\" to keep in sync — and it still fits, because the "
      "phase times, the drill and the stats bar are all one row.",
      2,
      [cell("u1-before-360-130.png", 360, "BEFORE · 360×640 · 130 %",
            "content ends 815 · 249 px behind the tab bar", NO),
       cell("u1-after-360-130.png", 360, "AFTER · 360×640 · 130 %",
            "content ends 550 · fits, no scroll", OK),
       cell("u1-before-390-130.png", 390, "BEFORE · 390×844 · 130 %",
            "content ends 833 · 63 px behind the round Solve button", NO),
       cell("u1-after-390-130.png", 390, "AFTER · 390×844 · 130 %",
            "content ends 754 · clears the button by 16 px", OK)])

# 3 — U2 trainer -------------------------------------------------------------
sheet("u2-train-answer.png",
      "U2 — the trainer's answer sheet reaches the phone",
      "Train session after an attempt, 390×844. On the shipped build the aside that holds the case "
      "diagram, the algorithm and the penalty row is display:none below 1100 px, so a phone gets the case "
      "name and nothing else. The answer card puts the same content in the flow, under the timer.",
      2,
      [cell("u2-train-before.png", 390, "BEFORE · after an attempt",
            "Last 2.36 · recog 0.50 · exec 1.86 · Aa-perm — a name, with no picture and no algorithm", NO),
       cell("u2-train-after.png", 390, "AFTER · after an attempt",
            "64 px diagram · name · recog/exec · the algorithm in mono, wrapping", OK),
       cell("u2-train-dnf.png", 390, "AFTER · after a DNF",
            "the answer stays: it is what you are drilling, and a DNF does not change it", OK),
       cell("u2-train-after-130.png", 390, "AFTER · 130 % text",
            "the card grows with the text and the algorithm wraps; nothing clips", OK)])

# 4 — U2 drills --------------------------------------------------------------
sheet("u2-drills-penalty.png",
      "U2 — Drills gets its penalty row back",
      "Drills, after a drill, 390×844. The +2 / DNF / Delete row lives in the same hidden aside, so on a "
      "phone a bad drill cannot be penalised or deleted at all — the one thing a drill log has to get "
      "right.",
      2,
      [cell("u2-drills-before.png", 390, "BEFORE · after a drill",
            "no +2 / DNF / Delete anywhere on the screen: the aside holding them is 0×0", NO),
       cell("u2-drills-after.png", 390, "AFTER · after a drill",
            "the same PenaltyRow Train already renders, in the flow under the time", OK)])

# 5 — U3 split pill ----------------------------------------------------------
sheet("u3-split-pill.png",
      "U3 — say which phase is being marked, and stop moving the target",
      "Clock running, split timing on. Each cell is the bottom 300 px of the same screen: the pill sits "
      "over the colour flood. SHIPPED is the 0.9.0 pill; A and B are the two candidates. A and B keep one "
      "footprint at every mark count and keep Undo present but disabled, so the target never moves.",
      3,
      [{"img": "u3-old-0.png", "w": 390, "h": 300, "cap": "SHIPPED · 0 marks",
        "detail": "Split 0/3 · no phase named", "tone": NO},
       {"img": "u3-a-0.png", "w": 390, "h": 300, "cap": "A · 0 marks", "detail": "Cross bold, 0/3"},
       {"img": "u3-b-0.png", "w": 390, "h": 300, "cap": "B · 0 marks",
        "detail": "rail 0/3 · Next: Cross · Undo present but disabled"},
       {"img": "u3-old-1.png", "w": 390, "h": 300, "cap": "SHIPPED · 1 mark",
        "detail": "Undo appears, so the pill grows 72 px and re-centres 36 px to the left mid-solve", "tone": NO},
       {"img": "u3-a-1.png", "w": 390, "h": 300, "cap": "A · 1 mark", "detail": "Cross done, F2L bold"},
       {"img": "u3-b-1.png", "w": 390, "h": 300, "cap": "B · 1 mark",        "detail": "rail 1/3 · Next: F2L"},
       {"img": "u3-old-3.png", "w": 390, "h": 300, "cap": "SHIPPED · 3 marks",
        "detail": "3/3 still does not say which phase just ended", "tone": NO},
       {"img": "u3-a-3.png", "w": 390, "h": 300, "cap": "A · 3 marks", "detail": "PLL bold · 3/3"},
       {"img": "u3-b-3.png", "w": 390, "h": 300, "cap": "B · 3 marks",
        "detail": "rail 3/3 · All marked · the press is inert, Undo still live"}],
      crop=300)

# 6 — U4 discovery -----------------------------------------------------------
sheet("u4-discovery.png",
      "U4 — let people find the 0.9.0 features",
      "Three placements, all on screens that already exist. Top: the first-run Solve screen, where the "
      "empty Best/ao5/ao12 dock (three dashes) becomes the split-timing prompt. Bottom: the new intro "
      "slide, and the Settings → Timer confirmation that replaces the paragraph only shown after the "
      "toggle has been found.",
      2,
      [cell("u1-first-run-before.png", 390, "BEFORE · fresh install",
            "a stats dock of dashes, and no mention of split timing anywhere", NO),
       cell("u1-first-run-after.png", 390, "AFTER · fresh install",
            "the same slot carries the prompt: one line + Turn on", OK),
       cell("u4-intro.png", 390, "AFTER · intro, slide 3 of 4",
            "the phase bar drawn, the three-mark rule stated once"),
       cell("u4-settings.png", 390, "AFTER · Settings → Timer",
            "toggle on → one-line confirmation + Try it on the timer")])

# 7 — U5 silent refusals -----------------------------------------------------
sheet("u5-blocked.png",
      "U5 — no silent refusals",
      "Left pair: fresh install, where +2 / DNF / Delete carry disabled but compute to opacity 1, because "
      "app.css has no :disabled rule (and .btn sets color: inherit, which beats the browser's grey). "
      "Right pair: the clock running, where the four tabs are aria-disabled at opacity 1 and a tap on "
      "Train does nothing and says nothing.",
      2,
      [cell("u5-fresh-before.png", 390, "BEFORE · fresh install",
            "+2 / DNF / Delete look live; tapping Delete does nothing", NO),
       cell("u5-fresh-after.png", 390, "AFTER · fresh install",
            "45 % opacity, no press scale, cursor not-allowed", OK),
       cell("u5-run-before.png", 390, "BEFORE · running",
            "four tabs at full strength; the tap is silent", NO),
       cell("u5-run-after.png", 390, "AFTER · running",
            "the tabs dim, the current tab stays live, and the tap answers", OK)])
