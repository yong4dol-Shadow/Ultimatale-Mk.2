#!/usr/bin/env python3
"""
gen_maps.py - build the overworld grids and splice them into js/data_maps.js.

Hand-typing 48x32 ASCII grids five times over is where miscounted rows come
from, so the layouts are described with rectangles and corridors here and
rasterised. Every map is then flood-filled from its spawn point to prove the
gate, every terminal, crate, pod and emerald is actually reachable - a map
that fails that check would make the stage unwinnable.

    python3 tools/gen_maps.py [--check]
"""

import argparse
import os
import re
import sys
from collections import deque

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(ROOT, 'js', 'data_maps.js')

W, H = 80, 56


class Grid:
    def __init__(self, fill, wall):
        self.g = [[fill] * W for _ in range(H)]
        self.fill = fill
        for x in range(W):
            self.g[0][x] = wall
            self.g[H - 1][x] = wall
        for y in range(H):
            self.g[y][0] = wall
            self.g[y][W - 1] = wall

    def rect(self, x, y, w, h, c):
        for j in range(h):
            for i in range(w):
                if 0 < x + i < W - 1 and 0 < y + j < H - 1:
                    self.g[y + j][x + i] = c

    def box(self, x, y, w, h, wall, inner=None, doors=()):
        """Hollow room; `doors` are (side, offset) with side in 'NSEW'."""
        self.rect(x, y, w, h, wall)
        if inner is not None:
            self.rect(x + 1, y + 1, w - 2, h - 2, inner)
        for side, off in doors:
            if side == 'N': self.rect(x + off, y, 2, 1, inner or self.fill)
            elif side == 'S': self.rect(x + off, y + h - 1, 2, 1, inner or self.fill)
            elif side == 'W': self.rect(x, y + off, 1, 2, inner or self.fill)
            elif side == 'E': self.rect(x + w - 1, y + off, 1, 2, inner or self.fill)

    def hroad(self, y, c, line=None):
        self.rect(1, y, W - 2, 3, c)
        if line:
            for x in range(2, W - 2, 2):
                self.g[y + 1][x] = line

    def vroad(self, x, c):
        self.rect(x, 1, 3, H - 2, c)

    def put(self, x, y, c):
        self.g[y][x] = c

    def rows(self):
        return [''.join(r) for r in self.g]


def reachable(rows, solid, obj_chars):
    """Flood fill from S; return (ok, unreachable object list)."""
    start = None
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c == 'S':
                start = (x, y)
    if not start:
        return False, ['no spawn']
    seen = {start}
    q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if not (0 <= nx < W and 0 <= ny < H) or (nx, ny) in seen:
                continue
            c = rows[ny][nx]
            # objects sit on floor tiles and are walked up to, not through;
            # crates, pods and the closed gate block, so only step onto floor
            if c in solid:
                continue
            seen.add((nx, ny))
            if c in 'CPG':      # blockers: reachable, but you cannot pass through
                continue
            q.append((nx, ny))
    missing = []
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c in obj_chars and (x, y) not in seen:
                missing.append('%s at %d,%d' % (c, x, y))
    return not missing, missing


# --------------------------------------------------------------------------
# Layouts. Everything is laid out in tiles; at 80x56 a stage is roughly four
# screens across and three and a half down, which is what the "매우 빠름"
# movement speed needs to feel like travel rather than a corridor.
# --------------------------------------------------------------------------
def westopolis():
    g = Grid(',', '#')
    for y in (8, 20, 32, 44):
        g.hroad(y, '.', '-')
    for x in (18, 40, 62):
        g.vroad(x, '.')
    blocks = [(2, 2, 12, 5), (24, 2, 12, 5), (46, 2, 12, 5), (68, 2, 9, 5),
              (2, 12, 12, 6), (24, 12, 12, 6), (46, 12, 12, 6), (68, 12, 9, 6),
              (2, 24, 12, 6), (24, 24, 12, 6), (46, 24, 12, 6), (68, 24, 9, 6),
              (2, 36, 12, 6), (24, 36, 12, 6), (46, 36, 12, 6), (68, 36, 9, 6),
              (2, 48, 12, 6), (24, 48, 12, 6), (46, 48, 12, 6)]
    for i, (x, y, w, h) in enumerate(blocks):
        g.rect(x, y, w, h, '%' if i % 3 else '#')
    for x, y in ((16, 14), (38, 27), (60, 39), (22, 50), (66, 16)):
        g.put(x, y, 'x')
    for x, y in ((12, 10), (50, 22), (30, 46), (72, 34)):
        g.put(x, y, 'o')
    g.put(2, 9, 'S')
    g.put(16, 3, 'T'); g.put(44, 34, 'T'); g.put(66, 50, 'T')
    g.put(38, 10, 'V'); g.put(60, 46, 'V')
    g.put(52, 21, 'E')
    g.put(76, 53, 'G')
    return g


def glyphic_canyon():
    g = Grid('.', '#')
    g.rect(40, 1, 39, 26, ',')
    g.rect(2, 32, 34, 22, ',')
    for x, y in ((8, 6), (8, 7), (20, 14), (20, 15), (56, 36), (56, 37),
                 (68, 10), (68, 11), (30, 44), (30, 45), (46, 20), (46, 21)):
        g.put(x, y, '|')
    g.box(10, 16, 13, 10, '=', '.', (('S', 5),))
    g.box(48, 38, 15, 12, '=', '.', (('N', 6),))
    g.box(30, 4, 12, 9, '=', '.', (('E', 3),))
    g.box(62, 20, 14, 11, '=', '.', (('W', 4),))
    g.rect(26, 28, 20, 4, '#')
    g.rect(34, 28, 4, 4, '.')
    g.put(2, 2, 'S')
    g.put(16, 21, 'T'); g.put(55, 44, 'T'); g.put(35, 8, 'T')
    g.put(8, 40, 'C'); g.put(50, 14, 'C'); g.put(72, 34, 'C')
    g.put(26, 46, 'P'); g.put(66, 6, 'P'); g.put(14, 6, 'P')
    g.put(68, 25, 'V'); g.put(20, 36, 'V')
    g.put(76, 4, 'E')
    g.put(76, 53, 'G')
    return g


