"""tiles.py - 16x16 overworld tiles, all drawn procedurally.

One shared 34-colour palette keeps every zone on the same 16-bit
console-style ramp.  A seeded LCG supplies the speckle/grime noise so the
output is byte-identical on every run.
"""

import math
from pixel import Canvas

TS = 16

TILE_PAL = {
    '0': '#000000', '1': '#12121a', '2': '#23232f', '3': '#3a3a4c',
    '4': '#555569', '5': '#7b7b92', '6': '#a3a3b8', '7': '#d0d0dc',
    '8': '#f2f2f8',
    'r': '#d8232f', 'R': '#8c1119', 'o': '#ff8a1f', 'y': '#ffd23f',
    'Y': '#b8860b', 'g': '#3fa845', 'G': '#1f6b28', 'c': '#7fdcff',
    'C': '#2a7fb8', 'b': '#2f6ad4', 'B': '#16326b', 'p': '#8a3fd0',
    'P': '#4a1c78', 'm': '#4a1220', 'M': '#2a0810', 'n': '#7a2334',
    's': '#c9a06a', 'S': '#8c6a3c', 'k': '#6b6b52', 'K': '#43432f',
    'w': '#5a3a24', 'W': '#3a2414', 'e': '#c0ff3c', 'E': '#6a9a12',
    'v': '#1b1b26',
}


class Rnd:
    def __init__(self, seed):
        self.s = seed & 0x7FFFFFFF or 1

    def next(self):
        self.s = (self.s * 1103515245 + 12345) & 0x7FFFFFFF
        return self.s / 0x7FFFFFFF


def speckle(cv, seed, colors, density=0.14, over=None):
    r = Rnd(seed)
    for y in range(TS):
        for x in range(TS):
            if r.next() < density:
                c = colors[int(r.next() * len(colors)) % len(colors)]
                if over is None or cv.get(x, y) in over:
                    cv.px(x, y, c)


def base(fill):
    cv = Canvas(TS, TS)
    cv.rect(0, 0, TS, TS, fill)
    return cv


# ---- city ---------------------------------------------------------------
def city_road():
    cv = base('2')
    speckle(cv, 11, '13', 0.2)
    cv.rect(0, 7, TS, 2, '3')
    return cv


def city_road_line():
    cv = city_road()
    cv.rect(3, 7, 10, 2, 'y')
    return cv


def city_walk():
    cv = base('4')
    speckle(cv, 23, '35', 0.18)
    cv.rect(0, 0, TS, 1, '3')
    cv.rect(0, 0, 1, TS, '3')
    return cv


