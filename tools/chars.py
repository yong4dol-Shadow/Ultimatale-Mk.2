"""
chars.py - parametric character sprite definitions.

Every character is drawn back-to-front on a Canvas from the toolkit in
pixel.py.  Proportions follow the GBA "Advance / Battle" side-view build
(large head ~= 45% of total height, small torso, chunky shoes), which is
the reference frame the design doc calls for.

All artwork is original: no ripped or third-party image data is used.
"""

import math
from pixel import Canvas

CELL_W, CELL_H = 40, 44
GROUND = 42

# --------------------------------------------------------------------------
# palettes
# --------------------------------------------------------------------------
SHADOW_PAL = {
    'O': '#0a0a12', 'F': '#2b2b3d', 'f': '#181824', 'H': '#4b4b6b',
    'R': '#d8232f', 'r': '#8c1119', 'M': '#f0c49a', 'm': '#c9976c',
    'W': '#f2f2f8', 'w': '#b6b6c8', 'E': '#ff3b45', 'e': '#6d0a12',
    'S': '#ffffff', 'Y': '#ffd23f', 'y': '#b8860b', 'C': '#d8232f',
    'c': '#8c1119', 'N': '#1a1420', 'n': '#4d3f48', 'J': '#7fdcff',
    'o': '#ff7a1a', 'O2': '#ffd23f',
}

SUPER_PAL = dict(SHADOW_PAL)
SUPER_PAL.update({
    'F': '#ffe066', 'f': '#d9a01f', 'H': '#fff6c2', 'R': '#ff9a1f',
    'r': '#c05a00', 'E': '#ff2f3f', 'C': '#ff9a1f', 'c': '#c05a00',
    'H2': '#ffffff',
})

SONIC_PAL = dict(SHADOW_PAL)
SONIC_PAL.update({
    'F': '#2f6ad4', 'f': '#1b4291', 'H': '#63a5f2', 'R': '#2f6ad4',
    'r': '#1b4291', 'E': '#2fa538', 'e': '#0d4a12', 'C': '#e0202a',
    'c': '#8c1119',
})

TAILS_PAL = dict(SHADOW_PAL)
TAILS_PAL.update({
    'F': '#f0902a', 'f': '#c1650f', 'H': '#ffc072', 'R': '#f0902a',
    'r': '#c1650f', 'E': '#3a7ad8', 'e': '#12356e', 'C': '#e0202a',
    'c': '#8c1119', 'M': '#ffe2b8', 'm': '#d9ab77',
})


# --------------------------------------------------------------------------
# limb helpers
# --------------------------------------------------------------------------
def _leg(cv, hx, hy, phase, fur, shoe, accent, ring=True, length=9.0, rim=False):
    """Draw one leg + Air Shoe. `phase` is the run-cycle angle in radians."""
    swing = math.sin(phase)
    lift = max(0.0, math.cos(phase)) * 3.0
    kx = hx + swing * 3.6
    ky = hy + length * 0.5 - lift * 0.35
    fx = hx + swing * 6.8
    fy = hy + length - lift
    if rim:   # dark rim so a black leg stays readable against a black body
        cv.taper_line(hx, hy, kx, ky, 3.1, 2.7, 'O')
        cv.taper_line(kx, ky, fx, fy - 1.4, 2.7, 2.4, 'O')
        cv.ellipse(fx + 0.6, fy - 0.2, 5.1, 3.1, 'O')
    cv.taper_line(hx, hy, kx, ky, 2.2, 1.8, fur)
    cv.taper_line(kx, ky, fx, fy - 1.4, 1.8, 1.5, fur)
    if ring:                                   # gold Limiter Ring on the ankle
        cv.line(fx - 1.6, fy - 2.6, fx + 1.6, fy - 2.6, 'Y')
    # Air Shoe: black cuff, red tongue, white sole, jet vent at the heel
    cv.ellipse(fx + 0.6, fy - 0.2, 4.2, 2.2, shoe)
    cv.ellipse(fx + 2.2, fy - 0.6, 2.6, 1.8, accent)
    cv.ellipse(fx + 3.4, fy + 0.2, 1.6, 1.4, 'W')
    cv.rect(fx - 3.4, fy + 0.9, 8, 2, 'W')
    cv.px(fx - 3.6, fy - 0.6, 'J')
    cv.px(fx - 4.2, fy - 0.2, 'J')
    return fx, fy


