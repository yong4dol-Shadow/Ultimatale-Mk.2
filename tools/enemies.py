"""enemies.py - parametric sprites for every non-hedgehog actor.

Same rules as chars.py: original artwork, drawn back-to-front from
primitives, auto-outlined, then shaded.  All actors are authored facing
RIGHT; the renderer mirrors them when an actor must face left.
"""

import math
from pixel import Canvas

GUN_PAL = {
    'O': '#0a0a12', 'F': '#3d4a5c', 'f': '#232c39', 'H': '#61738c',
    'A': '#9aa7b8', 'a': '#66707e', 'M': '#e8b489', 'm': '#bd8a5e',
    'V': '#ff5a3c', 'v': '#a02310', 'W': '#e6ecf5', 'w': '#aab4c4',
    'K': '#15181f', 'Y': '#ffd23f', 'y': '#b8860b', 'J': '#7fdcff',
    'R': '#d8232f', 'r': '#8c1119',
}

BLACK_ARMS_PAL = {
    'O': '#0a0508', 'F': '#4a1220', 'f': '#2a0810', 'H': '#7a2334',
    'A': '#1c1c24', 'a': '#101016', 'M': '#8c2a3a', 'm': '#5a1422',
    'V': '#ffd23f', 'v': '#b8860b', 'W': '#f2d2b0', 'w': '#b89a80',
    'K': '#0a0508', 'Y': '#c0ff3c', 'y': '#6a9a12', 'J': '#ff3b45',
    'R': '#d8232f', 'r': '#8c1119',
}

DOOM_PAL = dict(BLACK_ARMS_PAL)
DOOM_PAL.update({
    'F': '#3a1424', 'f': '#1e0a12', 'H': '#63263c',
    'A': '#c8c2b4', 'a': '#8d8779', 'V': '#ff2a2a', 'v': '#8c0d0d',
    'Y': '#ffd23f', 'J': '#c0ff3c',
})

MARIA_PAL = {
    'O': '#0a0a12', 'F': '#3f7ad0', 'f': '#27528f', 'H': '#6ea3ea',
    'A': '#ffe08a', 'a': '#d6b04a', 'M': '#ffdfc4', 'm': '#d6a98a',
    'V': '#7fd7ff', 'v': '#3f8ab0', 'W': '#ffffff', 'w': '#c9cede',
    'K': '#15181f', 'Y': '#ffd23f', 'y': '#b8860b', 'J': '#7fdcff',
    'R': '#d8232f', 'r': '#8c1119', 'E': '#4aa0e0', 'e': '#1c4a70',
    'S': '#ffffff',
}


def _finish(cv, extra=()):
    cv.outline('O')
    cv.shade('F', 'f', 'H')
    cv.shade('A', 'a')
    cv.shade('M', 'm')
    cv.shade('W', 'w')
    cv.shade('V', 'v')
    for base, dark in extra:
        cv.shade(base, dark)
    return cv


# --------------------------------------------------------------------------
# G.U.N. (human faction)
# --------------------------------------------------------------------------
def gun_soldier(t=0.0, pose='idle'):
    cv = Canvas(40, 44)
    ang = t * math.pi * 2
    bob = math.sin(ang) * 0.8
    hipy = 30 + bob * 0.3
    swing = math.sin(ang) * (1.0 if pose == 'walk' else 0.25)

    # back leg / back arm
    cv.taper_line(19, hipy, 17 - swing * 3, 40, 2.4, 2.0, 'f')
    cv.rect(14 - swing * 3, 39, 7, 3, 'K')
    cv.taper_line(20, 22, 17, 29, 2.2, 1.8, 'f')

    # torso: flak vest over fatigues
    cv.poly([(15, 17), (26, 17), (27, 29), (14, 29)], 'F')
    cv.poly([(16, 18), (25, 18), (26, 26), (15, 26)], 'A')
    cv.rect(18, 18, 3, 9, 'f')
    cv.px(24, 21, 'V')

    # front leg
    cv.taper_line(22, hipy, 24 + swing * 3, 40, 2.6, 2.1, 'F')
    cv.rect(21 + swing * 3, 39, 8, 3, 'K')

    # head + combat helmet with orange visor
    cv.ellipse(23, 12, 5.4, 5.8, 'M')
    cv.ellipse(23, 9.5, 6.4, 5.0, 'F')
    cv.poly([(17, 9), (30, 8), (30, 12), (17, 13)], 'f')
    cv.poly([(23, 10), (30, 9.5), (30, 13), (23, 13.5)], 'V')
    cv.line(17, 6, 29, 5, 'H')

    # front arm + assault rifle
    gun_y = 21 if pose != 'shoot' else 19
    cv.taper_line(24, 21, 29, gun_y + 3, 2.3, 1.9, 'F')
    cv.rect(26, gun_y + 2, 13, 3, 'a')
    cv.rect(26, gun_y + 2, 13, 1, 'A')
    cv.rect(29, gun_y + 5, 4, 3, 'a')
    cv.rect(33, gun_y, 3, 2, 'A')
    if pose == 'shoot':
        cv.circle(35, gun_y + 3, 2.0, 'V')
        cv.px(34, gun_y + 1, 'Y')
    return _finish(cv)


