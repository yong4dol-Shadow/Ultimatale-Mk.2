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
def signpost(lit=False):
    """A roadside board.  Something to read that is not a mission objective."""
    cv = Canvas(16, 24)
    cv.rect(7, 10, 2, 12, 'w')                       # post
    cv.rect(7, 10, 1, 12, 'W')
    cv.poly([(1, 2), (15, 2), (15, 12), (1, 12)], 's')   # board
    cv.rect(2, 3, 12, 8, 'S')
    for i in range(4):                               # lines of text on it
        cv.rect(3, 4 + i * 2, 9 - (i % 2) * 3, 1, 'K')
    cv.rect(1, 2, 14, 1, 'W')
    if lit:
        cv.rect(0, 1, 16, 1, 'y')
        cv.px(0, 6, 'y'); cv.px(15, 6, 'y')
    cv.outline('0')
    return cv


# --------------------------------------------------------------------------
# Set dressing.  None of these block the route - the stages are meant to be
# run across - they are there so a screen of floor is not just floor.  All
# are 16x24 and drawn bottom-anchored on their tile.
# --------------------------------------------------------------------------
def _post(cv, x, w, top, col='4', cap='5'):
    cv.rect(x, top, w, 23 - top, col)
    cv.rect(x, top, w, 1, cap)


def prop_lamp():
    cv = Canvas(16, 24)
    _post(cv, 7, 2, 6)
    cv.rect(4, 3, 8, 4, '4')
    cv.rect(5, 4, 6, 2, 'y')                    # the lit element
    cv.rect(4, 7, 8, 1, '3')
    cv.rect(5, 22, 6, 2, '3')                   # base
    cv.outline('0')
    return cv


def prop_hydrant():
    cv = Canvas(16, 24)
    cv.rect(6, 14, 4, 9, 'r')
    cv.rect(4, 16, 8, 3, 'r')
    cv.ellipse(8, 13, 2.6, 2.2, 'r')
    cv.rect(4, 22, 8, 2, '3')
    cv.px(7, 12, 'q')
    cv.outline('0')
    return cv


def prop_bench():
    cv = Canvas(16, 24)
    cv.rect(2, 16, 12, 2, 'w')
    cv.rect(2, 13, 12, 2, 'w')
    cv.rect(3, 18, 2, 5, '3')
    cv.rect(11, 18, 2, 5, '3')
    cv.outline('0')
    return cv


def prop_vending():
    cv = Canvas(16, 24)
    cv.rect(3, 8, 10, 15, '3')
    cv.rect(4, 9, 6, 9, 'C')                    # window
    for i in range(3):
        cv.rect(5, 10 + i * 3, 4, 2, 'y' if i == 1 else 'r')
    cv.rect(10, 10, 2, 5, '5')                  # buttons
    cv.rect(4, 19, 8, 2, '2')
    cv.outline('0')
    return cv


def prop_wreck():
    cv = Canvas(16, 24)
    cv.poly([(1, 18), (4, 13), (12, 13), (15, 18), (15, 21), (1, 21)], '3')
    cv.rect(5, 14, 6, 3, '1')                   # blown-out cabin
    cv.ellipse(4, 21, 2.2, 1.8, '0')
    cv.ellipse(12, 21, 2.2, 1.8, '0')
    cv.px(3, 15, 'o'); cv.px(13, 16, 'o')       # still smouldering
    cv.outline('0')
    return cv


def prop_obelisk():
    cv = Canvas(16, 24)
    cv.poly([(5, 2), (11, 2), (12, 22), (4, 22)], '5')
    cv.poly([(6, 3), (10, 3), (10.5, 21), (5.5, 21)], '6')
    for i in range(4):                          # glyph rows
        cv.rect(6, 6 + i * 4, 4, 1, '3')
    cv.rect(3, 22, 10, 2, '4')
    cv.outline('0')
    return cv


def prop_cairn():
    cv = Canvas(16, 24)
    cv.ellipse(8, 21, 5.0, 2.6, '5')
    cv.ellipse(7, 17, 3.8, 2.4, '6')
    cv.ellipse(9, 13, 2.8, 2.0, '5')
    cv.ellipse(8, 10, 1.8, 1.6, '6')
    cv.outline('0')
    return cv


