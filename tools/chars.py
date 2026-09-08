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
    'c': '#8c1119', 'N': '#14101a', 'J': '#7fdcff',
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
def _leg(cv, hx, hy, phase, fur, shoe, accent, ring=True, length=9.5, rim=False):
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


def _shadow_quills(cv, hx, hy, flap=0.0):
    """Six head quills: four sweeping up-back, two down-back, each striped."""
    spec = [
        (hx - 4.0, hy - 6.5, hx - 13.0, hy - 13.5 + flap, 2.8, 0.7),
        (hx - 6.0, hy - 4.0, hx - 16.0, hy - 8.5 + flap * 0.7, 3.0, 0.7),
        (hx - 6.5, hy - 0.5, hx - 17.5, hy - 2.0 + flap * 0.4, 3.0, 0.7),
        (hx - 6.0, hy + 3.0, hx - 15.0, hy + 4.5 - flap * 0.4, 2.6, 0.7),
    ]
    for bx, by, tx, ty, r0, r1 in spec:
        cv.taper_line(bx, by, tx, ty, r0, r1, 'F')
    for bx, by, tx, ty, r0, r1 in spec:          # thin red streak per quill
        ux = bx + (tx - bx) * 0.15
        uy = by + (ty - by) * 0.15 - 1.0
        vx = bx + (tx - bx) * 0.72
        vy = by + (ty - by) * 0.72 - 0.4
        cv.taper_line(ux, uy, vx, vy, 1.0, 0.5, 'R')
    # two lower quills / back spines
    cv.taper_line(hx - 5, hy + 6.5, hx - 14, hy + 11, 2.4, 0.7, 'F')
    cv.taper_line(hx - 4, hy + 8.5, hx - 11, hy + 14, 2.0, 0.7, 'F')


def _sonic_quills(cv, hx, hy, flap=0.0):
    spec = [
        (hx - 4.5, hy - 5.0, hx - 14.0, hy - 10.0 + flap, 3.2, 0.8),
        (hx - 6.0, hy - 1.0, hx - 17.0, hy - 3.0 + flap * 0.6, 3.4, 0.8),
        (hx - 5.0, hy + 3.5, hx - 15.0, hy + 5.0 - flap * 0.5, 3.0, 0.8),
    ]
    for bx, by, tx, ty, r0, r1 in spec:
        cv.taper_line(bx, by, tx, ty, r0, r1, 'F')


def _tails_quills(cv, hx, hy, flap=0.0):
    cv.taper_line(hx - 5, hy - 5, hx - 11, hy - 11 + flap, 2.6, 0.8, 'F')
    cv.taper_line(hx - 6, hy - 1, hx - 13, hy - 4 + flap, 2.8, 0.8, 'F')
    cv.taper_line(hx - 5, hy + 3, hx - 12, hy + 4, 2.4, 0.8, 'F')
    cv.ellipse(hx - 2, hy - 9, 3.0, 2.2, 'M')


def _twin_tails(cv, x, y, phase):
    for i, off in enumerate((-2, 2)):
        w = math.sin(phase + i * 0.9) * 3.0
        cv.taper_line(x, y + off, x - 8, y + off - 2 + w, 2.6, 3.0, 'F')
        cv.circle(x - 9, y + off - 2 + w, 2.6, 'W')


def _head(cv, hx, hy, pal_eye='E', ear=True, muzzle_dx=8.0, stripe_eye=False,
          eye_dx=2.0, angry=True, mouth=True):
    cv.ellipse(hx, hy, 8.6, 8.0, 'F')                    # skull
    if ear:
        cv.poly([(hx - 2, hy - 7), (hx + 1, hy - 12.5), (hx + 4, hy - 6)], 'F')
        cv.poly([(hx - 0.5, hy - 7.5), (hx + 1, hy - 10.5), (hx + 2.5, hy - 7)], 'm')
    cv.ellipse(hx + muzzle_dx - 0.5, hy + 3.4, 5.8, 4.4, 'M')  # muzzle
    cv.ellipse(hx + muzzle_dx + 3.6, hy + 1.4, 1.8, 1.5, 'N')  # nose
    if mouth:
        cv.line(hx + muzzle_dx + 1, hy + 5.2, hx + muzzle_dx + 3.6, hy + 4.6, 'm')
    # eye: almond sclera, coloured iris, dark pupil, angled brow
    ex, ey = hx + eye_dx, hy - 1.0
    cv.ellipse(ex + 1.4, ey, 4.4, 3.4, 'S')
    cv.ellipse(ex + 2.6, ey + 0.2, 2.2, 2.6, pal_eye)
    cv.ellipse(ex + 3.0, ey + 0.2, 1.0, 1.6, 'e')
    if stripe_eye:                                        # red rim above the eye
        cv.line(ex - 2.6, ey - 3.4, ex + 4.4, ey - 4.2, 'R')
        cv.px(ex - 3.2, ey - 2.6, 'R')
    if angry:
        cv.line(ex - 2.4, ey - 3.0, ex + 3.4, ey - 3.8, 'O')
        cv.line(ex - 2.4, ey - 2.2, ex + 1.0, ey - 3.2, 'O')


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

    hx, hy = 24.0, 12.5 + bob
    torso_x, torso_y = 21.0, 27.0 + bob * 0.5
    hip_y = 32.0 + bob * 0.4

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
    _head(cv, hx, hy, ear=True, stripe_eye=striped,
          pal_eye='E', eye_dx=2.0)
    _arm(cv, torso_x + 3.6, torso_y - 0.5, arm_a, 'F', glove='W', ring=striped, rim=True, length=7.0)

    if pose == 'attack':                                        # Chaos energy
        for i in range(7):
            a = i * 0.9
            cv.px(34 + math.cos(a) * (3 + i * 0.4), 22 + math.sin(a) * (3 + i * 0.4), 'J')
    return _finish(cv)