def gun_beetle(t=0.0, pose='idle'):
    cv = Canvas(40, 36)
    ang = t * math.pi * 2
    y = 16 + math.sin(ang) * 2.0
    cv.ellipse(20, y, 10.0, 6.0, 'A')          # hull
    cv.ellipse(20, y - 2, 8.0, 4.0, 'F')       # canopy
    cv.ellipse(24, y - 2, 3.2, 2.4, 'V')       # optic
    cv.rect(11, y + 4, 18, 3, 'f')
    cv.taper_line(12, y + 6, 9, y + 11, 1.6, 1.0, 'a')   # landing struts
    cv.taper_line(28, y + 6, 31, y + 11, 1.6, 1.0, 'a')
    for i in range(3):                                    # thruster wash
        cv.px(8 - i, y + 2 + math.sin(ang + i) * 1.5, 'J')
        cv.px(32 + i, y + 2 - math.sin(ang + i) * 1.5, 'J')
    if pose == 'shoot':
        cv.circle(33, y - 2, 2.0, 'V')
    return _finish(cv)


def gun_hunter(t=0.0, pose='idle'):
    """Bipedal G.U.N. walker - a mid-boss class human unit."""
    cv = Canvas(56, 56)
    ang = t * math.pi * 2
    sw = math.sin(ang) * 2.5
    # legs
    for side, sgn in ((0, -1), (1, 1)):
        x = 24 + sgn * 7
        cv.taper_line(x, 30, x + sgn * 3 + sw * sgn, 42, 3.2, 2.6, 'f' if side == 0 else 'F')
        cv.rect(x + sgn * 3 + sw * sgn - 5, 42, 11, 4, 'K')
    # hull
    cv.poly([(12, 14), (42, 14), (45, 30), (10, 30)], 'F')
    cv.poly([(15, 17), (39, 17), (41, 27), (14, 27)], 'A')
    cv.rect(20, 18, 14, 3, 'V')                # optic band
    cv.rect(9, 16, 6, 12, 'f')
    cv.rect(41, 16, 6, 12, 'f')
    # shoulder cannons
    cv.rect(38, 10, 15, 5, 'a')
    cv.rect(49, 11, 4, 3, 'K')
    cv.rect(2, 20, 10, 4, 'a')
    if pose == 'shoot':
        cv.circle(51, 12, 2.2, 'V')
    cv.px(30, 12, 'Y')
    return _finish(cv)


