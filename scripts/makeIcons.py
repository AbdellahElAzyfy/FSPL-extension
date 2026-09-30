"""Generates icons/icon{16,48,128}.png: five rising bars in the FDR colours
(easy -> hard) on a dark rounded tile. Run: python scripts/makeIcons.py

Chrome Web Store guidance: 128px icon with ~96px of artwork and transparent
padding. Smaller sizes use less padding so the bars stay legible.
"""
from pathlib import Path

from PIL import Image, ImageDraw

BG = (19, 25, 36)  # site navy
ACCENT = (183, 244, 0)  # site lime
FDR = [(20, 108, 58), (63, 192, 106), (196, 199, 204), (255, 143, 163), (92, 10, 20)]
SCALE = 8  # draw large, downsample for smooth edges

OUT = Path(__file__).resolve().parent.parent / "icons"


def draw(size: int, padding: int) -> Image.Image:
    s = size * SCALE
    pad = padding * SCALE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    tile = s - 2 * pad
    d.rounded_rectangle([pad, pad, s - pad, s - pad], radius=tile * 0.22, fill=BG)

    # Five bars, heights rising left to right, sitting on a lime baseline.
    inner = tile * 0.16
    left, right = pad + inner, s - pad - inner
    bottom = s - pad - inner * 1.15
    top = pad + inner * 0.95
    gap = (right - left) * 0.06
    bar_w = (right - left - 4 * gap) / 5
    for i, colour in enumerate(FDR):
        h = (bottom - top) * (0.36 + 0.16 * i)
        x0 = left + i * (bar_w + gap)
        d.rounded_rectangle([x0, bottom - h, x0 + bar_w, bottom], radius=bar_w * 0.22, fill=colour)
    # Very dark red (5) would vanish on navy, so give every bar a thin light edge.
    for i in range(5):
        h = (bottom - top) * (0.36 + 0.16 * i)
        x0 = left + i * (bar_w + gap)
        d.rounded_rectangle([x0, bottom - h, x0 + bar_w, bottom], radius=bar_w * 0.22,
                            outline=(255, 255, 255, 70), width=max(1, int(s * 0.008)))
    base_h = tile * 0.035
    d.rounded_rectangle([left, bottom + base_h, right, bottom + 2.4 * base_h], radius=base_h, fill=ACCENT)

    return img.resize((size, size), Image.LANCZOS)


for size, padding in [(128, 16), (48, 3), (16, 0)]:
    draw(size, padding).save(OUT / f"icon{size}.png")
    print(f"wrote icons/icon{size}.png")
