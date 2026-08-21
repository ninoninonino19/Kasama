#!/usr/bin/env python3
"""
Generates Kasama's whole icon set from one mark.

The mark is the app's own metaphor rather than a borrowed one: a paper note
pinned to the board with a strip of washi tape across its top-left corner —
the same device `src/components/ui/Tape.tsx` draws on every card. Three values
(moss ground, paper note, mustard tape) and no lettering, so it survives being
shrunk to 48px next to every other app whose icon is a letter in a square.

Run:  python3 tools/generate-icons.py
Needs: Pillow (pip install Pillow). Nothing else in the app depends on it —
this writes PNGs into assets/ and is not part of the build.
"""

from __future__ import annotations

import os

from PIL import Image, ImageDraw, ImageFilter

# Straight out of src/lib/theme.ts. If the palette moves, it moves here too.
MOSS = (47, 61, 44)
PAPER = (252, 251, 246)
MUSTARD = (232, 185, 74)
CANVAS = (242, 244, 234)
BEZEL = (27, 33, 26)

# Everything is drawn this many times too big and then resized down, which is
# where the anti-aliasing comes from — Pillow's polygon fill has no AA of its own.
SS = 4

ASSETS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets')


def rounded_rect(draw: ImageDraw.ImageDraw, box, radius: float, fill) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def tape_polygon(centre, half_length: float, half_width: float, teeth: int = 8):
    """
    The tape as a polygon running up-and-right at 45°, with both ends torn
    rather than guillotined. A straight-cut strip reads as a coloured bar; the
    serration is most of what makes it read as tape.
    """
    cx, cy = centre
    # Direction along the strip (up and to the right), and its normal.
    dx, dy = (2 ** -0.5), -(2 ** -0.5)
    nx, ny = (2 ** -0.5), (2 ** -0.5)

    def point(along: float, across: float):
        return (cx + dx * along + nx * across, cy + dy * along + ny * across)

    amplitude = half_width * 0.07
    points = []

    # Up the leading edge, across the torn top end, back down the other edge,
    # then across the torn bottom end.
    points.append(point(-half_length, -half_width))
    for index in range(teeth + 1):
        across = -half_width + (2 * half_width) * index / teeth
        jag = amplitude if index % 2 else -amplitude
        points.append(point(half_length + jag, across))
    points.append(point(-half_length, half_width))
    for index in range(teeth + 1):
        across = half_width - (2 * half_width) * index / teeth
        jag = -amplitude if index % 2 else amplitude
        points.append(point(-half_length + jag, across))

    return points


