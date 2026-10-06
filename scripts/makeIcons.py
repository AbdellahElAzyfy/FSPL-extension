"""Generates icons/icon{16,48,128}.png: a player card as it looks on the
site's Pick Team pitch (shirt, white name plate, five fixture chips in the
FDR colours) on a striped pitch tile. Run: python scripts/makeIcons.py

The shirt is the site's navy and lime, which matches no club's kit.

Chrome Web Store guidance: 128px icon with ~96px of artwork and transparent
padding. Smaller sizes use less padding so the card stays legible.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

PITCH = (0, 168, 82)
PITCH_DARK = (0, 150, 72)
SHIRT = (34, 44, 64)  # site navy, lifted a little so it reads as fabric
SHIRT_SHADE = (19, 25, 36)
TRIM = (183, 244, 0)  # site lime
PLATE = (255, 255, 255)
TEXT = (55, 60, 70)
FDR = {1: (20, 108, 58), 2: (63, 192, 106), 3: (196, 199, 204), 4: (255, 143, 163), 5: (92, 10, 20)}
FIXTURES = [2, 1, 3, 5, 4]  # a plausible run of fixtures, not a sorted legend
SCALE = 8  # draw large, downsample for smooth edges

OUT = Path(__file__).resolve().parent.parent / "icons"


def draw(size: int, padding: int, small: bool) -> Image.Image:
    s = size * SCALE
    pad = padding * SCALE
    tile = s - 2 * pad

    def x(f: float) -> float:
        return pad + tile * f

    def y(f: float) -> float:
        return pad + tile * f

    # Pitch tile with mowing stripes, clipped to a rounded square.
    bg = Image.new("RGBA", (s, s), PITCH)
    bd = ImageDraw.Draw(bg)
    stripes = 6
    for i in range(1, stripes, 2):
        bd.rectangle([0, y(i / stripes), s, y((i + 1) / stripes)], fill=PITCH_DARK)
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle([pad, pad, s - pad, s - pad], radius=tile * 0.22, fill=255)
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    img.paste(bg, (0, 0), mask)

    # Shirt, with a soft drop shadow so it lifts off the pitch.
    top, hem = (0.08, 0.50) if not small else (0.04, 0.50)
    h = hem - top
    shirt = [
        (x(0.40), y(top)),               # left collar
        (x(0.25), y(top + h * 0.06)),    # left shoulder
        (x(0.12), y(top + h * 0.38)),    # left sleeve end (outer)
        (x(0.23), y(top + h * 0.50)),    # left sleeve end (inner)
        (x(0.30), y(top + h * 0.36)),    # left armpit
        (x(0.30), y(hem)),               # left hem
        (x(0.70), y(hem)),               # right hem
        (x(0.70), y(top + h * 0.36)),    # right armpit
        (x(0.77), y(top + h * 0.50)),    # right sleeve end (inner)
        (x(0.88), y(top + h * 0.38)),    # right sleeve end (outer)
        (x(0.75), y(top + h * 0.06)),    # right shoulder
        (x(0.60), y(top)),               # right collar
    ]
    shadow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    off = tile * 0.015
    ImageDraw.Draw(shadow).polygon([(a + off, b + off * 1.5) for a, b in shirt], fill=(0, 0, 0, 90))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(tile * 0.02)))

    d = ImageDraw.Draw(img)
    d.polygon(shirt, fill=SHIRT)
    # Shading down the right side of the body, like the site's shirt renders.
    d.polygon([(x(0.60), y(top + h * 0.15)), (x(0.70), y(top + h * 0.36)),
               (x(0.70), y(hem)), (x(0.62), y(hem))], fill=SHIRT_SHADE)
    # Collar and sleeve cuffs in lime.
    d.polygon([(x(0.40), y(top)), (x(0.60), y(top)), (x(0.50), y(top + h * 0.20))], fill=TRIM)
    cw = max(1, int(tile * 0.035))
    d.line([(x(0.125), y(top + h * 0.37)), (x(0.225), y(top + h * 0.485))], fill=TRIM, width=cw)
    d.line([(x(0.875), y(top + h * 0.37)), (x(0.775), y(top + h * 0.485))], fill=TRIM, width=cw)

    # White name plate with a grey "name" line.
    plate_top, plate_bottom = (0.54, 0.69) if not small else (0.53, 0.70)
    d.rectangle([x(0.12), y(plate_top), x(0.88), y(plate_bottom)], fill=PLATE)
    if not small:
        mid = (plate_top + plate_bottom) / 2
        d.rounded_rectangle([x(0.30), y(mid - 0.02), x(0.70), y(mid + 0.02)], radius=tile * 0.02, fill=TEXT)

    # Five fixture chips under the plate, like the in-page strip, on a navy
    # strip so the dark green and dark red chips don't sink into the pitch.
    left, right = x(0.12), x(0.88)
    chip_top, chip_bottom = (0.73, 0.88) if not small else (0.74, 0.94)
    rim = tile * (0.025 if not small else 0.0)
    d.rectangle([left - rim, y(chip_top) - rim, right + rim, y(chip_bottom) + rim], fill=SHIRT_SHADE)
    gap = (right - left) * (0.04 if not small else 0.0)
    chip_w = (right - left - 4 * gap) / 5
    for i, fdr in enumerate(FIXTURES):
        x0 = left + i * (chip_w + gap)
        box = [x0, y(chip_top), x0 + chip_w, y(chip_bottom)]
        d.rectangle(box, fill=FDR[fdr])

    return img.resize((size, size), Image.LANCZOS)


for size, padding in [(128, 16), (48, 3), (16, 0)]:
    draw(size, padding, small=size < 32).save(OUT / f"icon{size}.png")
    print(f"wrote icons/icon{size}.png")