def _arm(cv, sx, sy, phase, fur, glove='W', ring=True, length=8.0, rim=False):
    swing = math.sin(phase)
    ex = sx + swing * 3.4
    ey = sy + length * 0.55
    hx = sx + swing * 6.4
    hy = sy + length - abs(swing) * 1.5
    if rim:
        cv.taper_line(sx, sy, ex, ey, 2.9, 2.5, 'O')
        cv.taper_line(ex, ey, hx, hy, 2.5, 2.3, 'O')
        cv.circle(hx, hy + 0.6, 3.1, 'O')
    cv.taper_line(sx, sy, ex, ey, 2.0, 1.6, fur)
    cv.taper_line(ex, ey, hx, hy, 1.6, 1.4, fur)
    if ring:
        cv.line(hx - 1.8, hy - 2.2, hx + 1.8, hy - 2.2, 'Y')
    cv.circle(hx, hy + 0.6, 2.2, glove)
    return hx, hy + 0.6


def _quill(cv, bx, by, deg, length, w0, w1, stripe=False):
    """One quill as a broad tapered wedge aimed along `deg`.

    Quills are placed by angle so they fan out with real gaps between
    them.  Drawing them as tapered *lines* made them read as a handful of
    needles; giving every quill the same base region made them merge into
    one hood.  A fan of quads sits between those two failures.
    """
    a = math.radians(deg)
    dx, dy = math.cos(a), math.sin(a)
    px, py = -dy, dx                                   # perpendicular
    tx, ty = bx + dx * length, by + dy * length
    cv.poly([(bx + px * w0, by + py * w0), (tx + px * w1, ty + py * w1),
             (tx - px * w1, ty - py * w1), (bx - px * w0, by - py * w0)], 'F')
    if stripe and length >= 5.6:                       # red streak on the top face
        off = w0 * 0.40
        cv.taper_line(bx + dx * length * 0.10 + px * off,
                      by + dy * length * 0.10 + py * off,
                      bx + dx * length * 0.72 + px * off * 0.5,
                      by + dy * length * 0.72 + py * off * 0.5,
                      0.95, 0.5, 'R')


def _shadow_quills(cv, hx, hy, flap=0.0):
    """Six quills: four sweeping up-back, two down-back, each red-striped."""
    for bx, by, deg, ln, w0, w1 in (
            (hx - 3.6, hy - 6.2, 210 + flap, 8.8, 2.2, 0.9),
            (hx - 5.6, hy - 3.4, 201 + flap * 0.7, 11.5, 2.4, 0.9),
            (hx - 6.0, hy + 0.6, 180, 11.5, 2.4, 0.9),
            (hx - 5.0, hy + 4.4, 158 - flap * 0.5, 10.0, 2.2, 0.9)):
        _quill(cv, bx, by, deg, ln, w0, w1, stripe=True)
    _quill(cv, hx - 4.0, hy + 7.4, 146, 8.5, 2.3, 0.9)     # back spine


def _sonic_quills(cv, hx, hy, flap=0.0):
    for bx, by, deg, ln, w0, w1 in (
            (hx - 4.0, hy - 5.2, 204 + flap, 11.2, 2.9, 1.1),
            (hx - 5.6, hy - 1.6, 189 + flap * 0.6, 13.5, 3.2, 1.1),
            (hx - 4.8, hy + 2.6, 166, 12.0, 2.9, 1.1)):
        _quill(cv, bx, by, deg, ln, w0, w1)


def _tails_quills(cv, hx, hy, flap=0.0):
    for bx, by, deg, ln, w0, w1 in (
            (hx - 3.8, hy - 6.2, 222 + flap, 7.5, 2.4, 0.9),
            (hx - 5.4, hy - 2.8, 198 + flap * 0.6, 8.5, 2.6, 0.9),
            (hx - 5.0, hy + 1.0, 172, 8.0, 2.4, 0.9)):
        _quill(cv, bx, by, deg, ln, w0, w1)
    _quill(cv, hx - 1.0, hy - 7.4, 285, 5.0, 2.2, 0.8)      # forehead tuft


