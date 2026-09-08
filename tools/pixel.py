"""
pixel.py - a tiny parametric pixel-art toolkit.

Everything in this project's sprite pipeline is authored here as code:
shapes are rasterised onto a character grid (one char == one pixel),
then an automatic outline + shading pass gives the result the chunky,
hard-edged look of a 16-bit console sprite.

Authoring sprites parametrically (instead of as static image blobs)
means every animation frame is a real redraw - a run cycle is produced
by feeding a different leg angle into the same draw function, not by
hand-copying a bitmap - and every character is 100% original artwork.
"""

import math
import struct
import zlib

TRANSPARENT = '.'


def _round(v):
    """Half-up rounding.

    Python's built-in round() is banker's rounding, so 20.5 and 21.5 both
    land on 20/22 - laying a pixel stamp at a half-pixel origin would drop
    every other column.
    """
    return int(math.floor(v + 0.5))


class Canvas:
    """A grid of palette characters. '.' is transparent."""

    def __init__(self, w, h, fill=TRANSPARENT):
        self.w = w
        self.h = h
        self.g = [[fill] * w for _ in range(h)]

    # ---- low level -----------------------------------------------------
    def inside(self, x, y):
        return 0 <= x < self.w and 0 <= y < self.h

    def get(self, x, y):
        if not self.inside(x, y):
            return TRANSPARENT
        return self.g[y][x]

    def px(self, x, y, c):
        if c == TRANSPARENT:
            return
        x = _round(x)
        y = _round(y)
        if self.inside(x, y):
            self.g[y][x] = c

    def px_if(self, x, y, c, only):
        """Paint only over one of the colours in `only` (a string of chars)."""
        x, y = _round(x), _round(y)
        if self.inside(x, y) and self.g[y][x] in only:
            self.g[y][x] = c

    # ---- primitives ----------------------------------------------------
    def rect(self, x, y, w, h, c):
        for j in range(int(h)):
            for i in range(int(w)):
                self.px(x + i, y + j, c)

    def rect_out(self, x, y, w, h, c):
        for i in range(int(w)):
            self.px(x + i, y, c)
            self.px(x + i, y + h - 1, c)
        for j in range(int(h)):
            self.px(x, y + j, c)
            self.px(x + w - 1, y + j, c)

    def ellipse(self, cx, cy, rx, ry, c):
        rx = max(rx, 0.5)
        ry = max(ry, 0.5)
        for y in range(int(math.floor(cy - ry)), int(math.ceil(cy + ry)) + 1):
            for x in range(int(math.floor(cx - rx)), int(math.ceil(cx + rx)) + 1):
                dx = (x - cx) / rx
                dy = (y - cy) / ry
                if dx * dx + dy * dy <= 1.02:
                    self.px(x, y, c)

    def circle(self, cx, cy, r, c):
        self.ellipse(cx, cy, r, r, c)

    def line(self, x0, y0, x1, y1, c, thick=1):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for i in range(n):
            t = i / max(n - 1, 1)
            x = x0 + (x1 - x0) * t
            y = y0 + (y1 - y0) * t
            if thick <= 1:
                self.px(x, y, c)
            else:
                self.circle(x, y, thick / 2.0, c)

    def taper_line(self, x0, y0, x1, y1, r0, r1, c):
        """A line whose radius interpolates - used for quills, tails, horns."""
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 2
        for i in range(n + 1):
            t = i / n
            x = x0 + (x1 - x0) * t
            y = y0 + (y1 - y0) * t
            r = r0 + (r1 - r0) * t
            if r <= 0.55:
                self.px(x, y, c)
            else:
                self.circle(x, y, r, c)

    def poly(self, pts, c):
        if not pts:
            return
        ys = [p[1] for p in pts]
        for y in range(int(math.floor(min(ys))), int(math.ceil(max(ys))) + 1):
            xs = []
            for i in range(len(pts)):
                x0, y0 = pts[i]
                x1, y1 = pts[(i + 1) % len(pts)]
                if y0 == y1:
                    continue
                if min(y0, y1) <= y < max(y0, y1):
                    xs.append(x0 + (y - y0) * (x1 - x0) / (y1 - y0))
            xs.sort()
            for i in range(0, len(xs) - 1, 2):
                for x in range(int(math.floor(xs[i])), int(math.ceil(xs[i + 1])) + 1):
                    self.px(x, y, c)

    def stamp(self, rows, x, y, mapping=None):
        """Blit a hand-authored ASCII pixel map.

        Ellipses and polygons stop being trustworthy below about 12px -
        the rasteriser rounds a wedge into a blob - so faces and other
        small read-critical parts are authored pixel by pixel instead.
        '.' leaves whatever is underneath; `mapping` renames palette
        characters per call (e.g. recolouring an iris).
        """
        x0, y0 = _round(x), _round(y)
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch == TRANSPARENT:
                    continue
                if mapping and ch in mapping:
                    ch = mapping[ch]
                self.px(x0 + i, y0 + j, ch)

    # ---- composition ---------------------------------------------------
    def blit(self, other, dx=0, dy=0, skip=TRANSPARENT):
        for y in range(other.h):
            for x in range(other.w):
                c = other.g[y][x]
                if c != skip:
                    self.px(x + dx, y + dy, c)

    def clone(self):
        c = Canvas(self.w, self.h)
        c.g = [row[:] for row in self.g]
        return c

    def flip_h(self):
        c = Canvas(self.w, self.h)
        c.g = [row[::-1] for row in self.g]
        return c

    def translate(self, dx, dy):
        c = Canvas(self.w, self.h)
        c.blit(self, dx, dy)
        return c

    def replace(self, mapping):
        for y in range(self.h):
            for x in range(self.w):
                ch = self.g[y][x]
                if ch in mapping:
                    self.g[y][x] = mapping[ch]

    # ---- finishing passes ----------------------------------------------
    def outline(self, c='O', diagonal=True):
        """Wrap every opaque cluster in a 1px outline."""
        nb = [(-1, 0), (1, 0), (0, -1), (0, 1)]
        if diagonal:
            nb += [(-1, -1), (1, -1), (-1, 1), (1, 1)]
        add = []
        for y in range(self.h):
            for x in range(self.w):
                if self.g[y][x] != TRANSPARENT:
                    continue
                for dx, dy in nb:
                    n = self.get(x + dx, y + dy)
                    if n != TRANSPARENT and n != c:
                        add.append((x, y))
                        break
        for x, y in add:
            self.px(x, y, c)

    def shade(self, base, dark, light=None, depth=1, outline_c='O'):
        """Darken the lower/right rim of `base` areas, lighten the upper/left."""
        edge_d, edge_l = [], []
        empty = TRANSPARENT + outline_c
        for y in range(self.h):
            for x in range(self.w):
                if self.g[y][x] != base:
                    continue
                if self.get(x, y + depth) in empty or self.get(x + depth, y) in empty:
                    edge_d.append((x, y))
                elif light and (self.get(x, y - depth) in empty or self.get(x - depth, y) in empty):
                    edge_l.append((x, y))
        for x, y in edge_d:
            self.px(x, y, dark)
        for x, y in edge_l:
            self.px(x, y, light)

    def crop_info(self):
        minx, miny, maxx, maxy = self.w, self.h, -1, -1
        for y in range(self.h):
            for x in range(self.w):
                if self.g[y][x] != TRANSPARENT:
                    minx, miny = min(minx, x), min(miny, y)
                    maxx, maxy = max(maxx, x), max(maxy, y)
        return minx, miny, maxx, maxy

    def rows(self):
        return [''.join(r) for r in self.g]


