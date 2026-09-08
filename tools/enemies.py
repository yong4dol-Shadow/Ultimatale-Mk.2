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
        cv.circle(39, gun_y + 3, 2.2, 'V')
        cv.px(38, gun_y + 1, 'Y')
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
    cv.rect(38, 10, 16, 5, 'a')
    cv.rect(50, 11, 5, 3, 'K')
    cv.rect(2, 20, 10, 4, 'a')
    if pose == 'shoot':
        cv.circle(55, 12, 2.4, 'V')
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

    cv.taper_line(18, hipy, 15, 41, 2.6, 2.2, 'f')                # back leg
    cv.taper_line(19, 21, 14, 28, 2.4, 1.6, 'f')                  # back arm
    cv.poly([(14, 16 + bob), (27, 15 + bob), (29, 30), (13, 30)], 'F')   # carapace
    cv.poly([(17, 19 + bob), (25, 18 + bob), (26, 27), (16, 27)], 'A')   # chitin plate
    cv.taper_line(22, hipy, 25, 41, 2.8, 2.3, 'F')                # front leg
    cv.rect(22, 40, 8, 3, 'A')                                     # hoof/claw
    cv.rect(12, 40, 7, 3, 'a')

    hx, hy = 24, 10 + bob                                          # skull
    cv.ellipse(hx, hy, 6.2, 5.4, 'F')
    cv.poly([(hx - 6, hy - 3), (hx - 13, hy - 9), (hx - 4, hy - 6)], 'A')   # back horn
    cv.taper_line(hx + 2, hy - 5, hx + 9, hy - 11, 2.0, 0.6, 'A')           # fore horn
    cv.taper_line(hx - 1, hy - 5, hx + 3, hy - 12, 1.8, 0.6, 'A')
    cv.ellipse(hx + 3.4, hy + 0.5, 2.6, 2.0, 'Y')                  # single lit eye
    cv.px(hx + 4.4, hy + 0.5, 'O')
    cv.line(hx + 1, hy + 4, hx + 6, hy + 3.6, 'O')                 # jaw line

    # front arm + bone blade
    reach = 5 if pose == 'attack' else 0
    cv.taper_line(25, 21, 29 + reach, 28, 2.4, 1.8, 'F')
    cv.taper_line(29 + reach, 28, 36 + reach, 24, 1.8, 0.7, 'A')
    if pose == 'attack':
        for i in range(5):
            cv.px(36 + i, 22 - i * 0.7, 'J')
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
    cv.taper_line(38, 22, 50, 32 - (6 if pose == 'attack' else 0), 3.8, 2.6, 'F')
    cv.circle(51, 32 - (6 if pose == 'attack' else 0), 4.4, 'A')     # mace fist
    hx, hy = 31, 12 + bob
    cv.ellipse(hx, hy, 7.4, 6.2, 'F')
    cv.taper_line(hx - 3, hy - 5, hx - 14, hy - 12, 2.6, 0.7, 'A')
    cv.taper_line(hx + 3, hy - 5, hx + 12, hy - 13, 2.6, 0.7, 'A')
    cv.ellipse(hx + 3.6, hy, 3.0, 2.2, 'Y')
    cv.px(hx + 4.8, hy, 'O')
    return _finish(cv)


def black_doom(t=0.0, pose='idle'):
    """Black Doom - floating, robed, three eyes, crown of horns."""
    cv = Canvas(56, 64)
    ang = t * math.pi * 2
    y = 4 + math.sin(ang) * 2.0
    # robe
    cv.poly([(28, 18 + y), (46, 40 + y), (38, 58 + y), (18, 58 + y), (10, 40 + y)], 'F')
    cv.poly([(28, 24 + y), (40, 41 + y), (34, 54 + y), (22, 54 + y), (16, 41 + y)], 'f')
    for i in range(3):                                   # cloak folds
        cv.line(24 + i * 4, 30 + y + i, 22 + i * 4, 55 + y, 'H')
    cv.poly([(28, 22 + y), (37, 33 + y), (28, 30 + y), (19, 33 + y)], 'A')   # collar
    for i in range(4):                                     # tattered hem
        cv.poly([(18 + i * 6, 56 + y), (21 + i * 6, 62 + y), (24 + i * 6, 56 + y)], 'F')
    # head
    cv.ellipse(28, 16 + y, 10.0, 9.0, 'F')
    cv.ellipse(28, 19 + y, 7.5, 6.0, 'f')
    # crown of horns
    for dx, dy, l in ((-9, -4, -13), (-5, -8, -16), (4, -8, -15), (9, -3, -12)):
        cv.taper_line(28 + dx, 16 + y + dy, 28 + dx * 2.0, 16 + y + l, 2.6, 0.7, 'A')
    # three eyes
    cv.ellipse(23, 15 + y, 2.6, 2.0, 'V')
    cv.ellipse(33, 15 + y, 2.6, 2.0, 'V')
    cv.ellipse(28, 20 + y, 3.2, 2.4, 'V')
    for ex, ey in ((23, 15), (33, 15), (28, 20)):
        cv.px(28 + (ex - 28) * 0.7, ey + y, 'O')
    # skeletal arms
    cv.taper_line(14, 30 + y, 4, 40 + y, 2.4, 1.2, 'A')
    cv.taper_line(42, 30 + y, 52, 38 + y, 2.4, 1.2, 'A')
    if pose == 'attack':
        cv.circle(52, 38 + y, 3.4, 'J')
        cv.circle(4, 40 + y, 3.0, 'J')
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
    for dx, l in ((-12, -18), (-6, -22), (6, -22), (12, -18)):
        cv.taper_line(48 + dx, hy - 4, 48 + dx * 1.9, hy + l, 3.4, 0.8, 'A')
    cv.ellipse(41, hy - 1, 3.4, 2.6, 'V')
    cv.ellipse(55, hy - 1, 3.4, 2.6, 'V')
    cv.ellipse(48, hy + 5, 4.6, 3.4, 'V')                  # the great third eye
    cv.px(41, hy - 1, 'O')
    cv.px(55, hy - 1, 'O')
    cv.circle(48, hy + 5, 1.4, 'O')
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


def maria(t=0.0, pose='idle'):
    cv = Canvas(40, 44)
    ang = t * math.pi * 2
    bob = math.sin(ang) * 0.7
    cv.poly([(15, 26 + bob), (26, 26 + bob), (30, 41), (11, 41)], 'F')   # dress
    cv.rect(13, 40, 6, 3, 'K')
    cv.rect(22, 40, 6, 3, 'K')
    cv.taper_line(17, 24, 13, 33, 2.0, 1.6, 'M')
    cv.taper_line(24, 24, 28, 33, 2.0, 1.6, 'M')
    cv.poly([(16, 20 + bob), (26, 20 + bob), (27, 28), (15, 28)], 'V')   # blouse
    cv.ellipse(21, 13 + bob, 6.4, 6.8, 'M')                              # face
    cv.poly([(14, 8 + bob), (28, 7 + bob), (29, 22), (25, 22),
             (25, 12), (17, 12), (16, 22), (13, 22)], 'A')               # blonde hair
    cv.ellipse(24, 13 + bob, 2.2, 2.0, 'S')
    cv.ellipse(24.6, 13 + bob, 1.3, 1.6, 'E')
    cv.px(24.8, 13 + bob, 'e')
    cv.line(23, 17 + bob, 25, 17 + bob, 'm')
    return _finish(cv, extra=(('E', 'e'),))
