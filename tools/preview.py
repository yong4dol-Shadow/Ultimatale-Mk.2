#!/usr/bin/env python3
"""
preview.py - render a zoomed contact sheet of every character sprite.

Useful when tweaking the drawing code in chars.py / enemies.py: run it and
open docs/preview.png to see the whole cast at 3x on a checkerboard.

    python3 tools/preview.py [--scale 3] [--out docs/preview.png]
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pixel import Canvas, canvases_to_sheet, write_png, hexc
import chars
import enemies as E

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CAST = [
    (lambda: chars.hedgehog('shadow', 'idle', 0.0), chars.SHADOW_PAL),
    (lambda: chars.hedgehog('shadow', 'skate', 0.25), chars.SHADOW_PAL),
    (lambda: chars.hedgehog('shadow', 'attack', 0.0), chars.SHADOW_PAL),
    (lambda: chars.hedgehog('shadow', 'idle', 0.0), chars.SUPER_PAL),
    (lambda: chars.hedgehog('sonic', 'idle', 0.0), chars.SONIC_PAL),
    (lambda: chars.hedgehog('tails', 'idle', 0.0), chars.TAILS_PAL),
    (lambda: E.gun_soldier(0.0), E.GUN_PAL),
    (lambda: E.gun_beetle(0.2), E.GUN_PAL),
    (lambda: E.gun_hunter(0.2), E.GUN_PAL),
    (lambda: E.black_warrior(0.0), E.BLACK_ARMS_PAL),
    (lambda: E.black_hawk(0.25), E.BLACK_ARMS_PAL),
    (lambda: E.black_oak(0.2), E.BLACK_ARMS_PAL),
    (lambda: E.black_doom(0.2), E.DOOM_PAL),
    (lambda: E.devil_doom(0.25), E.DOOM_PAL),
    (lambda: E.maria(0.0), E.MARIA_PAL),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--scale', type=int, default=3)
    ap.add_argument('--out', default=os.path.join(ROOT, 'docs', 'preview.png'))
    a = ap.parse_args()

    frames = [(fn(), pal) for fn, pal in CAST]
    W = sum(c.w + 4 for c, _ in frames)
    H = max(c.h for c, _ in frames) + 4

    strip, merged, x = Canvas(W, H), {}, 2
    for i, (c, pal) in enumerate(frames):
        # namespace each palette so the whole cast fits in one image
        remap = {}
        for k in set(ch for row in c.g for ch in row if ch != '.'):
            nk = '%s@%d' % (k, i)
            remap[k] = nk
            merged[nk] = pal[k]
        c.replace(remap)
        strip.blit(c, x, H - 2 - c.h)
        x += c.w + 4

    pix, PW, PH = canvases_to_sheet([strip], {k: hexc(v) for k, v in merged.items()})
    s, out = a.scale, []
    for y in range(PH * s):
        for x2 in range(PW * s):
            p = pix[(y // s) * PW + (x2 // s)]
            if p[3] == 0:
                g = 52 if ((x2 // s) + (y // s)) % 2 else 78
                p = (g, g, g, 255)
            out.append(p)
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    write_png(a.out, out, PW * s, PH * s)
    print('%s  (%dx%d, %d actors)' % (os.path.relpath(a.out, ROOT), PW * s, PH * s, len(frames)))


if __name__ == '__main__':
    main()