def prop_deadtree():
    cv = Canvas(16, 24)
    cv.taper_line(8, 23, 8, 10, 2.2, 1.4, 'w')
    cv.taper_line(8, 14, 3, 8, 1.4, 0.5, 'w')
    cv.taper_line(8, 12, 13, 6, 1.4, 0.5, 'w')
    cv.taper_line(8, 16, 12, 12, 1.2, 0.4, 'w')
    cv.outline('0')
    return cv


def prop_brazier():
    cv = Canvas(16, 24)
    cv.rect(6, 16, 4, 7, '4')
    cv.rect(4, 22, 8, 2, '3')
    cv.poly([(3, 16), (13, 16), (11, 12), (5, 12)], '5')
    cv.ellipse(8, 11, 3.2, 2.0, 'o')            # the fire in it
    cv.ellipse(8, 10, 2.0, 1.6, 'y')
    cv.ellipse(8, 9.4, 1.0, 1.0, 'h')
    cv.outline('0')
    return cv


def prop_console():
    cv = Canvas(16, 24)
    cv.poly([(2, 10), (14, 10), (13, 22), (3, 22)], '3')
    cv.rect(3, 11, 10, 6, '1')
    for i in range(3):
        cv.rect(4, 12 + i * 2, 7 - i * 2, 1, 'c')
    for i in range(4):
        cv.px(4 + i * 3, 19, 'j' if i % 2 else 'r')
    cv.outline('0')
    return cv


def prop_tank():
    cv = Canvas(16, 24)
    cv.ellipse(8, 16, 3.6, 7.0, '4')
    cv.ellipse(6.6, 16, 1.4, 6.0, '5')
    cv.rect(7, 7, 2, 3, '3')                    # valve
    cv.rect(5, 6, 6, 1, '5')
    cv.rect(4, 12, 8, 1, 'y')                   # hazard band
    cv.outline('0')
    return cv


def prop_locker():
    cv = Canvas(16, 24)
    cv.rect(3, 6, 10, 17, '4')
    cv.rect(4, 7, 4, 15, '3')
    cv.rect(8, 7, 4, 15, '3')
    cv.px(7, 14, '6'); cv.px(9, 14, '6')        # handles
    cv.rect(3, 6, 10, 1, '5')
    cv.outline('0')
    return cv


def prop_generator():
    cv = Canvas(16, 24)
    cv.rect(2, 11, 12, 12, '3')
    cv.rect(3, 12, 10, 4, '2')
    cv.ellipse(8, 18, 3.0, 2.6, '4')
    cv.ellipse(8, 18, 1.4, 1.2, 'y')
    cv.rect(4, 8, 3, 3, '4')                    # exhaust
    cv.px(5, 7, '5')
    cv.outline('0')
    return cv


def prop_radar():
    cv = Canvas(16, 24)
    _post(cv, 7, 2, 12)
    cv.rect(4, 22, 8, 2, '3')
    cv.poly([(2, 4), (12, 2), (13, 9), (4, 11)], '5')
    cv.poly([(4, 5), (11, 3.5), (11.5, 8), (5, 9.5)], '6')
    cv.line(8, 6, 9, 12, '3')
    cv.outline('0')
    return cv


def prop_ammo():
    cv = Canvas(16, 24)
    cv.rect(1, 16, 14, 7, 'K')
    cv.rect(1, 16, 14, 2, 'k')
    cv.rect(3, 19, 4, 2, 'y')
    cv.rect(4, 12, 8, 4, 'K')                   # a second, smaller box
    cv.rect(4, 12, 8, 1, 'k')
    cv.outline('0')
    return cv


def prop_growth():
    cv = Canvas(16, 24)
    # a shade up from the comet's own floor, which is the same near-black
    # maroon - drawn in it, these read as nothing at all
    cv.taper_line(8, 23, 7, 8, 3.4, 1.0, 'n')
    cv.taper_line(7, 14, 3, 9, 1.6, 0.5, 'n')
    cv.taper_line(7, 17, 13, 12, 1.6, 0.5, 'n')
    for i in range(4):
        cv.px(6 + (i % 2) * 3, 10 + i * 3, 'r')
    cv.outline('0')
    return cv


def prop_node():
    cv = Canvas(16, 24)
    cv.ellipse(8, 17, 5.0, 5.6, 'n')
    cv.ellipse(8, 16, 3.0, 3.4, 'r')
    cv.ellipse(8, 15.4, 1.6, 1.8, 'q')
    cv.px(8, 15, 'h')
    cv.taper_line(8, 22, 8, 23, 3.0, 4.0, 'M')
    cv.outline('0')
    return cv