def draw_mark(
    size: int,
    *,
    paper=PAPER,
    tape=MUSTARD,
    scale: float = 1.0,
    shadow: bool = True,
    rotate: float = -4.0,
    mono: bool = False,
) -> Image.Image:
    """
    The note-and-tape mark on a transparent ground.

    `scale` shrinks the note within the canvas — Android's adaptive icons only
    guarantee the middle 61% of the frame is visible, so the foreground layer
    asks for a smaller note than the iOS icon does.
    """
    S = size * SS
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))

    # Sized for the tightest mask it has to survive: iOS rounds the icon into
    # a squircle, so art that runs to the edge loses its corners. Everything
    # below is expressed against the note's own width, so `scale` moves the
    # whole mark rather than sliding its parts apart.
    note_w = 0.56 * S * scale
    note_h = 0.60 * S * scale
    radius = 0.055 * note_w
    cx, cy = S / 2, S * 0.505
    box = (cx - note_w / 2, cy - note_h / 2, cx + note_w / 2, cy + note_h / 2)

    if shadow:
        # Warm rather than neutral, and offset downward — the same reasoning as
        # NoteCard's shadow: a black drop against the moss ground reads as a
        # hole rather than lift.
        blur = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        drop = 0.030 * note_w
        rounded_rect(
            ImageDraw.Draw(blur),
            (box[0], box[1] + drop, box[2], box[3] + drop),
            radius,
            BEZEL + (105,),
        )
        layer = Image.alpha_composite(layer, blur.filter(ImageFilter.GaussianBlur(0.030 * note_w)))

    note = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    rounded_rect(ImageDraw.Draw(note), box, radius, paper + (255,))
    layer = Image.alpha_composite(layer, note)

    # The tape crosses the note's top-left corner, overhanging both edges the
    # way a real strip does. Tape.tsx overhangs the card for the same reason.
    corner = (box[0], box[1])
    inset = 0.13 * note_w
    centre = (corner[0] + inset, corner[1] + inset)
    half_width = 0.085 * note_w
    # Long enough to clear both edges — the strip crosses each of them at
    # `inset * sqrt(2)` from its centre, so anything past that is overhang.
    half_length = 0.285 * note_w
    polygon = tape_polygon(centre, half_length, half_width)

    strip = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    if mono:
        # A themed or status-bar icon is one flat colour, so the tape can only
        # be told from the note by a gap. Punch a slightly wider strip out of
        # the note first, then lay the tape inside it.
        gap = tape_polygon(centre, half_length + 0.055 * note_w, half_width + 0.055 * note_w)
        cut = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(cut).polygon(gap, fill=(0, 0, 0, 255))
        layer = Image.composite(Image.new('RGBA', (S, S), (0, 0, 0, 0)), layer, cut.split()[3])
        ImageDraw.Draw(strip).polygon(polygon, fill=paper + (255,))
    else:
        # Washi is translucent — you can see the paper grain through it.
        ImageDraw.Draw(strip).polygon(polygon, fill=tape + (238,))
    layer = Image.alpha_composite(layer, strip)

    if rotate:
        layer = layer.rotate(rotate, resample=Image.BICUBIC, center=(S / 2, S / 2))

    return layer.resize((size, size), Image.LANCZOS)


def write(image: Image.Image, name: str) -> None:
    path = os.path.join(ASSETS, name)
    image.save(path)
    print(f'  {name}  {image.size[0]}×{image.size[1]}')


def main() -> None:
    print('Writing Kasama icons into assets/')

    # iOS / store icon. Opaque and full bleed: the platform applies its own
    # mask, and a transparent icon is rejected outright.
    icon = Image.new('RGBA', (1024, 1024), MOSS + (255,))
    icon = Image.alpha_composite(icon, draw_mark(1024))
    write(icon.convert('RGB'), 'icon.png')

    # Android adaptive icon, in three layers.
    write(Image.new('RGBA', (512, 512), MOSS + (255,)), 'android-icon-background.png')
    # Android only guarantees the middle 66 of 108 units survives its masks,
    # so the foreground note is drawn small enough that the circle, the
    # squircle and the teardrop all keep the whole of it. The tape overhang is
    # allowed past that line: losing a corner of it costs nothing.
    write(draw_mark(512, scale=0.75), 'android-icon-foreground.png')
    write(draw_mark(432, scale=0.73, shadow=False, mono=True), 'android-icon-monochrome.png')

    # Splash. The tile is drawn into the image rather than left to the splash's
    # own background colour, so the handover from home-screen icon to splash is
    # the same object twice instead of two different pictures.
    splash = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    tile = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    rounded_rect(ImageDraw.Draw(tile), (0, 0, 1023, 1023), 232, MOSS + (255,))
    splash = Image.alpha_composite(splash, tile)
    splash = Image.alpha_composite(splash, draw_mark(1024))
    write(splash, 'splash-icon.png')

    # Web favicon. Full bleed again — browsers draw it at 16px in a tab strip,
    # where a rounded corner is a wasted pixel.
    favicon = Image.new('RGBA', (256, 256), MOSS + (255,))
    favicon = Image.alpha_composite(favicon, draw_mark(256))
    write(favicon.convert('RGB'), 'favicon.png')

    # Android notification icon. The system throws away every colour and keeps
    # the alpha, so this has to be one flat shape on transparent — feed it the
    # full-colour icon and every notification arrives as a white blob.
    write(draw_mark(96, scale=1.30, shadow=False, mono=True, rotate=0), 'notification-icon.png')


if __name__ == '__main__':
    main()
