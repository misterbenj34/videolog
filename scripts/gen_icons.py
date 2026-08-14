#!/usr/bin/env python3
"""Generate VideoLog app icons as real PNGs (Firefox requires PNG, not data-URI/SVG)."""
import zlib, struct, os, math

def write_png(path, width, height, pixels):
    """pixels: list of rows, each row a list of (r,g,b,a) tuples."""
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)

    raw = bytearray()
    for row in pixels:
        raw.append(0)  # filter type 0 (None)
        for r, g, b, a in row:
            raw += bytes((r, g, b, a))

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)  # 8-bit RGBA
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", ihdr)
           + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
           + chunk(b"IEND", b""))
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "wb") as f:
        f.write(png)
    print(f"wrote {path} ({width}x{height})")

BG = (15, 23, 42, 255)        # slate-900 #0f172a
ACCENT = (251, 191, 36, 255)  # amber-400 #fbbf24
SAND = (245, 158, 11, 255)    # amber-500 for the sand fill
BAR = (148, 163, 184, 255)    # slate-400 frame bars

def rounded_rect_mask(x, y, r):
    """Return True if (x,y) is inside the rounded-square (0..1 coords)."""
    # corner centers
    cx = r if x < r else (1 - r if x > 1 - r else x)
    cy = r if y < r else (1 - r if y > 1 - r else y)
    dx, dy = x - cx, y - cy
    # inside main rect
    if r <= x <= 1 - r or r <= y <= 1 - r:
        return True
    return (dx * dx + dy * dy) <= r * r

def in_hourglass(x, y):
    """Return the color for an hourglass shape centered in [0,1]x[0,1], or None."""
    # geometry constants (normalized)
    waist = 0.50
    top_bar_top, top_bar_bot = 0.20, 0.30
    bot_bar_top, bot_bar_bot = 0.70, 0.80
    left0, right0 = 0.30, 0.70      # width at bars
    left_waist, right_waist = 0.455, 0.545  # width at waist

    # top frame bar
    if top_bar_top <= y <= top_bar_bot and left0 <= x <= right0:
        return BAR
    # bottom frame bar
    if bot_bar_top <= y <= bot_bar_bot and left0 <= x <= right0:
        return BAR

    # glass: top half (tapering down to waist)
    if top_bar_bot <= y <= waist:
        t = (y - top_bar_bot) / (waist - top_bar_bot)  # 0 -> 1
        left = left0 + (left_waist - left0) * t
        right = right0 + (right_waist - right0) * t
        if left <= x <= right:
            return ACCENT
    # glass: bottom half (widening from waist)
    if waist <= y <= bot_bar_top:
        t = (y - waist) / (bot_bar_top - waist)  # 0 -> 1
        left = left_waist + (left0 - left_waist) * t
        right = right_waist + (right0 - right_waist) * t
        if left <= x <= right:
            # sand fill: bottom ~55% of lower half is a different shade
            if t > 0.45:
                return SAND
            return ACCENT

    # outline stroke: draw thin edges around the glass
    return None

def render(size):
    r = 0.22  # corner radius
    px = []
    for j in range(size):
        row = []
        y = (j + 0.5) / size
        for i in range(size):
            x = (i + 0.5) / size
            if rounded_rect_mask(x, y, r):
                c = in_hourglass(x, y)
                row.append(c if c else BG)
            else:
                row.append((0, 0, 0, 0))  # transparent outside rounded square
        px.append(row)
    return px

for s in (512, 192):
    write_png(f"icons/icon-{s}.png", s, s, render(s))