def prop_eggs():
    cv = Canvas(16, 24)
    for cx, cy, r in ((5, 20, 3.0), (11, 21, 2.6), (8, 16, 2.8), (12, 16, 2.0)):
        cv.ellipse(cx, cy, r, r * 1.15, 'n')
        cv.ellipse(cx, cy - 0.4, r * 0.5, r * 0.6, 'r')
    cv.outline('0')
    return cv


def prop_barrel():
    cv = Canvas(16, 24)
    cv.rect(4, 10, 8, 13, '4')
    cv.rect(4, 10, 8, 1, '5')
    cv.rect(4, 15, 8, 2, 'y')                   # hazard band
    cv.rect(4, 21, 8, 1, '3')
    cv.px(6, 13, '5'); cv.px(9, 19, '3')
    cv.outline('0')
    return cv


def prop_barricade():
    cv = Canvas(16, 24)
    for i in range(2):
        cv.rect(1, 14 + i * 4, 14, 3, 'W')
        for k in range(4):
            cv.rect(2 + k * 4, 14 + i * 4, 2, 3, 'r')
    cv.rect(2, 17, 2, 6, '3')
    cv.rect(12, 17, 2, 6, '3')
    cv.outline('0')
    return cv


def prop_phone():
    cv = Canvas(16, 24)
    cv.rect(3, 4, 10, 19, 'C')
    cv.rect(4, 6, 8, 11, '1')
    cv.rect(5, 7, 3, 8, '6')                    # the handset, still on its hook
    cv.rect(3, 3, 10, 2, 'W')
    cv.rect(4, 19, 8, 2, '2')
    cv.outline('0')
    return cv


def prop_antenna():
    cv = Canvas(16, 24)
    _post(cv, 7, 2, 4)
    for i in range(3):                          # cross arms
        cv.rect(3 + (i % 2), 6 + i * 5, 10 - (i % 2) * 2, 1, '5')
    cv.rect(4, 21, 8, 2, '3')
    cv.px(8, 2, 'r')                            # the light on top
    cv.px(8, 3, 'r')
    cv.outline('0')
    return cv


def prop_statue():
    cv = Canvas(16, 24)
    cv.rect(3, 20, 10, 3, '4')                  # plinth
    cv.poly([(6, 20), (10, 20), (9, 9), (7, 9)], '5')
    cv.ellipse(8, 7, 2.6, 2.8, '5')             # head, broken off at the neck
    cv.poly([(5, 13), (7, 12), (7, 14)], '5')   # a stump of an arm
    cv.px(10, 8, '6'); cv.px(7, 11, '6')
    cv.outline('0')
    return cv


def prop_crystal():
    cv = Canvas(16, 24)
    cv.poly([(8, 6), (12, 14), (10, 22), (6, 22), (4, 14)], 'c')
    cv.poly([(8, 8), (10, 14), (8, 20), (6, 14)], 'h')
    cv.poly([(3, 18), (5, 14), (6, 22)], 'c')
    cv.px(8, 11, 'h')
    cv.outline('0')
    return cv


def prop_bones():
    cv = Canvas(16, 24)
    cv.ellipse(6, 20, 3.4, 2.2, '7')            # a skull, half buried
    cv.px(5, 20, '2'); cv.px(7, 20, '2')
    cv.taper_line(9, 22, 14, 18, 1.4, 1.0, '7')  # ribs
    cv.taper_line(10, 21, 14, 21, 1.2, 0.8, '6')
    cv.taper_line(3, 22, 6, 23, 1.0, 0.8, '6')
    cv.outline('0')
    return cv


def prop_turret():
    cv = Canvas(16, 24)
    cv.rect(3, 18, 10, 5, '3')                  # mount
    cv.ellipse(8, 15, 4.4, 3.6, '4')            # housing, hanging dead
    cv.rect(9, 10, 3, 6, '5')                   # the barrel, drooping
    cv.rect(8, 9, 5, 2, '4')
    cv.px(6, 14, 'r')                           # a dark status lamp
    cv.outline('0')
    return cv


