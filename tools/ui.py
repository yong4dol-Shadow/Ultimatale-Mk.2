"""ui.py - HUD, projectile and effect sprites (all procedural)."""

import math
from pixel import Canvas, hexc
from tiles import TILE_PAL

UI_PAL = dict(TILE_PAL)
UI_PAL.update({
    'q': '#ff2d55', 'Q': '#8c0a22',    # soul red
    'j': '#39ff88', 'J': '#0f8c45',    # soul green
    'h': '#ffffff', 'x': '#ff8a1f',
    # the two button tones: UNDERTALE keeps every command button one colour
    # until the cursor lands on it, so the icons are recoloured to match
    'O3': '#a85107', 'Y2': '#ffef5a',
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


def soul_halo():
    """The graze outline DELTARUNE puts around the soul.

    A ring hugging the heart itself - a plain circle would read as a bubble,
    and the point is that the *soul* lit up.  It needs its own 20x20 sheet:
    the heart already fills its 16x16 cell edge to edge, so there is nowhere
    inside that cell to put a ring."""
    src = Canvas(20, 20)
    src.blit(_heart('q', 'Q'), 2, 2)
    cv = Canvas(20, 20)
    for y in range(20):
        for x in range(20):
            if src.get(x, y) != '.':
                continue
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if src.get(x + dx, y + dy) not in ('.', None):
                        cv.px(x, y, 'h')
    return cv


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


# ---- large props --------------------------------------------------------
def exit_door(open_):
    """The stage exit: two tiles wide, three tall, so it cannot be mistaken
    for scenery the way the old single-tile gate could."""
    cv = Canvas(32, 48)
    frame = 'g' if open_ else 'r'
    cv.rect(0, 0, 32, 48, '3')                       # housing
    cv.rect(2, 2, 28, 44, '2')
    cv.rect_out(0, 0, 32, 48, '1')
    for i in range(3):                               # hazard chevrons
        cv.poly([(4, 6 + i * 14), (10, 12 + i * 14), (4, 18 + i * 14)], frame)
        cv.poly([(28, 6 + i * 14), (22, 12 + i * 14), (28, 18 + i * 14)], frame)
    if open_:
        cv.rect(11, 4, 10, 40, '0')                  # the way through
        for j in range(5):
            cv.rect(11, 6 + j * 8, 10, 2, 'C')
        cv.rect(10, 4, 1, 40, 'g')
        cv.rect(21, 4, 1, 40, 'g')
    else:
        cv.rect(6, 4, 20, 40, '4')                   # shutter
        for j in range(0, 40, 5):
            cv.rect(6, 4 + j, 20, 1, '2')
        cv.rect(13, 18, 6, 10, 'y')                  # big lock
        cv.rect(15, 22, 2, 5, '1')
        cv.ellipse(16, 18, 4.5, 4.5, 'y')
        cv.ellipse(16, 18, 2.6, 2.6, '4')
        cv.rect(6, 4, 20, 1, 'r')
        cv.rect(6, 43, 20, 1, 'r')
    cv.rect(0, 46, 32, 2, '1')
    return cv


def save_point(lit):
    """A save pillar. Deliberately unlike the mission terminals: taller,
    a different silhouette, and a spinning ring on top."""
    cv = Canvas(24, 36)
    cv.rect(7, 12, 10, 20, '4')                      # column
    cv.rect(8, 13, 8, 18, '3')
    cv.rect(4, 30, 16, 5, '4')                       # base
    cv.rect(5, 31, 14, 3, '5')
    cv.rect(2, 34, 20, 2, '2')
    for j in range(3):
        cv.rect(8, 16 + j * 5, 8, 1, '5')
    body = 'y' if lit else 'C'
    glow = '8' if lit else 'c'
    cv.ellipse(12, 8, 7.5, 7.5, body)                # ring
    cv.ellipse(12, 8, 4.6, 4.6, '.')
    cv.ellipse(12, 8, 3.0, 3.0, glow)
    cv.px(9, 4, '8')
    if lit:
        for i in range(6):
            a = i * 1.05
            cv.px(12 + math.cos(a) * 10, 8 + math.sin(a) * 10, 'y')
    cv.outline('0')
    return cv


# ---- menu icons ---------------------------------------------------------
def mono(cv, light, dark):
    """Recolour a finished icon into one hue, keeping its black outline.

    UNDERTALE's four command buttons are all the same colour until the
    cursor lands on one; four differently coloured icons inside identical
    orange boxes would look like a mistake, so the icons follow the text.
    """
    out = cv.clone()
    for y in range(cv.h):
        for x in range(cv.w):
            c = cv.get(x, y)
            if c in ('.', '0', None):
                continue
            r, g, b, _ = hexc(UI_PAL[c])
            lum = (r * 299 + g * 587 + b * 114) / 1000.0
            out.px(x, y, light if lum > 140 else dark)
    return out


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


def flare(i):
    """Golden fire, for where a Chaos Spear punched through.

    The lance is energy, not a blade, so the wound should burn rather than
    cut - the slash streak read as a sword stroke and, being long and thin,
    looked stretched next to the enemy sprite.  Four frames: the pierce
    flash, then a flame that swells and lifts as it thins out.  Colour ramp
    is orange rim -> gold body -> white heart, the same ramp as the Air
    Shoes, so the two fires belong to the same game.
    """
    cv = Canvas(24, 24)
    cx, base = 12.0, 17.0
    if i == 0:                                   # the puncture itself
        cv.ellipse(cx, base, 7.0, 3.4, 'y')
        cv.ellipse(cx, base, 4.0, 1.8, 'h')
        for k in range(8):                       # sparks thrown sideways
            a = k * 0.785
            cv.line(cx + math.cos(a) * 3.4, base + math.sin(a) * 1.8,
                    cx + math.cos(a) * 10.0, base + math.sin(a) * 5.4, 'y')
        cv.outline('0')
        return cv

    h = 9.0 + i * 3.0                            # flame height
    w = 6.6 - i * 1.0                            # half-width at the base
    lift = (i - 1) * 2.0
    wob = lambda k: math.sin(k * 3.0 + i * 1.7) * 1.7

    def tongue(scale, shrink, col):
        n = 10
        for step in range(n):
            k = step / (n - 1.0)
            r = (w - shrink) * (1.0 - k * 0.86)
            if r <= 0.4:
                return
            cv.ellipse(cx + wob(k) * scale, base - lift - h * scale * k,
                       r * 1.05, r, col)

    tongue(1.00, 0.0, 'o')                       # orange envelope
    tongue(0.93, 1.0, 'y')                       # gold body - the flame
                                                 # reads yellow, orange is a rim
    tongue(0.55, 3.6, 'h')                       # white heart
    for k in range(3 + i):                       # embers lifting off the tip
        a = k * 1.3 + i
        ey = base - lift - h - 1.0 - (k % 3) * 2.0
        if ey >= 2:                              # keep the outline in the cell
            cv.px(cx + math.cos(a) * (4.0 + i), ey, 'y')
    cv.outline('0')
    return cv


def impact(i):
    """A bullet strike: a spark flash and a puff, gone in three frames.

    The slash streak reads as a sword cut - wrong for a pistol round, and it
    is the one effect that looked stretched out at 320x240."""
    cv = Canvas(16, 16)
    if i == 0:
        cv.circle(8, 8, 2.2, '8')
        for k in range(6):                      # the first flash throws sparks
            a = k * 1.047
            cv.line(8 + math.cos(a) * 2.4, 8 + math.sin(a) * 2.4,
                    8 + math.cos(a) * 5.2, 8 + math.sin(a) * 5.2, 'y')
    elif i == 1:
        cv.circle(8, 8, 3.4, 'o')
        cv.circle(8, 8, 1.8, 'y')
        for k in range(5):
            a = k * 1.257 + 0.4
            cv.px(8 + math.cos(a) * 6.0, 8 + math.sin(a) * 6.0, 'r')
    else:
        cv.circle(8, 8, 3.0, 'r')
        cv.circle(8, 8, 1.4, 'o')
        for k in range(4):
            a = k * 1.571 + 0.8
            cv.px(8 + math.cos(a) * 6.6, 8 + math.sin(a) * 6.6, 'o')
    cv.outline('0')
    return cv