# --------------------------------------------------------------------------
# Black Arms (alien faction)
# --------------------------------------------------------------------------
def black_warrior(t=0.0, pose='idle'):
    cv = Canvas(40, 44)
    ang = t * math.pi * 2
    bob = math.sin(ang) * 1.0
    hipy = 30 + bob * 0.4

    cv.taper_line(18, hipy, 15, 39, 2.6, 2.2, 'f')                # back leg
    cv.taper_line(19, 21, 14, 28, 2.4, 1.6, 'f')                  # back arm
    cv.poly([(14, 16 + bob), (27, 15 + bob), (29, 30), (13, 30)], 'F')   # carapace
    cv.poly([(17, 19 + bob), (25, 18 + bob), (26, 27), (16, 27)], 'A')   # chitin plate
    cv.taper_line(22, hipy, 25, 39, 2.8, 2.3, 'F')                # front leg
    cv.rect(22, 38, 8, 3, 'A')                                     # hoof/claw
    cv.rect(12, 38, 7, 3, 'a')

    hx, hy = 24, 10 + bob                                          # skull
    cv.ellipse(hx, hy, 6.2, 5.4, 'F')
    cv.poly([(hx - 6, hy - 3), (hx - 13, hy - 7.5), (hx - 4, hy - 6)], 'A')   # back horn
    cv.taper_line(hx + 2, hy - 5, hx + 9, hy - 7.5, 2.0, 0.6, 'A')           # fore horn
    cv.taper_line(hx - 1, hy - 5, hx + 3, hy - 8.0, 1.8, 0.6, 'A')
    cv.ellipse(hx + 3.4, hy + 0.5, 2.6, 2.0, 'Y')                  # single lit eye
    cv.px(hx + 4.4, hy + 0.5, 'O')
    cv.line(hx + 1, hy + 4, hx + 6, hy + 3.6, 'O')                 # jaw line

    # front arm + bone blade
    reach = 3 if pose == 'attack' else 0
    cv.taper_line(25, 21, 29 + reach, 28, 2.4, 1.8, 'F')
    cv.taper_line(29 + reach, 28, 35 + reach, 24, 1.8, 0.7, 'A')
    if pose == 'attack':
        for i in range(4):
            cv.px(34 + i, 22 - i * 0.7, 'J')
    return _finish(cv)


def black_hawk(t=0.0, pose='idle'):
    cv = Canvas(48, 36)
    ang = t * math.pi * 2
    flap = math.sin(ang) * 5.0
    y = 20
    cv.poly([(22, y - 2), (6, y - 8 - flap), (2, y - 2 - flap), (20, y + 3)], 'F')   # wing
    cv.poly([(24, y - 2), (40, y - 9 + flap), (46, y - 3 + flap), (26, y + 3)], 'H')
    cv.ellipse(23, y, 7.0, 4.6, 'F')                       # body
    cv.ellipse(29, y - 2, 4.2, 3.2, 'F')                   # head
    cv.taper_line(31, y - 4, 37, y - 8, 1.6, 0.5, 'A')     # horn
    cv.ellipse(31, y - 2, 1.8, 1.4, 'Y')                   # eye
    cv.taper_line(17, y + 1, 6, y + 7, 2.0, 0.6, 'f')      # tail
    cv.taper_line(24, y + 4, 22, y + 10, 1.4, 0.6, 'A')    # talons
    cv.taper_line(27, y + 4, 29, y + 10, 1.4, 0.6, 'A')
    if pose == 'attack':
        cv.circle(38, y - 2, 2.4, 'J')
    return _finish(cv)


def black_oak(t=0.0, pose='idle'):
    """Heavy Black Arms shock trooper."""
    cv = Canvas(56, 56)
    ang = t * math.pi * 2
    bob = math.sin(ang) * 1.2
    cv.taper_line(20, 36, 16, 50, 4.0, 3.2, 'f')
    cv.taper_line(30, 36, 35, 50, 4.2, 3.4, 'F')
    cv.rect(11, 49, 11, 4, 'a')
    cv.rect(31, 49, 12, 4, 'A')
    cv.poly([(15, 18 + bob), (38, 16 + bob), (43, 38), (12, 38)], 'F')
    cv.poly([(19, 22 + bob), (35, 20 + bob), (38, 34), (17, 34)], 'A')
    cv.taper_line(16, 22, 6, 34, 3.6, 2.4, 'f')
    cv.taper_line(38, 22, 48, 32 - (6 if pose == 'attack' else 0), 3.8, 2.6, 'F')
    cv.circle(48, 32 - (6 if pose == 'attack' else 0), 4.4, 'A')     # mace fist
    hx, hy = 31, 12 + bob
    cv.ellipse(hx, hy, 7.4, 6.2, 'F')
    cv.taper_line(hx - 3, hy - 5, hx - 13, hy - 9.5, 2.6, 0.7, 'A')
    cv.taper_line(hx + 3, hy - 5, hx + 11, hy - 10.5, 2.6, 0.7, 'A')
    cv.ellipse(hx + 3.6, hy, 3.0, 2.2, 'Y')
    cv.px(hx + 4.8, hy, 'O')
    return _finish(cv)


