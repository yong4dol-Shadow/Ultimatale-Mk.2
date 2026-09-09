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

W, H = 48, 32


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
def westopolis():
    g = Grid(',', '#')
    for y in (7, 15, 23):
        g.hroad(y, '.', '-')
    g.vroad(21, '.')
    for x, y, w, h in ((2, 2, 6, 4), (36, 2, 8, 4), (2, 10, 5, 4), (40, 10, 5, 4),
                       (2, 18, 7, 4), (30, 18, 6, 4), (2, 26, 5, 4), (36, 26, 8, 4)):
        g.rect(x, y, w, h, '%')
    for x, y in ((11, 11), (30, 11), (13, 27), (28, 5)):
        g.put(x, y, 'x')
    for x, y in ((9, 16), (33, 24), (18, 8)):
        g.put(x, y, 'o')
    g.put(2, 8, 'S')
    g.put(14, 3, 'T'); g.put(12, 19, 'T'); g.put(33, 27, 'T')
    g.put(26, 12, 'E')
    g.put(45, 29, 'G')
    return g


def glyphic_canyon():
    g = Grid('.', '#')
    g.rect(26, 1, 21, 14, ',')                       # grass shelf
    g.rect(2, 18, 18, 12, ',')
    for x, y in ((6, 4), (6, 5), (14, 8), (14, 9), (34, 20), (34, 21), (40, 6), (40, 7)):
        g.put(x, y, '|')
    g.box(8, 10, 9, 7, '=', '.', (('S', 3),))
    g.box(30, 22, 11, 8, '=', '.', (('N', 4),))
    g.box(20, 3, 8, 6, '=', '.', (('E', 2),))
    g.rect(20, 16, 12, 3, '#')
    g.rect(24, 16, 3, 3, '.')
    g.put(2, 2, 'S')
    g.put(12, 13, 'T'); g.put(34, 26, 'T'); g.put(23, 5, 'T')
    g.put(6, 22, 'C'); g.put(30, 8, 'C'); g.put(43, 18, 'C')
    g.put(16, 25, 'P'); g.put(38, 12, 'P'); g.put(9, 6, 'P')
    g.put(45, 3, 'E')
    g.put(45, 29, 'G')
    return g


def ark():
    g = Grid('#', '#')
    for y in (3, 10, 17, 24):                        # decks
        g.rect(2, y, 44, 4, '.')
    for x in (4, 15, 26, 37, 43):                    # risers between decks
        g.rect(x, 3, 3, 27, '.')                     # must reach the exit deck
    g.rect(30, 1, 16, 2, '*')
    g.rect(2, 28, 44, 3, ',')
    g.rect(20, 29, 8, 2, '.')
    g.rect(19, 5, 3, 2, '=')
    g.rect(33, 19, 3, 2, '=')
    g.put(3, 4, 'S')
    g.put(9, 11, 'T'); g.put(31, 4, 'T'); g.put(20, 25, 'T')
    g.put(40, 11, 'E'); g.put(11, 25, 'E')
    g.put(44, 29, 'G')
    return g


def gun_fortress():
    g = Grid('.', '#')
    for x, y, w, h in ((6, 4, 10, 7), (22, 4, 10, 7), (6, 15, 10, 7),
                       (22, 15, 10, 7), (36, 8, 9, 9), (36, 21, 9, 8)):
        g.box(x, y, w, h, '#', '.', (('S', 4),))
    g.rect(2, 25, 30, 3, '!')
    g.rect(16, 12, 16, 2, '=')
    g.rect(2, 2, 3, 2, '.')
    g.put(2, 2, 'S')
    g.put(10, 7, 'C'); g.put(26, 7, 'C'); g.put(10, 18, 'C'); g.put(40, 12, 'C')
    g.put(26, 18, 'T'); g.put(40, 25, 'T'); g.put(19, 30, 'T')
    g.put(34, 3, 'E')
    g.put(45, 30, 'G')
    return g


def black_comet():
    g = Grid('.', '#')
    for x, y in ((6, 4), (26, 6), (14, 18), (36, 22), (20, 27), (40, 10)):
        g.rect(x, y, 5, 3, ',')
    for x, y, w, h in ((10, 3, 9, 7), (30, 3, 10, 7), (6, 14, 10, 8),
                       (24, 15, 12, 8), (38, 24, 8, 6)):
        g.box(x, y, w, h, '#', '.', (('S', 4),))
    g.put(2, 2, 'S')
    for x, y in ((14, 6), (34, 6), (10, 18), (29, 19), (41, 27), (20, 11)):
        g.put(x, y, 'P')
    g.put(45, 3, 'E'); g.put(3, 29, 'E')
    g.put(44, 29, 'G')
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
        rows = fn().rows()
        assert len(rows) == H and all(len(r) == W for r in rows), name
        ok, missing = reachable(rows, solid, 'TCPEG')
        counts = {c: sum(r.count(c) for r in rows) for c in 'STCPEG'}
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