PROPS = [
    ('lamp', prop_lamp), ('hydrant', prop_hydrant), ('bench', prop_bench),
    ('vending', prop_vending), ('wreck', prop_wreck),
    ('obelisk', prop_obelisk), ('cairn', prop_cairn),
    ('deadtree', prop_deadtree), ('brazier', prop_brazier),
    ('console', prop_console), ('tank', prop_tank), ('locker', prop_locker),
    ('generator', prop_generator), ('radar', prop_radar), ('ammo', prop_ammo),
    ('growth', prop_growth), ('node', prop_node), ('eggs', prop_eggs),
    ('barrel', prop_barrel), ('barricade', prop_barricade),
    ('phone', prop_phone), ('antenna', prop_antenna),
    ('statue', prop_statue), ('crystal', prop_crystal),
    ('bones', prop_bones), ('turret', prop_turret),
]


def datalog(lit=False):
    """A dropped data slate.  The third readable, after boards and people."""
    cv = Canvas(16, 16)
    cv.poly([(2, 5), (14, 5), (13, 14), (3, 14)], '3')       # casing
    cv.rect(3, 6, 10, 6, '1')                                # screen
    for i in range(3):
        cv.rect(4, 7 + i * 2, 8 - (i % 2) * 4, 1, 'c' if lit else 'C')
    cv.rect(5, 3, 6, 2, '4')                                 # handle
    cv.rect(6, 12, 4, 1, '5')
    if lit:
        cv.px(13, 6, 'y')
        cv.px(2, 13, 'y')
    cv.outline('0')
    return cv


def civilian(kind=0, t=0.0):
    """A bystander.  Three flavours so a street does not look cloned."""
    cv = Canvas(16, 24)
    bob = math.sin(t * math.pi * 2) * 0.6
    coat = ['C', 'J', 'P'][kind % 3]
    cv.rect(5, 20, 3, 3, '1')                        # feet
    cv.rect(8, 20, 3, 3, '1')
    cv.poly([(4, 11 + bob), (12, 11 + bob), (13, 21), (3, 21)], coat)   # coat
    cv.rect(7, 13 + bob, 2, 7, '2')                  # front seam
    cv.ellipse(5, 15 + bob, 1.4, 3.4, coat)          # arms
    cv.ellipse(11, 15 + bob, 1.4, 3.4, coat)
    cv.ellipse(8, 7 + bob, 3.6, 4.0, 's')            # head
    cv.poly([(4, 5 + bob), (12, 5 + bob), (12, 3 + bob), (4, 3 + bob)],
            ['K', '3', 'w'][kind % 3])               # hair
    cv.px(6.6, 7 + bob, '0')
    cv.px(9.4, 7 + bob, '0')
    cv.outline('0')
    return cv


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


# ---- mission objectives -------------------------------------------------
# These used to be 16x16 tiles painted flat on the floor - exactly the size
# of the three hundred odd bits of set dressing sharing the screen with
# them.  Hunting for a terminal meant reading every lamp post.  They are
# 24x36 now, bottom-anchored like the props, built with enough detail to be
# named from across the screen, and they all wear the same little diamond
# so "this one is a mission object" reads before the silhouette does.
def _objective_marker(cv, x, bob=0, col='y'):
    """The shared floating diamond every objective wears."""
    t = bob
    cv.poly([(x, t), (x + 4, t + 4), (x, t + 8), (x - 4, t + 4)], col)
    cv.poly([(x, t + 2), (x + 2, t + 4), (x, t + 6), (x - 2, t + 4)], '8')
    cv.px(x - 1, t + 3, 'h')


def obj_terminal(on=False, bob=0):
    """A control terminal.  Squat and wide, against the save pillar's
    narrow column, so the two never get mistaken for each other."""
    cv = Canvas(24, 36)
    cv.rect(1, 33, 22, 2, '2')                       # plinth shadow
    cv.rect(2, 30, 20, 4, '3')                       # plinth
    cv.rect(3, 31, 18, 2, '4')
    cv.poly([(4, 12), (20, 12), (21, 30), (3, 30)], '4')   # housing
    cv.rect(5, 13, 14, 13, '3')                      # bezel
    cv.rect(6, 14, 12, 11, '1')                      # screen
    if on:
        cv.rect(6, 14, 12, 11, 'C')
        for i in range(5):
            cv.rect(7, 15 + i * 2, 10 - (i % 2) * 4, 1, 'c')
        cv.rect(6, 14, 12, 1, 'c')
    else:
        cv.rect(7, 18, 8, 1, '3')                    # dead readout
        cv.rect(7, 21, 5, 1, '3')
    cv.rect(4, 26, 16, 3, '5')                       # key shelf
    for i in range(7):
        cv.px(5 + i * 2, 27, '2')
    cv.rect(5, 25, 4, 1, '2')                        # vent
    cv.taper_line(20, 28, 23, 34, 2, 1, '2')         # cable to the floor
    lamp = 'g' if on else 'r'
    cv.ellipse(19, 16, 1.6, 1.6, lamp)               # status lamp
    cv.px(19, 15, '8')
    if not on:
        _objective_marker(cv, 12, bob)
    cv.outline('0')
    cv.shade('4', '3', '5')
    return cv


