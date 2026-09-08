#!/usr/bin/env python3
"""
gen_sprites.py - build every game sprite sheet.

Outputs
  assets/sprites/*.png   browsable, editable source-of-truth images
  js/sprite_data.js      the same sheets inlined as base64 data URIs, so the
                         game runs from file:// with no fetch and no CORS

Run:  python3 tools/gen_sprites.py
"""

import base64
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pixel import Canvas, canvases_to_sheet, write_png, hexc
import chars
import enemies as E
import tiles as T
import ui as U

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PNG_DIR = os.path.join(ROOT, 'assets', 'sprites')
JS_OUT = os.path.join(ROOT, 'js', 'sprite_data.js')

sheets = {}     # name -> dict(frames, fw, fh, cols, png bytes)
clipped = []    # sprites whose art runs off the edge of its cell


def emit(name, canvases, palette, cols=None, frame_names=None, edge_check=True):
    # Tiles, HUD icons, projectiles and effects are meant to fill their cell;
    # only outlined actors need the border kept clear.
    if edge_check:
        clipped.extend(check_edges(name, canvases))
    pal = {k: hexc(v) for k, v in palette.items()}
    pix, W, H = canvases_to_sheet(canvases, pal, cols)
    path = os.path.join(PNG_DIR, name + '.png')
    write_png(path, pix, W, H)
    with open(path, 'rb') as f:
        raw = f.read()
    sheets[name] = {
        'fw': canvases[0].w, 'fh': canvases[0].h,
        'cols': cols or len(canvases), 'frames': len(canvases),
        'names': frame_names or {},
        'b64': base64.b64encode(raw).decode('ascii'),
    }
    print('  %-18s %3dx%-3d  %2d frames  %5d B' % (name, W, H, len(canvases), len(raw)))


def check_edges(name, canvases):
    """A sprite whose art touches the cell border loses its outline there,
    which shows up in game as a flat-cut quill or shoe. Catch it here."""
    bad = []
    for i, cv in enumerate(canvases):
        edge = [cv.g[0][x] for x in range(cv.w)]
        edge += [cv.g[cv.h - 1][x] for x in range(cv.w)]
        edge += [cv.g[y][0] for y in range(cv.h)]
        edge += [cv.g[y][cv.w - 1] for y in range(cv.h)]
        stray = sorted(set(c for c in edge if c not in '.O'))
        if stray:
            bad.append('%s frame %d: %s' % (name, i, ''.join(stray)))
    return bad


def crop(cv, x, y, w, h):
    out = Canvas(w, h)
    out.blit(cv, -x, -y)
    return out


