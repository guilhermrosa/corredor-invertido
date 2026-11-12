"""Generate the app icons: the seaside colonnade in perspective, sky and sea, and the red
axolotl seen from behind with its crown of gills.

Run from the repository root:  python3 tools/make_icons.py
Requires Pillow. Placeholder art, in the colours of the current world (js/config.js).
"""
from PIL import Image, ImageDraw

SKY_TOP = (86, 160, 212)
HAZE = (222, 236, 242)
SEA = (52, 128, 178)
SEA_DEEP = (24, 78, 128)
MARBLE = (240, 236, 226)
MARBLE2 = (226, 220, 206)
ROOF = (226, 219, 203)
COLUMN = (250, 249, 245)
SHADE = (192, 186, 174)
FRIEZE = (44, 82, 146)
BODY = (224, 99, 106)
DARK = (143, 42, 58)
GILL = (196, 58, 85)


def lerp(a, b, t):
    return a + (b - a) * t


def mix(c1, c2, t):
    return tuple(int(lerp(a, b, t)) for a, b in zip(c1, c2))


def icon(size, inset):
    s = 4
    W = size * s
    img = Image.new("RGB", (W, W), HAZE)
    d = ImageDraw.Draw(img)
    m = W * inset
    inner = W - 2 * m
    horizon = m + inner * 0.47
    # sky and sea
    for y in range(W):
        if y < horizon:
            t = max(0.0, (y - m) / (horizon - m)) if y > m else 0.0
            d.line([(0, y), (W, y)], fill=mix(SKY_TOP, HAZE, t))
        else:
            t = min(1.0, (y - horizon) / (W - horizon))
            d.line([(0, y), (W, y)], fill=mix(mix(SEA, HAZE, 0.45), SEA_DEEP, t ** 0.7))
    vx, vy = W / 2, horizon  # vanishing point
    # roof and floor of the colonnade, in perspective
    top, bottom = m - inner * 0.05, W - m + inner * 0.05
    half_near, half_far = inner * 0.62, inner * 0.06
    d.polygon([(vx - half_near, top), (vx + half_near, top), (vx + half_far, vy - half_far * 0.9), (vx - half_far, vy - half_far * 0.9)], fill=ROOF)
    d.polygon([(vx - half_near, bottom), (vx + half_near, bottom), (vx + half_far, vy + half_far * 0.9), (vx - half_far, vy + half_far * 0.9)], fill=MARBLE)
    # floor slabs
    for k in range(1, 6):
        t = 1 - (k / 6) ** 1.6
        y = lerp(vy + half_far * 0.9, bottom, t)
        hw = lerp(half_far, half_near, t)
        d.line([(vx - hw, y), (vx + hw, y)], fill=MARBLE2, width=max(1, int(s * size / 160)))
    # painted frieze under the roof edges
    for side in (-1, 1):
        d.polygon([(vx + side * half_near, top), (vx + side * half_near, top + inner * 0.07),
                   (vx + side * half_far, vy - half_far * 0.9 + inner * 0.005), (vx + side * half_far, vy - half_far * 0.9)], fill=FRIEZE)
    # columns, near to far on both sides
    for k in range(4):
        t = 1 - k / 4.2
        hw = lerp(half_far, half_near, t)
        cw = lerp(inner * 0.012, inner * 0.07, t)
        ytop = lerp(vy - half_far * 0.9, top, t) + lerp(inner * 0.004, inner * 0.07, t)
        ybot = lerp(vy + half_far * 0.9, bottom, t)
        for side in (-1, 1):
            x = vx + side * hw
            x0, x1 = (x - cw, x) if side < 0 else (x, x + cw)
            d.rectangle((x0, ytop, x1, ybot), fill=COLUMN)
            d.rectangle((x1 - cw * 0.25, ytop, x1, ybot) if side < 0 else (x0, ytop, x0 + cw * 0.25, ybot), fill=SHADE)
    # the axolotl from behind, on the floor
    cx, foot = W / 2, m + inner * 0.9
    u = inner * 0.36
    def ell(x, y, rx, ry, fill):
        d.ellipse((cx + x * u - rx * u, foot + y * u - ry * u, cx + x * u + rx * u, foot + y * u + ry * u), fill=fill, outline=DARK, width=max(1, int(u * 0.03)))
    d.ellipse((cx - 0.4 * u, foot - 0.05 * u, cx + 0.4 * u, foot + 0.07 * u), fill=mix(MARBLE, (0, 0, 0), 0.25))
    for sx in (-1, 1):
        d.line([(cx + sx * 0.1 * u, foot - 0.3 * u), (cx + sx * 0.17 * u, foot)], fill=DARK, width=int(u * 0.12))
    ell(0, -0.4, 0.23, 0.3, BODY)
    for sx in (-1, 1):  # gills: three fronds a side
        for i, (ax, ay) in enumerate(((0.42, -1.12), (0.5, -0.93), (0.44, -0.74))):
            d.line([(cx + sx * 0.17 * u, foot - (0.85 - i * 0.04) * u), (cx + sx * ax * u, foot + ay * u)], fill=GILL, width=int(u * 0.07))
    ell(0, -0.78, 0.3, 0.2, BODY)
    d.line([(cx, foot - 0.25 * u), (cx + 0.12 * u, foot + 0.1 * u)], fill=BODY, width=int(u * 0.11))
    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    icon(192, 0.0).save("icons/icon-192.png")
    icon(512, 0.0).save("icons/icon-512.png")
    icon(512, 0.12).save("icons/icon-maskable-512.png")
    icon(180, 0.0).save("icons/apple-touch-icon.png")
    print("icons written")