def city_wall():
    cv = base('3')
    for j in range(0, TS, 4):
        cv.rect(0, j, TS, 1, '2')
        off = 0 if (j // 4) % 2 == 0 else 4
        for i in range(off, TS, 8):
            cv.rect(i, j, 1, 4, '2')
    speckle(cv, 31, '24', 0.1)
    return cv


def city_window():
    cv = city_wall()
    cv.rect(3, 3, 10, 9, '1')
    cv.rect(4, 4, 8, 7, 'C')
    cv.rect(4, 4, 8, 3, 'c')
    cv.rect(7, 3, 2, 9, '1')
    return cv


def city_rubble():
    cv = base('2')
    r = Rnd(47)
    for _ in range(9):
        x = int(r.next() * 12)
        y = int(r.next() * 12)
        s = 2 + int(r.next() * 3)
        cv.rect(x, y, s, s, '4')
        cv.rect(x, y, s, 1, '5')
    speckle(cv, 51, '13', 0.2)
    return cv


def city_crater():
    cv = base('2')
    cv.ellipse(8, 8, 7, 6, '1')
    cv.ellipse(8, 8, 4.5, 3.5, '0')
    cv.ellipse(8, 9, 2.5, 1.6, 'R')
    speckle(cv, 61, '34', 0.12, over='12')
    return cv


# ---- Space Colony ARK ---------------------------------------------------
def ark_floor():
    cv = base('3')
    cv.rect(0, 0, TS, 1, '4')
    cv.rect(0, TS - 1, TS, 1, '2')
    cv.rect(0, 0, 1, TS, '4')
    cv.rect(TS - 1, 0, 1, TS, '2')
    cv.rect(6, 6, 4, 4, '2')
    cv.rect(6, 6, 4, 1, '5')
    return cv


def ark_wall():
    cv = base('4')
    cv.rect(0, 0, TS, 3, '5')
    cv.rect(0, 13, TS, 3, '2')
    for i in range(2, TS, 6):
        cv.rect(i, 4, 3, 8, '3')
        cv.px(i + 1, 5, '6')
    return cv


def ark_grate():
    cv = base('2')
    for i in range(1, TS, 3):
        cv.rect(i, 1, 2, 14, '4')
    cv.rect(0, 0, TS, 1, '5')
    return cv


def ark_space():
    cv = base('0')
    r = Rnd(97)
    for _ in range(11):
        cv.px(int(r.next() * TS), int(r.next() * TS), '7' if r.next() > .5 else '5')
    cv.rect(0, 0, TS, 1, '4')
    cv.rect(0, TS - 1, TS, 1, '4')
    cv.ellipse(4, 12, 5, 4, 'B')
    cv.ellipse(4, 11, 4, 3, 'b')
    cv.ellipse(3, 10, 2, 1.4, 'c')
    return cv


def ark_console():
    cv = ark_wall()
    cv.rect(2, 3, 12, 8, '1')
    cv.rect(3, 4, 10, 6, 'C')
    for i in range(3):
        cv.rect(4, 5 + i * 2, 4 + i * 2, 1, 'c')
    cv.px(12, 9, 'r')
    return cv


# ---- Glyphic Canyon -----------------------------------------------------
def canyon_sand():
    cv = base('s')
    speckle(cv, 131, 'S8', 0.12)
    return cv


def canyon_rock():
    cv = base('k')
    r = Rnd(137)
    for _ in range(6):
        x, y = int(r.next() * 13), int(r.next() * 13)
        cv.ellipse(x, y, 2.5, 2, 'K')
    speckle(cv, 139, 'K5', 0.14)
    return cv


def canyon_ruin():
    cv = base('S')
    cv.rect_out(0, 0, TS, TS, 'K')
    cv.rect(3, 3, 10, 10, 's')
    cv.rect(5, 5, 6, 6, 'K')
    cv.rect(6, 6, 4, 4, 'e')
    cv.px(8, 8, 'E')
    return cv


def canyon_pillar():
    cv = base('s')
    cv.rect(3, 0, 10, TS, 'S')
    cv.rect(3, 0, 10, 2, 'K')
    cv.rect(3, 14, 10, 2, 'K')
    cv.rect(5, 3, 2, 10, 'K')
    cv.rect(9, 3, 2, 10, 'K')
    return cv


def canyon_grass():
    cv = canyon_sand()
    r = Rnd(151)
    for _ in range(8):
        x, y = int(r.next() * 15), int(r.next() * 13)
        cv.line(x, y + 3, x, y, 'G')
        cv.px(x, y, 'g')
    return cv


# ---- G.U.N. Fortress ----------------------------------------------------
def steel_floor():
    cv = base('4')
    cv.rect_out(0, 0, TS, TS, '3')
    cv.rect(2, 2, 5, 5, '5')
    cv.rect(9, 9, 5, 5, '5')
    speckle(cv, 163, '35', 0.08)
    return cv


def steel_wall():
    cv = base('3')
    cv.rect(0, 0, TS, 2, '5')
    cv.rect(0, 7, TS, 2, '2')
    cv.rect(0, 14, TS, 2, '2')
    for i in (2, 12):
        cv.px(i, 4, '6')
        cv.px(i, 11, '6')
    return cv


def hazard():
    cv = base('1')
    for i in range(-TS, TS, 6):
        cv.poly([(i, 0), (i + 3, 0), (i + 3 + TS, TS), (i + TS, TS)], 'y')
    return cv


def pipe():
    cv = base('3')
    cv.rect(0, 4, TS, 8, '5')
    cv.rect(0, 4, TS, 2, '6')
    cv.rect(0, 10, TS, 2, '3')
    cv.rect(6, 3, 4, 10, '4')
    return cv


# ---- Black Comet --------------------------------------------------------
def flesh_floor():
    cv = base('M')
    speckle(cv, 181, 'mn', 0.16)
    cv.ellipse(5, 5, 2.5, 2, 'm')
    cv.ellipse(11, 11, 2, 1.6, 'm')
    return cv


def flesh_wall():
    cv = base('m')
    r = Rnd(191)
    for _ in range(5):
        x, y = int(r.next() * 14), int(r.next() * 14)
        cv.ellipse(x, y, 3, 2.4, 'n')
        cv.ellipse(x, y, 1.5, 1.2, 'M')
    speckle(cv, 193, 'M', 0.1)
    return cv


def flesh_vein():
    cv = flesh_floor()
    cv.taper_line(0, 3, 15, 12, 2, 1.4, 'n')
    cv.taper_line(0, 3, 15, 12, 1, 0.6, 'e')
    return cv


def alien_pod():
    cv = flesh_wall()
    cv.ellipse(8, 9, 5.5, 6, 'M')
    cv.ellipse(8, 9, 4, 4.5, 'e')
    cv.ellipse(8, 8, 2, 2.4, 'E')
    cv.taper_line(8, 3, 8, 0, 2, 1, 'n')
    return cv


# ---- interactive / common ----------------------------------------------
def gate_locked():
    cv = base('2')
    cv.rect(1, 0, 14, TS, '4')
    for j in range(0, TS, 4):
        cv.rect(1, j, 14, 1, '2')
    cv.rect(6, 5, 4, 6, 'y')
    cv.rect(7, 7, 2, 3, '1')
    cv.ellipse(8, 5, 2.5, 2.5, 'y')
    cv.ellipse(8, 5, 1.4, 1.4, '2')
    cv.rect(0, 0, 1, TS, 'r')
    cv.rect(15, 0, 1, TS, 'r')
    return cv


def gate_open():
    cv = base('2')
    cv.rect(0, 0, 2, TS, '4')
    cv.rect(14, 0, 2, TS, '4')
    cv.rect(0, 0, 1, TS, 'g')
    cv.rect(15, 0, 1, TS, 'g')
    speckle(cv, 211, '13', 0.1)
    return cv


def terminal_off():
    cv = base('2')
    cv.rect(3, 2, 10, 11, '4')
    cv.rect(4, 3, 8, 6, '1')
    cv.rect(5, 10, 6, 2, '3')
    cv.rect(2, 13, 12, 2, '3')
    cv.px(11, 11, '4')
    return cv


def terminal_on():
    cv = terminal_off()
    cv.rect(4, 3, 8, 6, 'C')
    cv.rect(5, 4, 6, 1, 'c')
    cv.rect(5, 6, 4, 1, 'c')
    cv.px(11, 11, 'g')
    return cv


def crate():
    cv = base('w')
    cv.rect_out(0, 0, TS, TS, 'W')
    cv.rect(1, 1, 14, 1, '8')
    cv.line(1, 1, 14, 14, 'W')
    cv.line(14, 1, 1, 14, 'W')
    cv.rect(6, 6, 4, 4, 'Y')
    cv.px(7, 7, 'y')
    return cv


def goal_ring():
    cv = base('2')
    cv.ellipse(8, 8, 7, 7, 'Y')
    cv.ellipse(8, 8, 5, 5, 'y')
    cv.ellipse(8, 8, 3.4, 3.4, '2')
    cv.px(6, 5, '8')
    return cv


def barrier():
    cv = Canvas(TS, TS)
    cv.rect(0, 0, TS, TS, 'C')
    for j in range(0, TS, 3):
        cv.rect(0, j, TS, 1, 'c')
    cv.rect(0, 0, 1, TS, 'c')
    cv.rect(15, 0, 1, TS, 'c')
    return cv


def dark_void():
    return base('0')


TILES = [
    ('void', dark_void), ('road', city_road), ('road_line', city_road_line),
    ('walk', city_walk), ('city_wall', city_wall), ('city_window', city_window),
    ('rubble', city_rubble), ('crater', city_crater),
    ('ark_floor', ark_floor), ('ark_wall', ark_wall), ('ark_grate', ark_grate),
    ('ark_space', ark_space), ('ark_console', ark_console),
    ('sand', canyon_sand), ('rock', canyon_rock), ('ruin', canyon_ruin),
    ('pillar', canyon_pillar), ('grass', canyon_grass),
    ('steel_floor', steel_floor), ('steel_wall', steel_wall),
    ('hazard', hazard), ('pipe', pipe),
    ('flesh_floor', flesh_floor), ('flesh_wall', flesh_wall),
    ('flesh_vein', flesh_vein), ('alien_pod', alien_pod),
    ('gate_locked', gate_locked), ('gate_open', gate_open),
    ('terminal_off', terminal_off), ('terminal_on', terminal_on),
    ('crate', crate), ('goal_ring', goal_ring), ('barrier', barrier),
]