def _doom_horn(cv, x, y, side, length, curl, w0=2.6, col='A'):
    """One horn, as a chain of shrinking segments whose heading rotates.

    A straight taper reads as an insect antenna.  Black Doom's crown is a
    ram-like crescent - it leaves the temple pointing up and ends pointing
    out and back - and it is the first thing that identifies him.
    """
    a = math.radians(-90 + side * 12)
    px, py, w = x, y, w0
    n = 7
    for i in range(n):
        step = length / n
        nx, ny = px + math.cos(a) * step, py + math.sin(a) * step
        cv.taper_line(px, py, nx, ny, w, w * 0.84, col)
        px, py, w = nx, ny, w * 0.84
        a += math.radians(side * curl)


def black_doom(t=0.0, pose='idle'):
    """Black Doom - hovering, cloaked, three red eyes under a crown of horns."""
    cv = Canvas(56, 64)
    ang = t * math.pi * 2
    y = 3 + math.sin(ang) * 1.5            # he never touches the ground
    cx = 28.0
    hy = 19 + y

    # --- cloak ------------------------------------------------------------
    # a narrow column, not the fat pentagon this used to be: he is tall and
    # hunched, and a wide body read as a beetle shell.
    cv.poly([(cx - 8, 31 + y), (cx + 8, 31 + y), (cx + 13, 50 + y),
             (cx + 11, 55 + y), (cx - 11, 55 + y), (cx - 13, 50 + y)], 'F')
    for i in range(5):                                      # tattered hem
        x0 = cx - 11 + i * 5.5
        cv.poly([(x0, 51 + y), (x0 + 2.75, 58 + y - (i % 2) * 3.0),
                 (x0 + 5.5, 51 + y)], 'F')
    cv.poly([(cx - 6, 31 + y), (cx + 6, 31 + y), (cx + 9, 51 + y),
             (cx - 9, 51 + y)], 'f')                        # the robe's shadow
    for i in range(3):                                      # folds either side
        cv.line(cx - 6 - i * 2.5, 35 + y + i * 2, cx - 9 - i * 2.5, 52 + y, 'H')
        cv.line(cx + 6 + i * 2.5, 35 + y + i * 2, cx + 9 + i * 2.5, 52 + y, 'H')
    # the collar rises into two points behind the head
    cv.poly([(cx - 8, 32 + y), (cx - 10, 23 + y), (cx - 3, 30 + y)], 'F')
    cv.poly([(cx + 8, 32 + y), (cx + 10, 23 + y), (cx + 3, 30 + y)], 'F')
    # crimson: a narrow strip down the chest under a small throat lozenge
    cv.poly([(cx - 1.3, 34 + y), (cx + 1.3, 34 + y), (cx + 2.2, 49 + y),
             (cx - 2.2, 49 + y)], 'v')
    cv.poly([(cx, 30 + y), (cx + 2.4, 33.5 + y), (cx, 37 + y),
             (cx - 2.4, 33.5 + y)], 'V')

    # --- arms: sleeves at his sides, a claw just showing at each cuff ------
    for side in (-1, 1):
        sx = cx + side * 7.5
        wx, wy = sx + side * 3.4, 44 + y
        cv.taper_line(sx, 33 + y, wx, wy, 4.6, 3.0, 'f')
        for f in (-1, 0, 1):                                # three short claws
            cv.taper_line(wx + f * 1.2, wy + 1.4, wx + f * 1.9, wy + 5.0,
                          1.0, 0.35, 'a')

    # --- head ---------------------------------------------------------------
    cv.ellipse(cx, hy, 8.0, 8.8, 'f')                       # dark skull
    cv.ellipse(cx, hy - 2.6, 7.2, 5.2, 'F')                 # lit crown
    _doom_horn(cv, cx - 7.0, hy - 4.8, -1, 20.0, 10.0, 2.6)
    _doom_horn(cv, cx + 7.0, hy - 4.8, 1, 20.0, 10.0, 2.6)
    _doom_horn(cv, cx - 2.8, hy - 6.6, -1, 12.0, 8.0, 1.8)
    _doom_horn(cv, cx + 2.8, hy - 6.6, 1, 12.0, 8.0, 1.8)

    # three eyes in a downward triangle - the arrangement is the whole face
    for ex, ey, rx, ry in ((-4.2, -0.4, 2.6, 1.9), (4.2, -0.4, 2.6, 1.9),
                           (0.0, 4.4, 2.4, 1.8)):
        cv.ellipse(cx + ex, hy + ey, rx + 0.9, ry + 0.9, 'O')   # socket
        cv.ellipse(cx + ex, hy + ey, rx, ry, 'V')
        cv.px(cx + ex - rx * 0.5, hy + ey - ry * 0.45, 'W')

    if pose == 'attack':
        cv.circle(cx - 16, 48 + y, 3.4, 'J')
        cv.circle(cx + 16, 48 + y, 3.4, 'J')
    return _finish(cv)