def obj_crate(bob=0):
    """A G.U.N. supply container: wide, cross-braced, banded and sitting on
    a pallet.  Nothing in the set dressing has that silhouette, which is
    the whole point - the old 16x16 crate was the size of a hydrant."""
    cv = Canvas(24, 36)
    cv.rect(2, 33, 20, 2, '2')                       # pallet shadow
    cv.rect(2, 30, 20, 3, 'W')                       # pallet
    cv.rect(3, 31, 18, 1, 'w')
    cv.rect(1, 14, 22, 16, '3')                      # body
    cv.rect(2, 15, 20, 14, '4')
    cv.rect(2, 15, 20, 2, '5')                       # lid face
    for i in range(5):                               # hazard band on the lid
        cv.rect(3 + i * 4, 15, 2, 2, 'y')
    cv.rect(1, 17, 22, 1, '2')                       # lid seam
    cv.line(3, 28, 20, 20, '5')                      # cross-bracing
    cv.line(20, 28, 3, 20, '5')
    for x0, y0 in ((1, 14), (18, 14), (1, 26), (18, 26)):
        cv.rect(x0, y0, 5, 4, '3')                   # corner plates
        cv.rect(x0 + 1, y0 + 1, 3, 2, '5')
    cv.rect(8, 21, 8, 6, '5')                        # stencil plate
    cv.rect(9, 22, 6, 4, '2')
    cv.rect(10, 23, 4, 1, 'y')
    cv.rect(10, 25, 3, 1, '6')
    _objective_marker(cv, 12, bob)
    cv.outline('0')
    return cv


def obj_pod(bob=0):
    """A Black Arms egg sac.  Wet, veined and lit from inside - nothing
    else on the comet is shaped like it."""
    cv = Canvas(24, 36)
    cv.ellipse(12, 31, 9, 3.4, 'm')                  # root mat
    cv.ellipse(12, 30, 6, 2.2, 'n')
    cv.ellipse(12, 22, 8.5, 10, 'M')                 # sac
    cv.ellipse(12, 22, 7, 8.4, 'm')
    cv.ellipse(12, 21, 4.6, 6, 'n')
    for i in range(5):                               # veins over the skin
        a = 0.7 + i * 0.42
        cv.taper_line(12, 30, 12 + math.cos(a) * 7.5, 21 - math.sin(a) * 6.5,
                      2, 0.6, 'n')
    cv.ellipse(11, 20, 2.8, 3.8, 'r')                # the thing inside
    cv.ellipse(11, 19, 1.4, 2.0, 'e')
    cv.px(11, 18, 'h')
    cv.taper_line(12, 15, 12, 12, 2.2, 0.9, 'm')     # spout
    cv.ellipse(12, 12, 2.2, 1.5, 'n')
    _objective_marker(cv, 12, bob, 'e')              # green: alien, not G.U.N.
    cv.outline('0')
    return cv


def obj_emerald(color, dark):
    """A Chaos Emerald on the ground: the HUD gem at more than twice the
    size, hovering over its own pool of light."""
    cv = Canvas(24, 36)
    cv.ellipse(12, 31, 7.5, 2.8, dark)               # pool of light below
    cv.ellipse(12, 31, 5, 1.7, color)
    cv.poly([(12, 8), (21, 17), (17, 29), (7, 29), (3, 17)], color)
    cv.poly([(7, 17), (12, 22), (7, 29), (3, 17)], dark)   # facet in shadow
    cv.poly([(12, 8), (16, 15), (12, 18), (8, 15)], '8')   # crown facet
    cv.px(11, 11, 'h'); cv.px(12, 11, 'h')
    cv.outline('0')
    for x0, y0 in ((2, 7), (21, 10), (4, 27), (20, 25)):
        cv.px(x0 - 1, y0, '8'); cv.px(x0 + 1, y0, '8')
        cv.px(x0, y0 - 1, '8'); cv.px(x0, y0 + 1, '8')
        cv.px(x0, y0, 'h')
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


