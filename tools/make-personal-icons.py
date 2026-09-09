#!/usr/bin/env python3
"""
Draws the Personal page's app icons.

The finance app's icon is a navy rounded square with teal bars. This keeps the
square and swaps in the Personal page's gold, drawn as a checklist -- one item
ticked, two still open -- so the two icons are instantly distinguishable on a
home screen while clearly belonging to the same app.

Written by hand rather than with an image library because the environment has
none, and the shapes are simple enough not to need one. Rendered at 3x and
boxed down, which is what keeps the curves from looking ragged.

    python3 tools/make-personal-icons.py

Writes app/icons/personal-192.png, personal-512.png and
personal-maskable-512.png.
"""

import pathlib
import struct
import zlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
ICONS = ROOT / "app" / "icons"

NAVY = (11, 15, 20)
GOLD = (242, 193, 78)
SS = 3  # supersample factor


def rounded_rect(x0, y0, x1, y1, r):
    """Returns a hit test for a rounded rectangle in unit coordinates."""
    def inside(x, y):
        if not (x0 <= x <= x1 and y0 <= y <= y1):
            return False
        cx = min(max(x, x0 + r), x1 - r)
        cy = min(max(y, y0 + r), y1 - r)
        dx, dy = x - cx, y - cy
        return dx * dx + dy * dy <= r * r
    return inside


def glyph_shapes(inset):
    """The checklist: a filled box, two outlined ones, and a bar beside each."""
    shapes = []
    box_x0, box_w = inset, 0.13
    bar_x0, bar_x1 = inset + 0.20, 1.0 - inset
    for i, y in enumerate((0.28, 0.50, 0.72)):
        y0, y1 = y - box_w / 2, y + box_w / 2
        outer = rounded_rect(box_x0, y0, box_x0 + box_w, y1, 0.035)
        if i == 0:
            shapes.append((outer, GOLD))
        else:
            t = 0.028  # stroke width
            inner = rounded_rect(box_x0 + t, y0 + t, box_x0 + box_w - t, y1 - t, 0.02)
            shapes.append((outer, GOLD))
            shapes.append((inner, NAVY))
        bar_h = 0.075
        bar_end = bar_x1 - i * 0.22 * (bar_x1 - bar_x0)
        shapes.append((rounded_rect(bar_x0, y - bar_h / 2, bar_end, y + bar_h / 2, bar_h / 2), GOLD))
    return shapes


def render(size, maskable=False):
    """Paints one icon and returns its rows of RGB bytes."""
    # A maskable icon is cropped to a circle by the launcher, so its content
    # stays inside the safe zone and the background bleeds to the edges.
    inset = 0.30 if maskable else 0.22
    background = None if maskable else rounded_rect(0, 0, 1, 1, 0.22)
    shapes = glyph_shapes(inset)

    big = size * SS
    rows = []
    for py in range(size):
        row = bytearray()
        for px in range(size):
            r = g = b = 0
            for sy in range(SS):
                for sx in range(SS):
                    x = (px * SS + sx + 0.5) / big
                    y = (py * SS + sy + 0.5) / big
                    color = NAVY if (background is None or background(x, y)) else (0, 0, 0)
                    if background is None or background(x, y):
                        for hit, c in shapes:
                            if hit(x, y):
                                color = c
                    r += color[0]
                    g += color[1]
                    b += color[2]
            n = SS * SS
            row += bytes((r // n, g // n, b // n))
        rows.append(bytes(row))
    return rows


def write_png(path, rows, size):
    raw = b"".join(b"\x00" + row for row in rows)

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    path.write_bytes(png)
    print(f"Wrote {path.relative_to(ROOT)} ({len(png) / 1024:.1f} KB)")


def main():
    for size, maskable, name in ((192, False, "personal-192.png"),
                                 (512, False, "personal-512.png"),
                                 (512, True, "personal-maskable-512.png")):
        write_png(ICONS / name, render(size, maskable), size)


if __name__ == "__main__":
    main()