def devil_doom(t=0.0, pose='idle'):
    """Devil Doom - the Last Story final boss. Huge winged demon form."""
    cv = Canvas(96, 88)
    ang = t * math.pi * 2
    flap = math.sin(ang) * 6.0
    cy = 44
    # wings
    cv.poly([(44, cy - 6), (14, cy - 26 - flap), (2, cy - 2 - flap), (10, cy + 16), (40, cy + 6)], 'f')
    cv.poly([(52, cy - 6), (82, cy - 28 + flap), (94, cy - 4 + flap), (86, cy + 14), (56, cy + 6)], 'F')
    for i in range(4):
        cv.line(44, cy - 4, 10 + i * 9, cy - 22 - flap + i * 8, 'a')
        cv.line(52, cy - 4, 86 - i * 9, cy - 24 + flap + i * 8, 'a')
    # torso
    cv.ellipse(48, cy + 6, 16.0, 18.0, 'F')
    cv.ellipse(48, cy + 10, 10.0, 12.0, 'A')
    for i in range(4):                                     # rib plates
        cv.line(40, cy + 4 + i * 5, 56, cy + 4 + i * 5, 'a')
    # head
    hy = cy - 20
    cv.ellipse(48, hy, 14.0, 11.0, 'F')
    # the same crescent crown he wears in his first form, scaled up, so the
    # transformation still reads as the same character
    _doom_horn(cv, 48 - 11, hy - 4, -1, 21.0, 11.0, 3.4)
    _doom_horn(cv, 48 + 11, hy - 4, 1, 21.0, 11.0, 3.4)
    _doom_horn(cv, 48 - 4.5, hy - 7, -1, 14.0, 9.0, 2.4)
    _doom_horn(cv, 48 + 4.5, hy - 7, 1, 14.0, 9.0, 2.4)
    for ex, ey, rx, ry in ((-7, -1, 3.4, 2.6), (7, -1, 3.4, 2.6),
                           (0, 5, 4.6, 3.4)):                # the great third eye
        cv.ellipse(48 + ex, hy + ey, rx + 1.0, ry + 1.0, 'O')
        cv.ellipse(48 + ex, hy + ey, rx, ry, 'V')
        cv.px(48 + ex - rx * 0.5, hy + ey - ry * 0.45, 'W')
    # arms
    cv.taper_line(32, cy + 2, 16, cy + 22, 4.4, 2.0, 'F')
    cv.taper_line(64, cy + 2, 80, cy + 20, 4.4, 2.0, 'F')
    cv.circle(15, cy + 24, 4.6, 'A')
    cv.circle(81, cy + 22, 4.6, 'A')
    if pose == 'attack':
        for i in range(10):
            a = i * 0.63
            cv.px(48 + math.cos(a) * 26, hy + 5 + math.sin(a) * 22, 'J')
    return _finish(cv)


# A small human eye, authored pixel by pixel for the same reason the
# hedgehog face parts are: ellipses this small round off into dots.
#   O outline  S sclera  I iris  e pupil
HUMAN_EYE = [
    '.OOO.',
    'OSSIO',
    'OSIeO',
    'OSSIO',
    '.OOO.',
]


