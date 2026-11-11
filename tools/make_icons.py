"""Generate the placeholder app icons (tunnel in perspective, player block, coral obstacle).

Run from the repository root:  python3 tools/make_icons.py
Requires Pillow. Replace with the real art when the character and world are designed.
"""
from PIL import Image, ImageDraw

BG = (17, 20, 28)
FLOOR = (242, 165, 65)
CEIL = (60, 198, 192)
WALL = (34, 40, 56)
HAZ = (255, 93, 93)
INK = (238, 241, 246)


def lerp(a, b, t):
    return a + (b - a) * t


def tunnel(size, inset):
    """Draw the icon at `size` px; `inset` is the fraction kept free around the art (maskable safe zone)."""
    s = 4  # supersample for smooth edges
    W = size * s
    img = Image.new("RGB", (W, W), BG)
    d = ImageDraw.Draw(img)
    m = W * inset
    near = (m, m, W - m, W - m)              # outer rectangle of the tunnel mouth
    cx, cy = W / 2, W / 2
    fw = (W - 2 * m) * 0.16                  # far opening half-size
    far = (cx - fw, cy - fw * 0.8, cx + fw, cy + fw * 0.8)
    # walls
    d.polygon([(near[0], near[1]), (far[0], far[1]), (far[0], far[3]), (near[0], near[3])], fill=WALL)
    d.polygon([(near[2], near[1]), (far[2], far[1]), (far[2], far[3]), (near[2], near[3])], fill=WALL)
    # ceiling and floor
    d.polygon([(near[0], near[1]), (near[2], near[1]), (far[2], far[1]), (far[0], far[1])], fill=CEIL)
    d.polygon([(near[0], near[3]), (near[2], near[3]), (far[2], far[3]), (far[0], far[3])], fill=FLOOR)
    # far opening
    d.rectangle(far, fill=BG)
    # coral block hanging from the ceiling, mid-distance
    t = 0.55
    bx0 = lerp(near[0], far[0], t)
    bx1 = lerp(near[2], far[2], t)
    by0 = lerp(near[1], far[1], t)
    bh = (lerp(near[3], far[3], t) - by0) * 0.42
    d.rectangle((bx0, by0, bx1, by0 + bh), fill=HAZ)
    # player block on the floor, near
    pw = (W - 2 * m) * 0.13
    ph = (W - 2 * m) * 0.2
    py1 = near[3] - (W - 2 * m) * 0.06
    d.rounded_rectangle((cx - pw, py1 - ph, cx + pw, py1), radius=pw * 0.25, fill=INK)
    d.rectangle((cx - pw, py1 - ph * 0.14, cx + pw, py1), fill=FLOOR)
    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    tunnel(192, 0.08).save("icons/icon-192.png")
    tunnel(512, 0.08).save("icons/icon-512.png")
    tunnel(512, 0.2).save("icons/icon-maskable-512.png")
    tunnel(180, 0.08).save("icons/apple-touch-icon.png")
    print("icons written")