def _twin_tails(cv, x, y, phase):
    for i, off in enumerate((-2, 2)):
        w = math.sin(phase + i * 0.9) * 3.0
        cv.taper_line(x, y + off, x - 8, y + off - 2 + w, 2.6, 3.0, 'F')
        cv.circle(x - 9, y + off - 2 + w, 2.6, 'W')


# --------------------------------------------------------------------------
# face parts, authored pixel by pixel
#
# At ~17px across, a head drawn from ellipses reads as a blob: the eye
# rounds off into a circle and the snout melts into the skull.  These two
# stamps carry the whole likeness, so they are placed by hand.
#   O outline   S sclera   I iris   e pupil   W glint
#   M muzzle    m shade    N nose   n nose highlight
# --------------------------------------------------------------------------
# In the source style the profile is a round head: the tan muzzle stays
# INSIDE the silhouette and it is the black NOSE that pokes out of it as a
# small bump. Idle sprites carry no mouth at all.
#   O outline   S sclera   I iris   e pupil
#   M muzzle    m shade    N nose   n nose highlight
EYE = [
    '..OOOOO.',
    '.OSSSIIO',
    'OSSSSIeO',
    'OSSSSIeO',
    '.OSSSIIO',
    '..OOOOO.',
]

MUZZLE = [
    '...MMMM.....',
    '.MMMMMMNN...',
    'MMMMMMnNNN..',
    'MMMMMMMNN...',
    '.MMMMMM.....',
    '..mMMm......',
]


def _head(cv, hx, hy, pal_eye='E', ear=True, stripe_eye=False,
          eye_dx=-3.4, eye_dy=-6.0, muzzle_dx=1.0, muzzle_dy=-1.6):
    """Side-view head.

    The likeness lives in the relationship between two parts: a large
    rounded muzzle carried forward off the skull, and a compact oval eye
    seated on its upper-back edge so the two touch.  No mouth - the
    source sprites only draw one for specific expressions.
    """
    cv.ellipse(hx, hy, 9.0, 8.4, 'F')                        # skull

    if ear:                                                  # ear, upper back
        cv.poly([(hx - 4.8, hy - 5.8), (hx - 2.4, hy - 10.6), (hx + 1.8, hy - 6.4)], 'F')
        cv.poly([(hx - 2.6, hy - 7.0), (hx - 2.2, hy - 8.4), (hx - 1.0, hy - 7.2)], 'm')

    cv.stamp(MUZZLE, hx + muzzle_dx, hy + muzzle_dy)
    cv.stamp(EYE, hx + eye_dx, hy + eye_dy, {'I': pal_eye})

    if stripe_eye:                                           # red rim on the lid
        ex, ey = hx + eye_dx, hy + eye_dy
        cv.line(ex + 2, ey - 1, ex + 5, ey - 1, 'R')
        cv.px(ex + 1, ey + 0, 'R')
        cv.px(ex + 6, ey + 0, 'R')


# --------------------------------------------------------------------------
# overworld build
#
# The 40x44 actor is a battle sprite: at 16px tiles it stands nearly three
# tiles tall and dwarfs the map. Overworld sprites are their own, smaller
# and simpler set - two thirds the height, three quills, and face parts
# reduced to what still reads at that size.
# --------------------------------------------------------------------------
OW_W, OW_H = 34, 30
OW_GROUND = 29

EYE_S = [
    '.OOO.',
    'OSSIO',
    'OSIeO',
    '.OOO.',
]

MUZZLE_S = [
    '..MMM..',
    '.MMMMN.',
    'MMMMMNN',
    'MMMMMM.',
    '.mMMm..',
]