def maria(t=0.0, pose='idle'):
    """Maria Robotnik - blonde bob under a blue band, pale blue dress.

    She is a small girl in a memory, not a fighter: the read has to come from
    the hair shape and the dress, because at 40x44 the face is eight pixels
    across.
    """
    cv = Canvas(40, 44)
    ang = t * math.pi * 2
    bob = math.sin(ang) * 0.7
    cx = 20.0
    hy = 13 + bob

    # --- dress --------------------------------------------------------------
    cv.poly([(cx - 5, 25 + bob), (cx + 5, 25 + bob), (cx + 10, 40),
             (cx - 10, 40)], 'F')                            # skirt
    for i in range(3):                                       # pleat shadows
        cv.line(cx - 4 + i * 4, 29, cx - 6 + i * 6, 39, 'f')
    cv.poly([(cx - 4.5, 20 + bob), (cx + 4.5, 20 + bob), (cx + 5.5, 27),
             (cx - 5.5, 27)], 'V')                           # pale blue bodice
    cv.rect(cx - 6, 25 + bob * 0.5, 12, 2, 'W')              # white sash
    # sailor collar
    cv.poly([(cx - 4.5, 20 + bob), (cx, 24 + bob), (cx + 4.5, 20 + bob),
             (cx + 3, 19 + bob), (cx - 3, 19 + bob)], 'W')
    cv.px(cx, 23 + bob, 'R')                                 # neck ribbon
    cv.px(cx - 1, 23 + bob, 'R')
    cv.px(cx + 1, 23 + bob, 'R')
    for side in (-1, 1):                                     # arms
        cv.taper_line(cx + side * 4.5, 21 + bob, cx + side * 7.5, 30,
                      2.2, 1.7, 'V')                         # sleeve
        cv.taper_line(cx + side * 7.5, 30, cx + side * 8.5, 34, 1.7, 1.5, 'M')
    cv.rect(cx - 7, 39, 6, 3, 'f')                           # shoes
    cv.rect(cx + 1, 39, 6, 3, 'f')

    # --- head ---------------------------------------------------------------
    # hair mass first, then the face ON TOP of it, then a shallow fringe: the
    # old order buried the eyes under the bangs and left a flat-top helmet
    cv.ellipse(cx, hy - 1.2, 7.2, 7.4, 'A')
    for side in (-1, 1):                                     # side locks
        cv.poly([(cx + side * 7.2, hy - 2), (cx + side * 6.6, hy + 6),
                 (cx + side * 4.2, hy + 8), (cx + side * 3.0, hy + 1)], 'A')
        cv.poly([(cx + side * 6.6, hy + 4), (cx + side * 9.0, hy + 9),
                 (cx + side * 4.6, hy + 7.6)], 'A')          # outward flick
    cv.ellipse(cx, hy - 4.0, 6.8, 5.4, 'V')                  # blue band...
    cv.ellipse(cx, hy - 3.0, 6.5, 5.2, 'A')                  # ...as a crescent
    cv.ellipse(cx, hy + 0.8, 5.8, 6.2, 'M')                  # face
    cv.ellipse(cx, hy - 4.0, 6.4, 2.4, 'A')                  # fringe
    cv.poly([(cx - 1.2, hy - 3.0), (cx + 1.0, hy - 5.0), (cx + 2.6, hy - 2.0)], 'A')

    for ex in (-2.6, 2.6):                                   # eyes
        cv.ellipse(cx + ex, hy + 0.9, 1.4, 1.8, 'O')
        cv.ellipse(cx + ex, hy + 1.1, 1.0, 1.4, 'S')
        cv.ellipse(cx + ex, hy + 1.4, 0.8, 1.1, 'E')
        cv.px(cx + ex - 0.7, hy + 0.3, 'W')                  # glint
    cv.px(cx, hy + 3.3, 'm')                                 # nose
    cv.line(cx - 1, hy + 4.6, cx + 1, hy + 4.6, 'm')         # mouth
    cv.px(cx - 4.0, hy + 2.9, 'R')                           # blush
    cv.px(cx + 4.0, hy + 2.9, 'R')
    return _finish(cv, extra=(('E', 'e'),))