def ark():
    g = Grid('#', '#')
    for y in (4, 13, 22, 31, 40, 49):
        g.rect(2, y, 76, 5, '.')
    for x in (6, 20, 34, 48, 62, 74):
        g.rect(x, 4, 4, 50, '.')
    g.rect(50, 1, 29, 3, '*')
    g.rect(2, 1, 20, 3, '*')
    for x, y in ((26, 6), (56, 24), (12, 42), (68, 33)):
        g.rect(x, y, 4, 3, '=')
    g.rect(2, 8, 3, 4, ',')
    g.rect(40, 44, 8, 4, ',')
    g.put(3, 5, 'S')
    g.put(16, 14, 'T'); g.put(52, 6, 'T'); g.put(30, 50, 'T')
    g.put(44, 23, 'V'); g.put(10, 41, 'V')
    g.put(66, 14, 'E'); g.put(22, 32, 'E')
    g.put(76, 51, 'G')
    return g


def gun_fortress():
    g = Grid('.', '#')
    for x, y, w, h in ((6, 4, 14, 10), (26, 4, 14, 10), (46, 4, 14, 10),
                       (6, 20, 14, 10), (26, 20, 14, 10), (46, 20, 14, 10),
                       (6, 36, 14, 10), (26, 36, 14, 10), (46, 36, 14, 10),
                       (64, 8, 13, 14), (64, 30, 13, 14)):
        g.box(x, y, w, h, '#', '.', (('S', 6),))
    g.rect(2, 48, 50, 4, '!')
    g.rect(22, 16, 32, 2, '=')
    g.rect(22, 32, 32, 2, '=')
    g.rect(2, 2, 4, 3, '.')
    g.put(2, 2, 'S')
    g.put(12, 9, 'C'); g.put(32, 9, 'C'); g.put(12, 25, 'C'); g.put(70, 15, 'C')
    g.put(52, 25, 'T'); g.put(70, 37, 'T'); g.put(32, 41, 'T')
    g.put(52, 9, 'V'); g.put(12, 41, 'V')
    g.put(52, 41, 'E')
    g.put(77, 52, 'G')
    return g


def black_comet():
    g = Grid('.', '#')
    for x, y in ((10, 6), (34, 10), (20, 30), (56, 36), (30, 46), (64, 16),
                 (46, 22), (8, 44)):
        g.rect(x, y, 7, 4, ',')
    for x, y, w, h in ((14, 4, 13, 10), (44, 4, 14, 10), (8, 20, 14, 12),
                       (34, 22, 16, 12), (60, 26, 13, 10), (24, 40, 15, 12),
                       (54, 44, 14, 10)):
        g.box(x, y, w, h, '#', '.', (('S', 6),))
    g.put(2, 2, 'S')
    for x, y in ((20, 8), (50, 8), (14, 26), (41, 28), (66, 31), (31, 46),
                 (60, 48), (72, 6)):
        g.put(x, y, 'P')
    g.put(40, 16, 'V'); g.put(70, 42, 'V')
    g.put(76, 4, 'E'); g.put(3, 53, 'E')
    g.put(76, 52, 'G')
    return g


MAPS = [
    ('westopolis', westopolis, '#%x'),
    ('glyphic_canyon', glyphic_canyon, '#=|'),
    ('ark', ark, '#*='),
    ('gun_fortress', gun_fortress, '#='),
    ('black_comet', black_comet, '#'),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true', help='validate only')
    a = ap.parse_args()

    src = open(TARGET, encoding='utf-8').read()
    fail = False
    for name, fn, solid in MAPS:
        grid = fn()
        # the exit is drawn as a 2x3-tile door, so clear its footprint
        for y in range(H):
            for x in range(W):
                if grid.g[y][x] == 'G':
                    for j in range(-2, 1):
                        for i in range(0, 2):
                            gx, gy = x + i, y + j
                            if 0 < gx < W - 1 and 0 < gy < H - 1 and grid.g[gy][gx] != 'G':
                                grid.g[gy][gx] = grid.fill
        rows = grid.rows()
        assert len(rows) == H and all(len(r) == W for r in rows), name
        ok, missing = reachable(rows, solid, 'TCPEGV')
        counts = {c: sum(r.count(c) for r in rows) for c in 'STCPEGV'}
        print('%-16s %dx%d  %s  %s' % (
            name, W, H,
            ' '.join('%s%d' % (k, v) for k, v in counts.items() if v),
            'reachable' if ok else 'UNREACHABLE: ' + ', '.join(missing)))
        if not ok or counts['S'] != 1 or counts['G'] < 1:
            fail = True
        if not a.check:
            block = ',\n'.join("        '%s'" % r for r in rows)
            pat = re.compile(r"(id: '%s',.*?rows: \[\n).*?(\n      \],)" % name, re.S)
            new, n = pat.subn(lambda m: m.group(1) + block + m.group(2), src)
            if n != 1:
                print('  could not splice %s (%d matches)' % (name, n))
                fail = True
            src = new

    if not a.check and not fail:
        open(TARGET, 'w', encoding='utf-8').write(src)
        print('\nwrote ' + os.path.relpath(TARGET, ROOT))
    return 1 if fail else 0


if __name__ == '__main__':
    sys.exit(main())