def _flame(cv, x, y, size=1.0, back=-1):
    """The Air Shoes' jet wash - kept flat and swept back so it reads as a
    skater's spray rather than a torch strapped to each boot."""
    cv.taper_line(x, y, x + back * 4.0 * size, y - 0.2, 1.1 * size, 0.5, 'r')
    cv.taper_line(x, y, x + back * 2.8 * size, y - 0.1, 0.8 * size, 0.5, 'o')
    cv.px(x + back * 1.2 * size, y, 'O2')


def _glide_trail(cv, x, y, phase=0.0, width=9):
    """Ground-level speed streaks left behind the shoes."""
    for i in range(3):
        off = (i * 3 + phase * 3) % 9
        ln = width - i * 2
        cv.line(x - off, y + i, x - off - ln, y + i, 'c' if i == 1 else 'w')


def _small_leg(cv, hx, hy, phase, fur, shoe, accent,
               length=6.5, stride=4.0, flame=0.0, glide=False):
    swing = math.sin(phase)
    # a running leg lifts; a skating leg stays on the floor and slides out
    lift = 0.0 if glide else max(0.0, math.cos(phase)) * 2.0
    fx = hx + swing * stride
    fy = hy + length - lift
    cv.taper_line(hx, hy, fx, fy - 1.0, 1.7, 1.3, fur)
    cv.ellipse(fx + 0.4, fy - 0.2, 2.8, 1.6, shoe)
    cv.ellipse(fx + 1.4, fy - 0.6, 1.6, 1.1, accent)
    cv.rect(fx - 2.4, fy + 0.7, 6, 1, 'W')
    if flame > 0:
        # low, swept-back jet wash rather than a torch: it hugs the ground
        _flame(cv, fx - 2.8, fy + 0.1, flame)


# Front view: both eyes at once, irises turned inward the way the source
# sprites draw them.
FRONT_EYES = [
    '.OOO....OOO.',
    'OSSIO..OISSO',
    'OSSIO..OISSO',
    '.OOO....OOO.',
]

FRONT_MUZZLE = [
    '.MMMMM.',
    'MMNNNMM',
    'MMMNMMM',
    '.mMMMm.',
]


def _ow_body(cv, tx, ty, hip, leg_a, leg_b, arm_swing, striped, wide, skate=False):
    """Torso, arms and legs shared by all three overworld facings.

    `wide` spreads the limbs for the front and back views, where both of
    each are visible; the side view stacks them instead.
    """
    ln = 6.3 if skate else 6.5
    st = 5.6 if skate else 4.0
    # flame strength follows each foot through the cycle
    fa = (0.5 + 0.5 * math.cos(leg_a)) * 1.15 if skate else 0.0
    fb = (0.5 + 0.5 * math.cos(leg_b)) * 1.0 if skate else 0.0
    if wide:
        _small_leg(cv, tx - 2.4, hip, leg_b, 'f', 'f', 'c', ln, st * 0.5, fb, skate)
        _small_leg(cv, tx + 2.4, hip, leg_a, 'F', 'F', 'C', ln, st * 0.5, fa, skate)
        cv.taper_line(tx - 4.0, ty - 1, tx - 4.8, ty + 3.6, 1.4, 1.1, 'f')
        cv.circle(tx - 4.8, ty + 4.4, 1.5, 'w')
        cv.taper_line(tx + 4.0, ty - 1, tx + 4.8, ty + 3.6, 1.5, 1.2, 'F')
        cv.circle(tx + 4.8, ty + 4.4, 1.6, 'W')
    else:
        _small_leg(cv, tx - 0.4, hip, leg_b, 'f', 'f', 'r', ln, st, fb, skate)
        _small_leg(cv, tx + 1.4, hip, leg_a, 'F', 'F', 'C', ln, st, fa, skate)
        cv.taper_line(tx + 0.6, ty - 1, tx - 1.4, ty + 4, 1.4, 1.1, 'f')
        cv.taper_line(tx + 2.2, ty - 1.2, tx + 2.2 + arm_swing * 3.0, ty + 4.0, 1.5, 1.2, 'F')
        cv.circle(tx + 2.2 + arm_swing * 3.0, ty + 4.6, 1.6, 'W')
    if striped:
        cv.px(tx - 3.4, ty + 1, 'R') if wide else None


