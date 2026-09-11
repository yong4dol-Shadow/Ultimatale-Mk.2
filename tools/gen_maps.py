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

W, H = 208, 144


class Grid:
    def __init__(self, fill, wall, floor=None):
        self.g = [[fill] * W for _ in range(H)]
        self.fill = fill
        # `floor` is every walkable character, not just the base fill: a
        # grass patch or a road is as good a place for a prop as bare sand.
        # ARK also starts as solid rock with its corridors carved out, so
        # there its base fill is a wall and floor must be named explicitly.
        self.floor = floor or fill
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

    def free(self, x, y, w, h):
        """True when the whole rect is still untouched base floor."""
        if x < 1 or y < 1 or x + w > W - 1 or y + h > H - 1:
            return False
        for j in range(h):
            for i in range(w):
                if self.g[y + j][x + i] not in self.floor:
                    return False
        return True

    def block(self, x, y, w, h, c):
        """Place a building only where it will not sit on a road."""
        if self.free(x, y, w, h):
            self.rect(x, y, w, h, c)
            return True
        return False

    def place(self, x, y, c):
        """Drop an object on the nearest open floor tile, spiralling out.

        Layouts move around as the maps grow; pinning objects to exact
        coordinates is how they end up buried inside a wall and fail the
        reachability check."""
        for r in range(0, 14):
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    if max(abs(dx), abs(dy)) != r:
                        continue
                    nx, ny = x + dx, y + dy
                    if 0 < nx < W - 1 and 0 < ny < H - 1 and self.g[ny][nx] in self.floor:
                        self.g[ny][nx] = c
                        return True
        raise ValueError('no open floor near %d,%d for %r' % (x, y, c))

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
# Layouts. Everything is laid out in tiles; at 208x144 a stage is about ten
# screens across and nine down, which is what the spin dash needs - a run-up
# that ends in a wall two seconds later is not a run-up. The layouts are
# deliberately loose: wide roads, big open plates between the structures,
# and obstacles that break the sight line rather than the route. Objects are
# dropped with place(), which finds the nearest open floor rather than
# trusting a hard-coded coordinate, so the absolute numbers below only have
# to be roughly right.
# --------------------------------------------------------------------------
def westopolis():
    g = Grid(',', '#', floor=',.-o')
    for y in range(9, H - 8, 17):
        g.hroad(y, '.', '-')
    for x in range(20, W - 14, 26):
        g.vroad(x, '.')
    # every third block is left out entirely: a city you can actually run
    # across needs plazas, not a solid grid of buildings
    for by in range(2, H - 6, 17):
        for bx in range(2, W - 10, 15):
            if (bx // 15 + by // 17) % 3 == 2:
                continue
            g.block(bx, by, 11, 6, '%' if (bx // 15 + by // 17) % 2 else '#')
    for i in range(14):
        g.place(9 + i * 8, 6 + (i % 5) * 15, 'x')
    for i in range(9):
        g.place(16 + i * 13, 12 + (i % 4) * 18, 'o')
    g.place(5, 16, 'S')
    g.place(39, 6, 'T'); g.place(114, 84, 'T'); g.place(169, 130, 'T')
    g.place(98, 20, 'V'); g.place(156, 101, 'V')
    g.place(136, 55, 'E')
    g.place(39, 18, 'B'); g.place(112, 52, 'B'); g.place(182, 120, 'B')
    g.place(23, 39, 'N'); g.place(86, 91, 'N'); g.place(153, 31, 'N')
    g.place(160, 22, 'B'); g.place(60, 118, 'B'); g.place(188, 96, 'B')
    g.place(96, 46, 'N'); g.place(30, 96, 'N')
    g.place(46, 62, 'L'); g.place(118, 34, 'L'); g.place(150, 120, 'L')
    # set dressing, spread on a coprime stride so it never lines up into rows
    for i in range(360):
        g.place(9 + (i * 37) % (W - 18), 7 + (i * 53) % (H - 14), 'D')
    g.put(W - 4, H - 3, 'G')
    return g


def glyphic_canyon():
    g = Grid('.', '#', floor='.,')
    g.rect(64, 1, 63, 42, ',')
    g.rect(2, 50, 56, 36, ',')
    for i in range(14):
        x, y = 8 + (i * 29) % (W - 20), 6 + (i * 37) % (H - 16)
        g.block(x, y, 2, 3, '|')
    rooms = [(14, 24, 18, 14), (74, 58, 22, 18), (44, 6, 18, 13),
             (96, 28, 20, 16), (22, 62, 20, 16), (60, 30, 16, 12)]
    for i, (x, y, w, h) in enumerate(rooms):
        g.box(x, y, w, h, '=', '.', (('SNEW'[i % 4], w // 3),))
    g.rect(40, 44, 30, 5, '#')
    g.rect(52, 44, 6, 5, '.')
    g.place(5, 5, 'S')
    g.place(36, 49, 'T'); g.place(136, 107, 'T'); g.place(83, 18, 'T')
    g.place(20, 101, 'C'); g.place(127, 32, 'C'); g.place(185, 84, 'C')
    g.place(65, 120, 'P'); g.place(169, 14, 'P'); g.place(32, 16, 'P')
    g.place(176, 65, 'V'); g.place(49, 78, 'V')
    g.place(198, 10, 'E')
    g.place(26, 16, 'B'); g.place(130, 44, 'B'); g.place(73, 120, 'B')
    g.place(52, 78, 'N'); g.place(166, 101, 'N')
    g.place(150, 18, 'B'); g.place(36, 118, 'B'); g.place(188, 74, 'B')
    g.place(104, 34, 'N'); g.place(72, 122, 'N')
    g.place(24, 44, 'L'); g.place(128, 96, 'L'); g.place(176, 128, 'L')
    # set dressing, spread on a coprime stride so it never lines up into rows
    for i in range(320):
        g.place(9 + (i * 37) % (W - 18), 7 + (i * 53) % (H - 14), 'D')
    g.put(W - 4, H - 3, 'G')
    return g


def ark():
    g = Grid('#', '#', floor='.,')
    for y in range(5, H - 8, 12):
        g.rect(2, y, W - 4, 6, '.')
    # the spine corridors have to actually meet the bottom deck - at the old
    # height they stopped a row short of it and walled the exit off
    for x in range(7, W - 8, 17):
        g.rect(x, 5, 5, H - 8, '.')
    g.rect(2, H - 6, W - 4, 4, '.')
    g.rect(70, 1, 57, 4, '*')
    g.rect(2, 1, 30, 4, '*')
    for i in range(8):
        g.rect(16 + i * 14, 8 + (i % 4) * 12, 5, 4, '=')
    for i in range(6):
        g.rect(10 + i * 20, 18 + (i % 3) * 24, 6, 5, ',')
    g.place(6, 12, 'S')
    g.place(42, 29, 'T'); g.place(140, 13, 'T'); g.place(81, 127, 'T')
    g.place(114, 68, 'V'); g.place(29, 107, 'V')
    g.place(176, 32, 'E'); g.place(62, 88, 'E')
    g.place(18, 16, 'B'); g.place(96, 39, 'B'); g.place(156, 114, 'B')
    g.place(60, 34, 'N'); g.place(127, 78, 'N'); g.place(34, 120, 'N')
    g.place(160, 20, 'B'); g.place(36, 92, 'B'); g.place(110, 132, 'B')
    g.place(126, 76, 'N'); g.place(68, 44, 'N')
    g.place(20, 62, 'L'); g.place(92, 20, 'L'); g.place(150, 108, 'L'); g.place(186, 44, 'L')
    # set dressing, spread on a coprime stride so it never lines up into rows
    for i in range(320):
        g.place(9 + (i * 37) % (W - 18), 7 + (i * 53) % (H - 14), 'D')
    g.put(W - 4, H - 3, 'G')
    return g


def gun_fortress():
    g = Grid('.', '#', floor='.!')
    for by in range(4, H - 16, 22):
        for bx in range(6, W - 24, 28):
            g.box(bx, by, 18, 13, '#', '.', (('S', 8),))
    g.box(W - 20, 10, 17, 20, '#', '.', (('W', 8),))
    g.box(W - 20, 44, 17, 20, '#', '.', (('W', 8),))
    g.rect(2, H - 8, 70, 5, '!')
    # pipe runs sit in the gaps between room bands, in segments - a solid
    # run here lands exactly on the rooms' door rows and seals them shut
    for i in range(4):
        for seg in range(3):
            g.rect(30 + seg * 22, 19 + i * 18, 13, 2, '=')
    g.rect(2, 2, 5, 4, '.')
    g.place(5, 5, 'S')
    g.place(26, 16, 'C'); g.place(98, 16, 'C'); g.place(26, 75, 'C'); g.place(182, 29, 'C')
    g.place(133, 75, 'T'); g.place(182, 88, 'T'); g.place(98, 104, 'T')
    g.place(133, 16, 'V'); g.place(26, 104, 'V')
    g.place(62, 75, 'E')
    g.place(31, 21, 'B'); g.place(125, 42, 'B'); g.place(68, 112, 'B')
    g.place(169, 31, 'N'); g.place(44, 88, 'N')
    g.place(150, 20, 'B'); g.place(34, 118, 'B'); g.place(190, 90, 'B')
    g.place(96, 52, 'N'); g.place(60, 128, 'N')
    g.place(24, 44, 'L'); g.place(118, 96, 'L'); g.place(170, 128, 'L')
    # set dressing, spread on a coprime stride so it never lines up into rows
    for i in range(320):
        g.place(9 + (i * 37) % (W - 18), 7 + (i * 53) % (H - 14), 'D')
    g.put(W - 4, H - 3, 'G')
    return g


def black_comet():
    g = Grid('.', '#', floor='.,')
    for i in range(18):
        g.rect(8 + (i * 13) % (W - 20), 6 + (i * 19) % (H - 14), 8, 5, ',')
    chambers = [(20, 6, 20, 14), (66, 6, 22, 14), (10, 30, 20, 17),
                (50, 32, 24, 18), (92, 38, 20, 15), (34, 60, 22, 18),
                (78, 66, 22, 15), (104, 8, 18, 14)]
    for i, (x, y, w, h) in enumerate(chambers):
        g.box(x, y, w, h, '#', '.', (('SNEW'[i % 4], w // 3),))
    g.place(5, 5, 'S')
    for i, (x, y) in enumerate(((28, 12), (76, 12), (18, 38), (60, 40),
                                (100, 45), (44, 68), (88, 72), (112, 14))):
        g.place(x, y, 'P')
    g.place(101, 39, 'V'); g.place(179, 107, 'V')
    g.place(198, 8, 'E'); g.place(6, 136, 'E')
    g.place(39, 26, 'B'); g.place(140, 39, 'B'); g.place(78, 112, 'B')
    g.place(114, 73, 'N'); g.place(23, 96, 'N')
    g.place(160, 24, 'B'); g.place(40, 116, 'B'); g.place(190, 80, 'B')
    g.place(100, 40, 'N'); g.place(66, 128, 'N')
    g.place(26, 58, 'L'); g.place(132, 98, 'L'); g.place(180, 130, 'L')
    # set dressing, spread on a coprime stride so it never lines up into rows
    for i in range(320):
        g.place(9 + (i * 37) % (W - 18), 7 + (i * 53) % (H - 14), 'D')
    g.put(W - 4, H - 3, 'G')
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
                                grid.g[gy][gx] = grid.floor[0]
        rows = grid.rows()
        assert len(rows) == H and all(len(r) == W for r in rows), name
        ok, missing = reachable(rows, solid, 'TCPEGVBNL')
        counts = {c: sum(r.count(c) for r in rows) for c in 'STCPEGVBNLD'}
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