def build():
    os.makedirs(PNG_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(JS_OUT), exist_ok=True)
    print('building sprite sheets...')

    # ---- playable / story hedgehogs ------------------------------------
    def hog_frames(kind):
        f = [chars.hedgehog(kind, 'idle', 0.0), chars.hedgehog(kind, 'idle', 0.5)]
        f += [chars.hedgehog(kind, 'skate', i / 4.0) for i in range(4)]
        f += [chars.hedgehog(kind, 'attack', 0.0), chars.hedgehog(kind, 'attack', 0.5)]
        f += [chars.hedgehog(kind, 'hurt', 0.0)]
        return f

    hog_names = {'idle': [0, 1], 'walk': [2, 3, 4, 5], 'attack': [6, 7], 'hurt': [8]}
    emit('shadow', hog_frames('shadow'), chars.SHADOW_PAL, frame_names=hog_names)
    emit('shadow_super', hog_frames('shadow'), chars.SUPER_PAL, frame_names=hog_names)
    emit('sonic', hog_frames('sonic'), chars.SONIC_PAL, frame_names=hog_names)
    emit('tails', hog_frames('tails'), chars.TAILS_PAL, frame_names=hog_names)

    # ---- G.U.N. --------------------------------------------------------
    gun = [E.gun_soldier(0.0), E.gun_soldier(0.5)]
    gun += [E.gun_soldier(i / 4.0, 'walk') for i in range(4)]
    gun += [E.gun_soldier(0.0, 'shoot')]
    emit('gun_soldier', gun, E.GUN_PAL,
         frame_names={'idle': [0, 1], 'walk': [2, 3, 4, 5], 'attack': [6], 'hurt': [1]})

    emit('gun_beetle', [E.gun_beetle(i / 4.0) for i in range(4)] + [E.gun_beetle(0.0, 'shoot')],
         E.GUN_PAL, frame_names={'idle': [0, 1, 2, 3], 'walk': [0, 1, 2, 3], 'attack': [4], 'hurt': [2]})

    emit('gun_hunter', [E.gun_hunter(0.0), E.gun_hunter(0.5), E.gun_hunter(0.25, 'shoot')],
         E.GUN_PAL, frame_names={'idle': [0, 1], 'walk': [0, 1], 'attack': [2], 'hurt': [1]})

    # ---- Black Arms ----------------------------------------------------
    bw = [E.black_warrior(0.0), E.black_warrior(0.5)]
    bw += [E.black_warrior(i / 4.0) for i in range(4)]
    bw += [E.black_warrior(0.0, 'attack')]
    emit('black_warrior', bw, E.BLACK_ARMS_PAL,
         frame_names={'idle': [0, 1], 'walk': [2, 3, 4, 5], 'attack': [6], 'hurt': [1]})

    emit('black_hawk', [E.black_hawk(i / 4.0) for i in range(4)] + [E.black_hawk(0.0, 'attack')],
         E.BLACK_ARMS_PAL, frame_names={'idle': [0, 1, 2, 3], 'walk': [0, 1, 2, 3], 'attack': [4], 'hurt': [2]})

    emit('black_oak', [E.black_oak(0.0), E.black_oak(0.5), E.black_oak(0.25, 'attack')],
         E.BLACK_ARMS_PAL, frame_names={'idle': [0, 1], 'walk': [0, 1], 'attack': [2], 'hurt': [1]})

    emit('black_doom', [E.black_doom(0.0), E.black_doom(0.5), E.black_doom(0.25, 'attack')],
         E.DOOM_PAL, frame_names={'idle': [0, 1], 'walk': [0, 1], 'attack': [2], 'hurt': [1]})

    emit('devil_doom', [E.devil_doom(0.0), E.devil_doom(0.5), E.devil_doom(0.25, 'attack')],
         E.DOOM_PAL, frame_names={'idle': [0, 1], 'walk': [0, 1], 'attack': [2], 'hurt': [1]})

    emit('maria', [E.maria(0.0), E.maria(0.5)], E.MARIA_PAL,
         frame_names={'idle': [0, 1], 'walk': [0, 1], 'attack': [0], 'hurt': [1]})

    # ---- dialogue portraits (head crops) -------------------------------
    def face(cv):
        return crop(cv, 10, 0, 32, 32)

    emit('face_shadow', [face(chars.hedgehog('shadow', 'idle', 0.0)),
                         face(chars.hedgehog('shadow', 'attack', 0.0))],
         chars.SHADOW_PAL, frame_names={'calm': [0], 'angry': [1]}, edge_check=False)
    emit('face_super', [face(chars.hedgehog('shadow', 'idle', 0.0))],
         chars.SUPER_PAL, frame_names={'calm': [0]}, edge_check=False)
    emit('face_sonic', [face(chars.hedgehog('sonic', 'idle', 0.0))], chars.SONIC_PAL,
         edge_check=False)
    emit('face_doom', [crop(E.black_doom(0.0), 12, 0, 32, 32)], E.DOOM_PAL, edge_check=False)
    emit('face_maria', [crop(E.maria(0.0), 5, 2, 32, 32)], E.MARIA_PAL, edge_check=False)

    # ---- tiles ---------------------------------------------------------
    tile_names = {}
    tcanvas = []
    for i, (n, fn) in enumerate(T.TILES):
        tile_names[n] = [i]
        tcanvas.append(fn())
    emit('tiles', tcanvas, T.TILE_PAL, cols=8, frame_names=tile_names, edge_check=False)

    # ---- 16x16 HUD icons ----------------------------------------------
    hud, hud_names = [], {}

    def add(nm, cv):
        hud_names[nm] = [len(hud)]
        hud.append(cv)

    add('soul', U.soul_red())
    add('soul_green', U.soul_green())
    for nm, c, d in U.EMERALD_COLORS:
        add(nm, U.emerald(c, d))
    add('ring', U.ring())
    add('icon_fight', U.icon_fight())
    add('icon_act', U.icon_act())
    add('icon_item', U.icon_item())
    add('icon_mercy', U.icon_mercy())
    for i in range(3):
        add('graze%d' % i, U.graze(i))
    emit('hud', hud, U.UI_PAL, cols=8, frame_names=hud_names, edge_check=False)

    # ---- projectiles (each its own size) --------------------------------
    for nm, fn in (('p_bullet', U.bullet_small), ('p_gun', U.bullet_gun),
                   ('p_spear', U.chaos_spear), ('p_orb', U.alien_orb),
                   ('p_eye', U.doom_eye), ('p_laser', U.laser),
                   ('p_blade', U.blade)):
        emit(nm, [fn()], U.UI_PAL, edge_check=False)

    # ---- effects --------------------------------------------------------
    emit('fx_slash', [U.slash(i) for i in range(3)], U.UI_PAL, edge_check=False)
    emit('fx_boom', [U.boom(i) for i in range(4)], U.UI_PAL, edge_check=False)

    # ---- write the JS payload -------------------------------------------
    parts = []
    for name in sorted(sheets):
        s = sheets[name]
        parts.append('  %s: {fw:%d,fh:%d,cols:%d,frames:%d,names:%s,src:"data:image/png;base64,%s"}'
                     % (json.dumps(name), s['fw'], s['fh'], s['cols'], s['frames'],
                        json.dumps(s['names'], separators=(',', ':')), s['b64']))
    js = ('// AUTO-GENERATED by tools/gen_sprites.py - do not edit by hand.\n'
          '// Every sheet below is original pixel art produced procedurally by\n'
          '// tools/{pixel,chars,enemies,tiles,ui}.py. Regenerate with:\n'
          '//     python3 tools/gen_sprites.py\n'
          'window.SH = window.SH || {};\n'
          'SH.SpriteData = {\n' + ',\n'.join(parts) + '\n};\n')
    with open(JS_OUT, 'w') as f:
        f.write(js)
    total = sum(len(s['b64']) for s in sheets.values())
    print('\n%d sheets -> %s (%.1f KB inlined)' % (len(sheets), os.path.relpath(JS_OUT, ROOT), total / 1024.0))
    if clipped:
        print('\nWARNING: art touches the cell border (outline will be cut):')
        for c in clipped:
            print('  ' + c)
    else:
        print('every frame keeps its outline inside its cell')


if __name__ == '__main__':
    build()