def _ow_side(cv, kind, pose, ang, striped, t_phase=0.0):
    bob = -abs(math.sin(ang)) * 0.8 if pose == 'walk' else 0.0
    if pose == 'skate':
        # leaned forward over the Air Shoes, riding low and level - the
        # body barely rises, which is what separates a glide from a run
        hx, hy = 20.8, 10.6 - abs(math.sin(ang)) * 0.25
        tx, ty = 16.2, 18.0
        hip = 20.8
    else:
        hx, hy = 19.0, 8.6 + bob
        tx, ty = 17.2, 17.0 + bob * 0.6
        hip = 21.0 + bob * 0.5

    if pose == 'walk':
        leg_a, leg_b, arm = ang, ang + math.pi, math.sin(ang + math.pi)
    elif pose == 'skate':
        # the feet alternate push and glide, but neither leaves the ground
        leg_a, leg_b, arm = ang, ang + math.pi, math.sin(ang + math.pi) * 0.55
    else:
        leg_a, leg_b, arm = 0.5, -0.5, 0.35

    spec = {
        'shadow': ((-2.4, -4.0, 202, 5.8, 1.5), (-3.6, -1.8, 186, 7.0, 1.7),
                   (-3.2, 1.6, 162, 6.0, 1.5)),
        'sonic':  ((-2.8, -3.8, 204, 7.0, 1.8), (-3.6, -0.8, 188, 7.6, 1.9),
                   (-3.0, 2.2, 166, 6.8, 1.7)),
        'tails':  ((-2.6, -4.2, 216, 4.8, 1.5), (-3.4, -1.6, 198, 5.4, 1.6),
                   (-3.0, 1.0, 174, 5.0, 1.5)),
    }[kind]
    swept = 7 if pose == 'skate' else 0        # quills stream back at speed
    for dx, dy, deg, ln, w0 in spec:
        _quill(cv, hx + dx, hy + dy, deg - swept, ln, w0, 0.7, stripe=striped)
    cv.taper_line(tx - 3, hip - 2, tx - 6, hip - 4, 1.4, 0.5, 'F')

    if pose == 'skate':
        _glide_trail(cv, 14, 26, t_phase, 7)
    _ow_body(cv, tx, ty, hip, leg_a, leg_b, arm, striped, False, pose == 'skate')

    cv.ellipse(hx, hy, 5.6, 5.2, 'F')
    cv.poly([(hx - 3.0, hy - 3.6), (hx - 1.4, hy - 7.0), (hx + 1.4, hy - 4.0)], 'F')
    cv.stamp(MUZZLE_S, hx + 1.6, hy - 1.0)
    cv.stamp(EYE_S, hx - 2.0, hy - 4.0, {'I': 'E'})
    if striped:
        cv.px(hx - 1.0, hy - 5.0, 'R')
        cv.px(hx + 0.0, hy - 5.0, 'R')



