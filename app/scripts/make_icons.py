"""Generates the app icons in ../assets. Run: python3 scripts/make_icons.py (needs Pillow)."""
import math
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets')
BG_TOP = (14, 22, 18)
BG_BOTTOM = (0, 0, 0)
EMERALD = (16, 185, 129, 255)
BLACK = (0, 0, 0, 255)
S = 4  # supersampling


def heart_points(cx, cy, size, steps=400):
    pts = []
    for i in range(steps):
        t = 2 * math.pi * i / steps
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + x * size / 34, cy - y * size / 34))
    return pts


def draw_symbol(d, cx, cy, size, heart_color, line_color):
    d.polygon(heart_points(cx, cy, size), fill=heart_color)
    w = size
    # pulse line across the heart
    pts = [
        (cx - w * 0.42, cy + w * 0.02),
        (cx - w * 0.16, cy + w * 0.02),
        (cx - w * 0.07, cy - w * 0.16),
        (cx + w * 0.03, cy + w * 0.2),
        (cx + w * 0.12, cy - w * 0.06),
        (cx + w * 0.18, cy + w * 0.02),
        (cx + w * 0.42, cy + w * 0.02),
    ]
    d.line(pts, fill=line_color, width=int(w * 0.055), joint='curve')
    r = int(w * 0.0275)
    for p in (pts[0], pts[-1]):
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=line_color)


def gradient(size):
    img = Image.new('RGBA', (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        f = y / (size - 1)
        c = tuple(int(BG_TOP[i] + (BG_BOTTOM[i] - BG_TOP[i]) * f) for i in range(3))
        d.line([(0, y), (size, y)], fill=c + (255,))
    return img


def save(img, name, size):
    img.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name))


def main():
    n = 1024 * S
    # Full icon (square, Android masks it)
    icon = gradient(n)
    draw_symbol(ImageDraw.Draw(icon), n / 2, n / 2 + n * 0.02, n * 0.62, EMERALD, BLACK)
    save(icon, 'icon.png', 1024)

    # Adaptive foreground: transparent, symbol inside the 66% safe zone
    fg = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    draw_symbol(ImageDraw.Draw(fg), n / 2, n / 2 + n * 0.015, n * 0.42, EMERALD, BLACK)
    save(fg, 'adaptive-icon.png', 1024)

    # Splash: emerald symbol on transparent (background color set in config)
    sp = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    draw_symbol(ImageDraw.Draw(sp), n / 2, n / 2, n * 0.7, EMERALD, BLACK)
    save(sp, 'splash-icon.png', 1024)

    # Notification icon: white silhouette only, transparent background
    m = 96 * S * 4
    ni = Image.new('RGBA', (m, m), (0, 0, 0, 0))
    nd = ImageDraw.Draw(ni)
    draw_symbol(nd, m / 2, m / 2 + m * 0.02, m * 0.9, (255, 255, 255, 255), (0, 0, 0, 0))
    save(ni, 'notification-icon.png', 96)

    fav = icon.resize((48, 48), Image.LANCZOS)
    fav.save(os.path.join(OUT, 'favicon.png'))


if __name__ == '__main__':
    main()
