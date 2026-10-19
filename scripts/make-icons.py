"""Draws the app logo (a glowing rounded cube whose three inner edges are clock hands) and writes every PNG the
web, Android and desktop builds need. Run: python3 scripts/make-icons.py   (needs Pillow and numpy)"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S = 2048                       # draw big, then downsample for smooth edges
BG = (15, 17, 21)              # app background colour
YEL1, YEL2 = (247, 205, 40), (240, 150, 40)
BLU1, BLU2 = (96, 112, 255), (58, 62, 176)
RED1, RED2 = (255, 106, 92), (214, 74, 74)
MID = (170, 110, 190)          # shows through where faces blend

def hexagon(cx, cy, r):
    return [(cx + r * math.cos(math.radians(a)), cy - r * math.sin(math.radians(a))) for a in (90, 30, -30, -90, -150, 150)]

def rounded_hex_mask(r, rr, cx=S / 2, cy=S / 2):
    """Filled hexagon of circumradius r with corners rounded by rr."""
    inner = hexagon(cx, cy, r - rr / math.cos(math.radians(30)))
    m = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(m)
    d.polygon(inner, fill=255)
    d.line(inner + [inner[0], inner[1]], fill=255, width=int(2 * rr), joint='curve')
    for x, y in inner:
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=255)
    return m

def gradient(c1, c2, vec):
    ys, xs = np.mgrid[0:S, 0:S].astype(np.float32)
    t = ((xs - S / 2) * vec[0] + (ys - S / 2) * vec[1]) / (S * 0.5)
    t = np.clip(t * 0.5 + 0.5, 0, 1)[..., None]
    a = np.array(c1, np.float32); b = np.array(c2, np.float32)
    return Image.fromarray((a * (1 - t) + b * t).astype(np.uint8), 'RGB').convert('RGBA')

def mark(r):
    """The logo mark on a transparent square canvas; r is the hexagon circumradius in pixels."""
    cx = cy = S / 2
    rr = r * 0.20                                     # corner rounding
    border = r * 0.085                                # white rim thickness
    outer = rounded_hex_mask(r, rr)
    inner = rounded_hex_mask(r - border, max(rr - border * 0.6, 1))
    P = hexagon(cx, cy, r)
    top, tr, br, bot, bl, tl = P
    c = (cx, cy)
    faces = [
        ([top, tr, c, tl], gradient(YEL1, YEL2, (0.6, 0.8))),
        ([tl, c, bot, bl], gradient(BLU1, BLU2, (0.3, 1.0))),
        ([tr, br, bot, c], gradient(RED1, RED2, (-0.4, 1.0))),
    ]
    body = Image.new('RGBA', (S, S), MID + (255,))
    for poly, fill in faces:
        m = Image.new('L', (S, S), 0)
        ImageDraw.Draw(m).polygon(poly, fill=255)
        body.paste(fill, mask=m.filter(ImageFilter.GaussianBlur(r * 0.07)))
    # soft light from the top left, so the faces look glassy
    shine = Image.new('L', (S, S), 0)
    ImageDraw.Draw(shine).ellipse([cx - r * 0.95, cy - r * 1.05, cx + r * 0.2, cy - r * 0.05], fill=70)
    body.paste(Image.new('RGBA', (S, S), (255, 255, 255, 255)), mask=shine.filter(ImageFilter.GaussianBlur(r * 0.25)))
    # clip to the inside of the rim
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    out.paste(body, mask=inner)
    # glowing white rim
    ring = Image.eval(outer, lambda v: v)
    ring_mask = Image.composite(outer, Image.new('L', (S, S), 0), outer)
    ring_only = Image.new('L', (S, S), 0)
    ring_only.paste(outer, mask=None)
    ring_only = Image.fromarray(np.clip(np.asarray(outer, np.int16) - np.asarray(inner, np.int16), 0, 255).astype(np.uint8), 'L')
    glow = ring_only.filter(ImageFilter.GaussianBlur(r * 0.07)).point(lambda v: int(v * 0.8))
    out.paste(Image.new('RGBA', (S, S), (200, 190, 255, 255)), mask=glow)
    out.paste(Image.new('RGBA', (S, S), (255, 255, 255, 245)), mask=ring_only)
    # three clock hands along the cube's inner edges, with a hub in the centre
    d = ImageDraw.Draw(out)
    w = r * 0.12
    hands = [(tl, 0.52), (tr, 0.78), (bot, 0.92)]
    for tip, f in hands:
        ex, ey = cx + (tip[0] - cx) * f, cy + (tip[1] - cy) * f
        d.line([(cx, cy), (ex, ey)], fill=(255, 255, 255, 240), width=int(w))
        d.ellipse([ex - w / 2, ey - w / 2, ex + w / 2, ey + w / 2], fill=(255, 255, 255, 240))
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    hub = r * 0.17
    ld.ellipse([cx - hub, cy - hub, cx + hub, cy + hub], fill=(255, 255, 255, 110))
    out.alpha_composite(layer)
    hub2 = r * 0.10
    d.ellipse([cx - hub2, cy - hub2, cx + hub2, cy + hub2], fill=(255, 255, 255, 255))
    return out

def tile(m, rounded):
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if rounded: d.rounded_rectangle([0, 0, S, S], radius=int(S * 0.22), fill=BG + (255,))
    else: d.rectangle([0, 0, S, S], fill=BG + (255,))
    im.alpha_composite(m)
    return im

def save(im, path, size):
    im.resize((size, size), Image.LANCZOS).save(path)

big = mark(S * 0.36)           # logo fills most of an icon tile
safe = mark(S * 0.27)          # inside the adaptive-icon / maskable safe zone
small = mark(S * 0.30)         # splash screen
full = tile(big, False); rounded = tile(big, True); maskable = tile(safe, False)

save(full, 'assets/icon-only.png', 1024); save(full, 'assets/icon-source.png', 1024)
save(safe, 'assets/icon-foreground.png', 1024)
save(Image.new('RGBA', (S, S), BG + (255,)), 'assets/icon-background.png', 1024)
splash = Image.new('RGBA', (S, S), BG + (255,)); splash.alpha_composite(small)
splash2732 = Image.new('RGBA', (2732, 2732), BG + (255,))
splash2732.alpha_composite(small.resize((1100, 1100), Image.LANCZOS), (816, 816))
splash2732.save('assets/splash.png'); splash2732.save('assets/splash-dark.png')
save(rounded, 'public/icon-512.png', 512); save(rounded, 'public/icon-192.png', 192)
save(maskable, 'public/maskable-512.png', 512); save(rounded, 'public/favicon.png', 64)
mk = mark(S * 0.46); save(mk, 'public/logo.png', 256)      # transparent mark for in-app use
print('logo, icons and splash written')