def _ow_front(cv, kind, pose, ang, striped, back, t_phase=0.0):
    """Front (walking toward the camera) or back (walking away)."""
    bob = -abs(math.sin(ang)) * 0.8 if pose == 'walk' else 0.0
    hx, hy = 17.0, 9.0 + bob + (1.0 if pose == 'skate' else 0.0)
    tx, ty = 17.0, 17.2 + bob * 0.6
    hip = 20.2 + bob * 0.5

    if pose == 'walk':
        leg_a, leg_b = ang, ang + math.pi
    elif pose == 'skate':
        leg_a, leg_b = ang, ang + math.pi
    else:
        leg_a, leg_b = 0.4, -0.4

    # quills fan out symmetrically to both sides, plus one over the crown
    n = {'shadow': 3, 'sonic': 3, 'tails': 2}[kind]
    ln = {'shadow': 5.4, 'sonic': 6.0, 'tails': 4.6}[kind]
    for i in range(n):
        spread = 22 + i * 24                      # 22 / 46 / 70 degrees down
        for side in (-1, 1):
            deg = (180 - spread) if side < 0 else spread
            _quill(cv, hx + side * 3.2, hy - 2.2 + i * 2.2, deg, ln - i * 0.6, 1.8, 0.7)
            if striped:                           # one clean streak per quill
                a = math.radians(deg)
                cv.line(hx + side * 3.6 + math.cos(a) * 1.2,
                        hy - 2.8 + i * 2.2 + math.sin(a) * 1.2,
                        hx + side * 3.6 + math.cos(a) * (ln - i * 0.6 - 1.4),
                        hy - 2.8 + i * 2.2 + math.sin(a) * (ln - i * 0.6 - 1.4), 'R')
    _quill(cv, hx, hy - 3.8, 270, 3.0, 1.9, 0.8)

    if pose == 'skate':
        _glide_trail(cv, hx - 4, 26, t_phase, 5)
        _glide_trail(cv, hx + 9, 26, t_phase + 0.5, 5)
    _ow_body(cv, tx, ty, hip, leg_a, leg_b, 0, striped, True, pose == 'skate')
    cv.ellipse(tx, ty - 1.0, 2.4, 2.6, 'w' if back else 'W')      # chest / back fur

    cv.ellipse(hx, hy, 6.4, 5.6, 'F')                              # skull
    for side in (-1, 1):                                           # ears
        cv.poly([(hx + side * 2.4, hy - 4.2), (hx + side * 4.0, hy - 7.2),
                 (hx + side * 5.4, hy - 3.6)], 'F')
        if not back:
            cv.px(hx + side * 3.8, hy - 5.2, 'm')

    if back:
        # back of the head: a couple of short spines, no face
        for side in (-1, 1):
            _quill(cv, hx + side * 2.0, hy + 1.0, 90 - side * 32, 4.4, 1.6, 0.7,
                   stripe=striped)
        if striped:
            cv.line(hx - 3, hy - 3, hx + 3, hy - 3, 'R')
    else:
        cv.stamp(FRONT_MUZZLE, hx - 3, hy + 1)
        cv.stamp(FRONT_EYES, hx - 6, hy - 3, {'I': 'E'})
        if striped:
            cv.line(hx - 5, hy - 4, hx - 2, hy - 4, 'R')
            cv.line(hx + 2, hy - 4, hx + 5, hy - 4, 'R')




def hedgehog_small(kind='shadow', pose='idle', t=0.0, facing='side'):
    """A compact overworld frame. `facing` is 'side', 'down' or 'up'."""
    cv = Canvas(OW_W, OW_H)
    ang = t * math.pi * 2.0
    striped = (kind == 'shadow')
    if facing == 'side':
        _ow_side(cv, kind, pose, ang, striped, t)
    else:
        _ow_front(cv, kind, pose, ang, striped, facing == 'up', t)
    cv.outline('O')
    cv.shade('F', 'f', 'H')
    cv.shade('M', 'm')
    cv.shade('W', 'w')
    cv.shade('C', 'c')
    return cv


def _pistol(cv, x, y, flash=False):
    """The sidearm Shadow carries in the 2005 game, plus its muzzle flash."""
    cv.rect(x - 1, y - 1, 8, 3, 'w')                     # slide
    cv.rect(x - 1, y - 1, 8, 1, 'W')
    cv.rect(x + 5, y + 0.4, 2, 2, 'f')                   # muzzle block
    cv.rect(x - 1, y + 1.6, 3, 3, 'f')                   # grip
    cv.px(x + 1, y + 1.6, 'w')
    if flash:
        cv.ellipse(x + 8.4, y + 0.4, 2.6, 2.2, 'o')
        cv.ellipse(x + 7.8, y + 0.4, 1.7, 1.4, 'O2')
        cv.px(x + 7.2, y + 0.4, 'W')


def _finish(cv):
    cv.outline('O')
    cv.shade('F', 'f', 'H')
    cv.shade('M', 'm')
    cv.shade('W', 'w')
    cv.shade('C', 'c')
    cv.shade('R', 'r')
    return cv


