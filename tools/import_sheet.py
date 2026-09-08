#!/usr/bin/env python3
"""
import_sheet.py - put your own sprite sheet into the game.

The renderer reads every sheet out of js/sprite_data.js as a base64 data
URI so the game runs straight off the filesystem with no server and no
CORS trouble.  This script does the same for a PNG you supply and writes
it to js/sprite_override.js, which takes priority over the generated art.

    python3 tools/import_sheet.py shadow path/to/sheet.png --fw 40 --fh 44 --cols 9

Add --keep to append to an existing override file instead of replacing it.
Frame roles default to the project's own layout:
    idle 0,1   walk 2-5   attack 6,7   hurt 8
Pass --names '{"idle":[0],"walk":[1,2]}' to override that.
"""

import argparse
import base64
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'js', 'sprite_override.js')

DEFAULT_NAMES = {'idle': [0, 1], 'walk': [2, 3, 4, 5], 'attack': [6, 7], 'hurt': [8]}


def png_size(path):
    """Read width/height straight out of the IHDR chunk."""
    with open(path, 'rb') as f:
        head = f.read(33)
    if head[:8] != b'\x89PNG\r\n\x1a\n':
        raise SystemExit('%s is not a PNG' % path)
    w = int.from_bytes(head[16:20], 'big')
    h = int.from_bytes(head[20:24], 'big')
    return w, h


def read_existing():
    if not os.path.exists(OUT):
        return {}
    src = open(OUT, encoding='utf-8').read()
    m = re.search(r'SH\.SpriteOverrides\s*=\s*(\{.*\});', src, re.S)
    if not m:
        return {}
    body = m.group(1)
    # strip block comments so the example entry never parses as data
    body = re.sub(r'/\*.*?\*/', '', body, flags=re.S)
    try:
        return json.loads(body)
    except Exception:
        return {}


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('name', help='sheet name to replace, e.g. shadow, sonic, gun_soldier')
    ap.add_argument('png', help='path to your sprite sheet PNG')
    ap.add_argument('--fw', type=int, help='frame width in pixels')
    ap.add_argument('--fh', type=int, help='frame height in pixels')
    ap.add_argument('--cols', type=int, help='frames per row (default: all on one row)')
    ap.add_argument('--frames', type=int, help='total frame count')
    ap.add_argument('--names', help='JSON map of animation name -> frame indices')
    ap.add_argument('--keep', action='store_true', help='keep other overrides already present')
    a = ap.parse_args()

    if not os.path.exists(a.png):
        raise SystemExit('no such file: ' + a.png)
    W, H = png_size(a.png)
    fw = a.fw or W
    fh = a.fh or H
    cols = a.cols or max(1, W // fw)
    frames = a.frames or (cols * max(1, H // fh))
    names = json.loads(a.names) if a.names else DEFAULT_NAMES

    with open(a.png, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('ascii')

    data = read_existing() if a.keep else {}
    data[a.name] = {
        'fw': fw, 'fh': fh, 'cols': cols, 'frames': frames, 'names': names,
        'src': 'data:image/png;base64,' + b64
    }

    body = ',\n'.join(
        '  %s: %s' % (json.dumps(k), json.dumps(v, ensure_ascii=False))
        for k, v in sorted(data.items()))
    js = ('/* Written by tools/import_sheet.py - your artwork overrides the\n'
          '   generated sheets of the same name. Delete an entry to fall back. */\n'
          'window.SH = window.SH || {};\n'
          'SH.SpriteOverrides = {\n' + body + '\n};\n')
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(js)

    print('%s: %dx%d sheet -> %d frames of %dx%d (%d cols)'
          % (a.name, W, H, frames, fw, fh, cols))
    print('wrote ' + os.path.relpath(OUT, ROOT))


if __name__ == '__main__':
    main()
