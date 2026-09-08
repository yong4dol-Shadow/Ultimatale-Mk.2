"""ui.py - HUD, projectile and effect sprites (all procedural)."""

import math
from pixel import Canvas
from tiles import TILE_PAL

UI_PAL = dict(TILE_PAL)
UI_PAL.update({
    'q': '#ff2d55', 'Q': '#8c0a22',    # soul red
    'j': '#39ff88', 'J': '#0f8c45',    # soul green
    'h': '#ffffff', 'x': '#ff8a1f',
})


def _heart(body, dark):
    cv = Canvas(16, 16)
    cv.ellipse(5, 6, 3.6, 3.4, body)
    cv.ellipse(10.5, 6, 3.6, 3.4, body)
    cv.poly([(1.2, 7), (8, 15), (14.8, 7)], body)
    cv.outline('0')
    cv.shade(body, dark)
    cv.px(4, 4, 'h')
    cv.px(5, 4, 'h')
    return cv


def soul_red():
    return _heart('q', 'Q')


def soul_green():
    return _heart('j', 'J')


def emerald(color, dark):
    cv = Canvas(16, 16)
    cv.poly([(8, 1), (14, 6), (11, 14), (5, 14), (2, 6)], color)
    cv.poly([(8, 1), (11, 6), (8, 8), (5, 6)], '8')
    cv.poly([(5, 6), (8, 8), (5, 14), (2, 6)], dark)
    cv.outline('0')
    cv.px(7, 4, 'h')
    return cv


EMERALD_COLORS = [
    ('emerald_cyan', 'c', 'C'), ('emerald_yellow', 'y', 'Y'),
    ('emerald_green', 'g', 'G'), ('emerald_blue', 'b', 'B'),
    ('emerald_purple', 'p', 'P'), ('emerald_red', 'r', 'R'),
    ('emerald_white', '8', '6'),
]


def ring():
    cv = Canvas(16, 16)
    cv.ellipse(8, 8, 6.4, 7.0, 'y')
    cv.ellipse(8, 8, 3.4, 4.2, '.')
    cv.outline('0')
    cv.shade('y', 'Y')
    cv.px(5, 4, '8')
    cv.px(6, 3, '8')
    return cv


# ---- projectiles --------------------------------------------------------
def bullet_small():
    cv = Canvas(8, 8)
    cv.ellipse(4, 4, 2.6, 2.6, '8')
    cv.ellipse(4, 4, 1.4, 1.4, '6')
    cv.outline('0')
    return cv


def bullet_gun():
    cv = Canvas(10, 6)
    cv.ellipse(5, 3, 4.0, 1.8, 'o')
    cv.ellipse(6.5, 3, 2.0, 1.2, 'y')
    cv.outline('0')
    return cv


def chaos_spear():
    cv = Canvas(16, 8)
    cv.poly([(0, 4), (9, 1), (15, 4), (9, 7)], 'c')
    cv.poly([(4, 4), (9, 2.4), (13, 4), (9, 5.6)], '8')
    cv.outline('0')
    return cv


def alien_orb():
    cv = Canvas(12, 12)
    cv.ellipse(6, 6, 5.0, 5.0, 'm')
    cv.ellipse(6, 6, 3.2, 3.2, 'r')
    cv.ellipse(5, 5, 1.4, 1.4, 'e')
    cv.outline('0')
    return cv


def doom_eye():
    cv = Canvas(14, 12)
    cv.ellipse(7, 6, 6.0, 4.4, 'n')
    cv.ellipse(7, 6, 4.0, 3.0, 'r')
    cv.ellipse(7, 6, 1.8, 2.2, '0')
    cv.outline('0')
    return cv


def laser():
    cv = Canvas(16, 6)
    cv.rect(0, 2, 16, 2, 'r')
    cv.rect(0, 1, 16, 1, 'o')
    cv.rect(0, 4, 16, 1, 'R')
    return cv


def blade():
    cv = Canvas(14, 10)
    cv.poly([(0, 8), (10, 0), (13, 3), (4, 9)], '6')
    cv.poly([(2, 8), (10, 1.5), (11, 3)], '8')
    cv.outline('0')
    return cv


# ---- menu icons ---------------------------------------------------------
def icon_fight():
    cv = Canvas(16, 16)
    cv.poly([(2, 13), (11, 2), (13, 4), (4, 14)], '6')
    cv.poly([(3, 12), (10, 3.5), (11, 5)], '8')
    cv.rect(1, 11, 4, 4, 'Y')
    cv.rect(11, 1, 4, 4, 'y')
    cv.outline('0')
    return cv


def icon_act():
    cv = Canvas(16, 16)
    cv.ellipse(8, 10, 5.0, 4.4, '8')
    for i in range(4):
        cv.rect(4 + i * 2.6, 3 + (i % 2), 2, 6, '8')
    cv.rect(2, 8, 3, 4, '8')
    cv.outline('0')
    cv.shade('8', '6')
    return cv


def icon_item():
    cv = Canvas(16, 16)
    cv.rect(2, 5, 12, 9, 'w')
    cv.rect(2, 5, 12, 2, 'W')
    cv.rect(6, 2, 4, 4, 'W')
    cv.rect(7, 3, 2, 2, 'w')
    cv.rect(7, 7, 2, 6, 'y')
    cv.outline('0')
    return cv


def icon_mercy():
    cv = _heart('j', 'J')
    return cv


# ---- effects ------------------------------------------------------------
def slash(i):
    cv = Canvas(28, 28)
    a = 0.5 + i * 0.35
    for k in range(3):
        r = 11 - k * 3
        cv.taper_line(14 + math.cos(a) * r, 14 + math.sin(a) * r,
                      14 - math.cos(a) * r, 14 - math.sin(a) * r,
                      2.6 - k * 0.7, 0.6, '8' if k == 0 else 'c')
    cv.outline('0')
    return cv


def boom(i):
    cv = Canvas(28, 28)
    r = 3 + i * 3.5
    cv.circle(14, 14, r, 'o')
    cv.circle(14, 14, max(r - 3, 0.6), 'y')
    if i >= 2:
        cv.circle(14, 14, max(r - 6, 0.6), '8')
    for k in range(8):
        a = k * 0.785 + i * 0.2
        cv.px(14 + math.cos(a) * (r + 3), 14 + math.sin(a) * (r + 3), 'r')
    cv.outline('0')
    return cv


def graze(i):
    cv = Canvas(16, 16)
    r = 2 + i * 2.2
    for k in range(6):
        a = k * 1.05
        cv.px(8 + math.cos(a) * r, 8 + math.sin(a) * r, 'c')
    return cv