# --------------------------------------------------------------------------
# PNG writing (no external dependency required)
# --------------------------------------------------------------------------
def write_png(path, pixels, w, h):
    """pixels: flat list of (r,g,b,a) tuples, row major."""
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        for x in range(w):
            r, g, b, a = pixels[y * w + x]
            raw += bytes((r, g, b, a))

    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


def canvases_to_sheet(canvases, palette, columns=None):
    """Lay canvases out on one horizontal strip (or grid) and return pixels."""
    if not canvases:
        raise ValueError('no frames')
    cw, ch = canvases[0].w, canvases[0].h
    cols = columns or len(canvases)
    rows = (len(canvases) + cols - 1) // cols
    W, H = cw * cols, ch * rows
    pix = [(0, 0, 0, 0)] * (W * H)
    for idx, cv in enumerate(canvases):
        ox = (idx % cols) * cw
        oy = (idx // cols) * ch
        for y in range(ch):
            for x in range(cw):
                ch_ = cv.g[y][x]
                if ch_ == TRANSPARENT:
                    continue
                col = palette.get(ch_)
                if col is None:
                    raise KeyError('palette missing %r' % ch_)
                if len(col) == 3:
                    col = (col[0], col[1], col[2], 255)
                pix[(oy + y) * W + (ox + x)] = col
    return pix, W, H


def hexc(s, a=255):
    s = s.lstrip('#')
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), a)