# --------------------------------------------------------------------------
# full character builders
# --------------------------------------------------------------------------
def hedgehog(kind='shadow', pose='idle', t=0.0, bob=0.0):
    """Build one frame. `t` in [0,1) drives cyclic poses."""
    cv = Canvas(CELL_W, CELL_H)
    ang = t * math.pi * 2.0

    hx, hy = 24.0, 12.8 + bob
    torso_x, torso_y = 21.0, 27.0 + bob * 0.5
    hip_y = 31.5 + bob * 0.4

    if pose == 'skate':
        lean = 2.0
        hx -= lean
        torso_x -= lean * 0.6
        leg_a, leg_b = ang, ang + math.pi
        arm_a, arm_b = ang + math.pi, ang
    elif pose == 'run':
        leg_a, leg_b = ang, ang + math.pi
        arm_a, arm_b = ang + math.pi, ang
    elif pose == 'attack':
        leg_a, leg_b = -0.6, 0.7
        arm_a, arm_b = -1.35, 0.5
    elif pose == 'shoot':
        # braced firing stance: front arm straight out, weight on the back leg
        leg_a, leg_b = -0.35, 0.75
        arm_a, arm_b = -1.52, 0.55
    elif pose == 'hurt':
        hx += 1.5
        leg_a, leg_b = 0.9, -0.9
        arm_a, arm_b = -1.2, -1.4
    else:  # idle / battle stance
        leg_a, leg_b = 0.55, -0.5
        arm_a, arm_b = 0.5 + math.sin(ang) * 0.14, -0.45

    quills = {'shadow': _shadow_quills, 'sonic': _sonic_quills,
              'tails': _tails_quills}[kind]
    striped = (kind == 'shadow')

    # --- back-to-front ---------------------------------------------------
    quills(cv, hx, hy, flap=math.sin(ang) * 1.2)
    if kind == 'tails':
        _twin_tails(cv, torso_x - 5, hip_y - 2, ang)
    else:
        cv.taper_line(torso_x - 5, hip_y - 3, torso_x - 10, hip_y - 6, 2.0, 0.6, 'F')

    _arm(cv, torso_x + 0.2, torso_y - 1.5, arm_b, 'f', glove='w', ring=striped, length=7.0)
    _leg(cv, torso_x - 0.5, hip_y, leg_b, 'f', 'f', 'r', ring=striped)

    cv.ellipse(torso_x, torso_y, 5.4, 6.2, 'F')                 # torso
    cv.ellipse(torso_x + 4.4, torso_y - 3.2, 2.4, 2.8, 'W')     # chest fur
    if striped:                                                  # arm/leg stripes
        cv.px(torso_x + 6.2, torso_y - 3.4, 'R')

    _leg(cv, torso_x + 1.6, hip_y, leg_a, 'F', 'F', 'C', ring=striped, rim=True)
    _head(cv, hx, hy, ear=True, stripe_eye=striped, pal_eye='E')
    if pose == 'shoot':
        # _arm() only swings; it cannot raise, so the firing arm is drawn
        # straight out at chest height instead
        sx, sy = torso_x + 3.0, torso_y - 1.5
        ex, ey = sx + 5.0, sy - 0.6
        cv.taper_line(sx, sy, ex, ey, 2.8, 2.4, 'O')
        cv.circle(ex, ey, 2.9, 'O')
        cv.taper_line(sx, sy, ex, ey, 2.0, 1.6, 'F')
        if striped:
            cv.line(sx + 1, sy - 1.6, sx + 4, sy - 1.8, 'R')
            cv.line(ex - 1.6, ey - 2.4, ex + 0.4, ey - 2.4, 'Y')   # limiter ring
        cv.circle(ex, ey, 1.9, 'W')
        # only Shadow carries the sidearm; the others just throw a punch
        if striped:
            # the muzzle flash is drawn by the battle scene, not baked in -
            # at this cell width it would run off the right edge
            _pistol(cv, ex + 1.8, ey - 0.8)
    else:
        _arm(cv, torso_x + 3.6, torso_y - 0.5, arm_a, 'F', glove='W',
             ring=striped, rim=True, length=7.0)

    if pose == 'attack':                                        # Chaos energy
        for i in range(7):
            a = i * 0.9
            cv.px(34 + math.cos(a) * (3 + i * 0.4), 22 + math.sin(a) * (3 + i * 0.4), 'J')
    return _finish(cv)
