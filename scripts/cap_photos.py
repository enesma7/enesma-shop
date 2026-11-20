"""Cut out SanMar STC26 black photos and embroider the ENESMA marks."""
import os
import numpy as np
from PIL import Image, ImageFilter, ImageFont, ImageDraw

ROOT = "/workspace"
SRC = "/tmp/stc26"
OUT = os.path.join(ROOT, "assets/gear")
FONT = "/usr/share/fonts/truetype/macos/Inter-SemiBold.ttf"
WORD_W = os.path.join(ROOT, "assets/logo/wordmark-white.png")
WORD_B = os.path.join(ROOT, "assets/logo/wordmark-black.png")
EMB_W = os.path.join(ROOT, "assets/logo/emblem-white.png")
EMB_B = os.path.join(ROOT, "assets/logo/emblem-black.png")
LONG = 1700


def knock_white(im):
    rgb = np.array(im.convert("RGB"))
    light = rgb.astype(np.int16).min(axis=2)
    alpha = np.clip((248 - light) * 10, 0, 255).astype(np.uint8)
    return Image.fromarray(np.dstack([rgb, alpha]), "RGBA")


def crop_scale(im):
    bbox = im.getbbox()
    im = im.crop(bbox)
    w, h = im.size
    scale = LONG / max(w, h)
    if scale > 1.01:
        im = im.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    return im


def recolor_white(im):
    arr = np.array(im).astype(np.float32)
    lum = arr[:, :, :3].mean(axis=2, keepdims=True) / 255.0
    fabric = np.clip(0.94 - lum * 0.55, 0.72, 0.98) * 255.0
    arr[:, :, :3] = fabric
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def curve_logo(logo, arch=0.18):
    """Bow the mark so the middle sits higher on the crown."""
    logo = logo.convert("RGBA")
    w, h = logo.size
    src = np.array(logo)
    pad = max(2, int(round(h * arch)))
    out = np.zeros((h + pad, w, 4), np.uint8)
    xs = np.linspace(-1.0, 1.0, w)
    rise = (pad * (1.0 - xs * xs)).astype(np.int32)
    for i in range(w):
        y0 = int(pad - rise[i])
        out[y0:y0 + h, i] = src[:, i]
    return Image.fromarray(out, "RGBA")


def embroider(mark):
    arr = np.array(mark.convert("RGBA"))
    a = arr[:, :, 3]
    under = np.zeros_like(arr)
    under[1:, 1:, 3] = (a[:-1, :-1].astype(np.uint16) * 90 // 255).astype(np.uint8)
    under[:, :, 0] = 12
    under[:, :, 1] = 12
    under[:, :, 2] = 14
    yy, xx = np.indices(a.shape)
    thread = np.where(((xx + yy) % 2) == 0, 255, 214).astype(np.uint8)
    arr[:, :, 3] = (a.astype(np.uint16) * thread // 255).astype(np.uint8)
    base = Image.fromarray(under, "RGBA")
    base.alpha_composite(Image.fromarray(arr, "RGBA"))
    return base.filter(ImageFilter.SMOOTH)


def tracked(text, size, fill):
    font = ImageFont.truetype(FONT, size)
    chars = list(text.upper())
    gap = int(size * 0.12)
    widths = []
    dummy = ImageDraw.Draw(Image.new("RGB", (4, 4)))
    for ch in chars:
        box = dummy.textbbox((0, 0), ch, font=font)
        widths.append(box[2] - box[0])
    total = sum(widths) + gap * max(0, len(chars) - 1)
    height = int(size * 1.35)
    canvas = Image.new("RGBA", (total + 8, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    x = 4
    for ch, wch in zip(chars, widths):
        draw.text((x, height * 0.12), ch, font=font, fill=fill)
        x += wch + gap
    return canvas


def paste(base, mark, xy):
    base.alpha_composite(mark, (int(xy[0]), int(xy[1])))


def decorate(im, white):
    """Return four views: front, side, back, three-quarter. `im` is unused; views are loaded."""
    return im


def build(color_white):
    word = Image.open(WORD_B if color_white else WORD_W).convert("RGBA")
    emblem = Image.open(EMB_B if color_white else EMB_W).convert("RGBA")
    ink = (26, 26, 28, 255) if color_white else (251, 251, 251, 255)
    views = {}
    for key, src in (("front", "straight"), ("side", "right"), ("back", "back"), ("three", "left")):
        im = crop_scale(knock_white(Image.open(os.path.join(SRC, src + ".jpg"))))
        if color_white:
            im = recolor_white(im)
        w, h = im.size
        if key == "front":
            lw = int(w * 0.58)
            ratio = word.height / word.width
            mark = embroider(curve_logo(word.resize((lw, max(1, int(lw * ratio))), Image.Resampling.LANCZOS), 0.20))
            mw, mh = mark.size
            x = (w - mw) // 2
            y = int(h * 0.46) - mh // 2
            paste(im, mark, (x, y))
        elif key == "side":
            label = tracked("AGENT NAME", max(28, int(h * 0.055)), ink)
            label = label.rotate(16, expand=True, resample=Image.Resampling.BICUBIC)
            label = embroider(label)
            x = int(w * 0.30)
            y = int(h * 0.50)
            paste(im, label, (x, y))
        elif key == "back":
            ew = int(w * 0.11)
            eh = int(ew * emblem.height / emblem.width)
            mark = embroider(emblem.resize((ew, eh), Image.Resampling.LANCZOS))
            x = int(w * 0.40) - mark.width // 2
            y = int(h * 0.22)
            paste(im, mark, (x, y))
        views[key] = im
    return views


def main():
    os.makedirs(OUT, exist_ok=True)
    for white, name in ((False, "black"), (True, "white")):
        views = build(white)
        for key, im in views.items():
            path = os.path.join(OUT, "cap-photo-%s-%s.png" % (name, key))
            im.save(path, "PNG", optimize=True)
            print(path, im.size)


if __name__ == "__main__":
    main()
