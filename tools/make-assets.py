#!/usr/bin/env python3
"""Rubrik görselleri: kapak, PWA ikonları. Kullanım: python3 tools/make-assets.py"""
import math, os
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), '..', 'www', 'img')
os.makedirs(OUT, exist_ok=True)

COLORS = {
    'U': (240, 196, 0),    # sarı
    'D': (243, 245, 250),  # beyaz
    'F': (15, 156, 86),    # yeşil
    'B': (18, 89, 195),    # mavi
    'L': (207, 36, 54),    # kırmızı
    'R': (240, 114, 23),   # turuncu
}

def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(len(a)))

def shade(c, f):
    return tuple(max(0, min(255, int(round(v * f)))) for v in c)

def rounded_poly(pts, r, steps=6):
    """Köşeleri yumuşatılmış çokgen noktaları."""
    n = len(pts)
    out = []
    for i in range(n):
        p0 = pts[(i - 1) % n]
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        v1 = (p0[0] - p1[0], p0[1] - p1[1])
        v2 = (p2[0] - p1[0], p2[1] - p1[1])
        l1 = math.hypot(*v1) or 1
        l2 = math.hypot(*v2) or 1
        rr = min(r, l1 / 2.2, l2 / 2.2)
        a = (p1[0] + v1[0] / l1 * rr, p1[1] + v1[1] / l1 * rr)
        b = (p1[0] + v2[0] / l2 * rr, p1[1] + v2[1] / l2 * rr)
        for s in range(steps + 1):
            t = s / steps
            # ikinci derece Bezier: a -> p1 -> b
            x = (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * p1[0] + t * t * b[0]
            y = (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * p1[1] + t * t * b[1]
            out.append((x, y))
    return out

def project(p, size, origin):
    """İzometrik izdüşüm: x sağa, y yukarı, z gözlemciye doğru."""
    x, y, z = p
    sx = (x - z) * math.cos(math.radians(30)) * size
    sy = (x + z) * math.sin(math.radians(30)) * size - y * size
    return (origin[0] + sx, origin[1] + sy)

def hull(points):
    pts = sorted(set(points))
    if len(pts) < 3:
        return pts
    def half(ps):
        out = []
        for p in ps:
            while len(out) >= 2:
                (x1, y1), (x2, y2) = out[-2], out[-1]
                if (x2 - x1) * (p[1] - y1) - (y2 - y1) * (p[0] - x1) <= 0:
                    out.pop()
                else:
                    break
            out.append(p)
        return out
    return half(pts)[:-1] + half(pts[::-1])[:-1]

def draw_cube(img, origin, cell, gap=0.055, glossy=True):
    d = ImageDraw.Draw(img, 'RGBA')
    # gövde: küpün silueti koyu plastik
    corners = [project((x * 1.5, y * 1.5, z * 1.5), cell, origin)
               for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
    body = hull(corners)
    cx = sum(p[0] for p in body) / len(body)
    cy = sum(p[1] for p in body) / len(body)
    body = [(cx + (p[0] - cx) * 1.012, cy + (p[1] - cy) * 1.012) for p in body]
    d.polygon(rounded_poly(body, cell * 0.16, 8), fill=(12, 13, 18, 255))
    faces = [
        # (yüz, sabit eksen, sabit değer, u ekseni, v ekseni, parlaklık)
        ('U', 1,  1.5, 0, 2, 1.0),
        ('F', 2,  1.5, 0, 1, 0.86),
        ('R', 0,  1.5, 2, 1, 0.68),
    ]
    # renk yerleşimi: gerçekçi olsun diye hafif karıştırılmış görünüm
    layout = {
        'U': ['U', 'U', 'F', 'U', 'U', 'U', 'L', 'U', 'U'],
        'F': ['F', 'R', 'F', 'F', 'F', 'F', 'F', 'U', 'F'],
        'R': ['R', 'R', 'D', 'R', 'R', 'R', 'B', 'R', 'R'],
    }
    for face, axis, val, ua, va, bright in faces:
        for i in range(3):
            for j in range(3):
                # yüz üzerinde (i, j) karesinin köşeleri
                def corner(du, dv):
                    p = [0, 0, 0]
                    p[axis] = val
                    a = -1.5 + i + du
                    b = -1.5 + j + dv
                    p[ua] = a
                    p[va] = b
                    if face == 'U':
                        p[2] = -b       # üst yüzde v ekseni z, ters çevir
                        p[0] = a
                    elif face == 'F':
                        p[0] = a
                        p[1] = -b
                    else:
                        p[2] = -a
                        p[1] = -b
                    return tuple(p)

                g = gap
                quad = [
                    project(corner(g, g), cell, origin),
                    project(corner(1 - g, g), cell, origin),
                    project(corner(1 - g, 1 - g), cell, origin),
                    project(corner(g, 1 - g), cell, origin),
                ]
                col = COLORS[layout[face][j * 3 + i]]
                base = shade(col, bright)
                d.polygon(rounded_poly(quad, cell * 0.14), fill=base + (255,))
                if glossy:
                    # üst kenara ince ışık
                    hi = lerp(base, (255, 255, 255), 0.35)
                    top = [quad[0], quad[1],
                           (quad[1][0] + (quad[2][0] - quad[1][0]) * 0.32, quad[1][1] + (quad[2][1] - quad[1][1]) * 0.32),
                           (quad[0][0] + (quad[3][0] - quad[0][0]) * 0.32, quad[0][1] + (quad[3][1] - quad[0][1]) * 0.32)]
                    d.polygon(rounded_poly(top, cell * 0.10), fill=hi + (70,))

def make_cover(w=1024, h=1024, path='cover.png', cell=None, margin=1.0):
    img = Image.new('RGB', (w, h), (7, 8, 14))
    # arka plan ışıkları
    glow = Image.new('RGB', (w, h), (7, 8, 14))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-w * 0.25, -h * 0.3, w * 0.62, h * 0.5], fill=(64, 40, 150))
    gd.ellipse([w * 0.45, h * 0.42, w * 1.25, h * 1.2], fill=(12, 86, 110))
    gd.ellipse([w * 0.1, h * 0.7, w * 0.7, h * 1.25], fill=(90, 20, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(w // 7))
    img = Image.blend(img, glow, 0.62)

    # ince ızgara
    grid = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    gdr = ImageDraw.Draw(grid)
    step = w // 18
    for x in range(0, w, step):
        gdr.line([(x, 0), (x, h)], fill=(255, 255, 255, 12), width=1)
    for y in range(0, h, step):
        gdr.line([(0, y), (w, y)], fill=(255, 255, 255, 12), width=1)
    img = Image.alpha_composite(img.convert('RGBA'), grid).convert('RGB')

    c = cell if cell else int(w * 0.126)
    origin = (w // 2, int(h * 0.52))

    # zemin gölgesi
    sh = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.ellipse([origin[0] - c * 2.6, origin[1] + c * 1.5, origin[0] + c * 2.6, origin[1] + c * 2.9],
               fill=(0, 0, 0, 170))
    sh = sh.filter(ImageFilter.GaussianBlur(c // 3))
    img = Image.alpha_composite(img.convert('RGBA'), sh)

    # küpün arkasındaki halo
    halo = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    hd.ellipse([origin[0] - c * 2.9, origin[1] - c * 2.9, origin[0] + c * 2.9, origin[1] + c * 2.9],
               fill=(150, 130, 255, 60))
    halo = halo.filter(ImageFilter.GaussianBlur(c // 2))
    img = Image.alpha_composite(img, halo)

    draw_cube(img, origin, c)
    img = img.convert('RGB')

    # köşe karartma
    vig = Image.new('L', (w, h), 0)
    vd = ImageDraw.Draw(vig)
    vd.ellipse([-w * 0.2, -h * 0.2, w * 1.2, h * 1.2], fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(w // 8))
    dark = Image.new('RGB', (w, h), (3, 4, 8))
    img = Image.composite(img, dark, vig)

    img.save(os.path.join(OUT, path), quality=92)
    return img

def make_icon(size, path, bg=(7, 8, 14)):
    big = 4
    w = size * big
    img = Image.new('RGBA', (w, w), bg + (255,))
    d = ImageDraw.Draw(img, 'RGBA')
    d.ellipse([-w * 0.2, -w * 0.3, w * 0.8, w * 0.6], fill=(70, 45, 160, 140))
    img = img.filter(ImageFilter.GaussianBlur(w // 9))
    draw_cube(img, (w // 2, int(w * 0.56)), int(w * 0.146))
    img = img.resize((size, size), Image.LANCZOS)
    img.convert('RGB').save(os.path.join(OUT, path))

cover = make_cover(1024, 1024, 'cover.png')
make_cover(1200, 630, 'og.png', cell=104)
make_icon(512, 'icon-512.png')
make_icon(192, 'icon-192.png')
make_icon(180, 'apple-touch-icon.png')
print('görseller üretildi:', sorted(os.listdir(OUT)))
