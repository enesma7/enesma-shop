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


def foreshorten(mark, squeeze=0.72, near="right"):
    """Compress one side of a mark so it sits on a turned panel without tearing the letters."""
    arr = np.array(mark.convert("RGBA"))
    h, w = arr.shape[:2]
    out = np.zeros_like(arr)
    for x in range(w):
        t = x / max(1, w - 1)
        scale = (1 - (1 - squeeze) * t) if near == "left" else (squeeze + (1 - squeeze) * t)
        new_h = max(1, int(round(h * scale)))
        ys = np.linspace(0, h - 1, new_h)
        col = arr[np.clip(ys.astype(np.int32), 0, h - 1), x]
        y0 = (h - new_h) // 2
        out[y0:y0 + new_h, x] = col
    return Image.fromarray(out, "RGBA")


def front_mark(word, width, arch=0.16):
    ratio = word.height / word.width
    sized = word.resize((width, max(1, int(width * ratio))), Image.Resampling.LANCZOS)
    return embroider(curve_logo(sized, arch))


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
            mark = front_mark(word, int(w * 0.58), 0.20)
            paste(im, mark, ((w - mark.width) // 2, int(h * 0.46) - mark.height // 2))
        elif key == "side":
            # Wearer's left 3/4, bill to the right. The front panels are the right
            # portion of the crown, turned away, so the mark is foreshortened.
            mark = foreshorten(front_mark(word, int(w * 0.30), 0.10), 0.82, near="right")
            mark = mark.rotate(8, expand=True, resample=Image.Resampling.BICUBIC)
            paste(im, mark, (int(w * 0.46), int(h * 0.30)))
            label = embroider(tracked("AGENT NAME", max(22, int(h * 0.032)), ink))
            label = label.rotate(-3, expand=True, resample=Image.Resampling.BICUBIC)
            paste(im, label, (int(w * 0.08), int(h * 0.66)))
        elif key == "three":
            # The other 3/4, bill to the left. Front panels face the camera more.
            mark = foreshorten(front_mark(word, int(w * 0.42), 0.12), 0.84, near="left")
            mark = mark.rotate(-6, expand=True, resample=Image.Resampling.BICUBIC)
            paste(im, mark, (int(w * 0.22), int(h * 0.28)))
        elif key == "back":
            # Center seam just above the strap opening on the real rear photo.
            ew = int(w * 0.068)
            eh = int(ew * emblem.height / max(1, emblem.width))
            mark = embroider(emblem.resize((ew, eh), Image.Resampling.LANCZOS))
            paste(im, mark, (int(w * 0.25) - mark.width // 2, int(h * 0.58) - mark.height // 2))
        views[key] = im
    return views


def fabric_tile(src, white):
    im = Image.open(src).convert("RGB")
    # A clean patch of the black mesh, away from seams and the bill.
    patch = im.crop((620, 360, 980, 720)).resize((512, 512), Image.Resampling.LANCZOS)
    arr = np.array(patch).astype(np.float32)
    if white:
        # Keep the mesh grain, lift it to a white cap.
        lum = arr.mean(axis=2, keepdims=True) / 255.0
        arr = np.clip(214 + lum * 28, 0, 255)
        arr = np.repeat(arr, 3, axis=2)
    else:
        # Hold the cloth in the same black the SanMar photo uses.
        arr = np.clip(arr * 0.92, 0, 255)
    tile = Image.fromarray(arr.astype(np.uint8), "RGB").convert("RGBA")
    return tile


def paint_seams(draw, w, h):
    # Six panel seams in the same u space as the mesh.
    # u = ((ang + pi) / (2*pi) + 0.25) % 1, ang 0 at the front.
    seams = (0.75, 0.917, 0.583, 0.083, 0.417, 0.25)
    for u in seams:
        x = int(round(u * w))
        draw.line([(x, 0), (x, h)], fill=(18, 18, 20, 150), width=3)


def build_atlases():
    side = os.path.join(OUT, "cap-photo-black-side.png")
    os.makedirs(OUT, exist_ok=True)
    W, H = 2048, 1024
    for white, name, word_path, emb_path, ink in (
        (False, "black", WORD_W, EMB_W, (251, 251, 251, 255)),
        (True, "white", WORD_B, EMB_B, (20, 20, 22, 255)),
    ):
        tile = fabric_tile(side, white)
        atlas = Image.new("RGBA", (W, H), (0, 0, 0, 255))
        for y in range(0, H, 512):
            for x in range(0, W, 512):
                atlas.paste(tile, (x, y))
        draw = ImageDraw.Draw(atlas, "RGBA")
        # Sweatband, slightly deeper than the crown cloth.
        band_h = int(H * 0.055)
        shade = (28, 28, 30, 180) if not white else (186, 186, 188, 150)
        draw.rectangle([0, H - band_h, W, H], fill=shade)
        paint_seams(draw, W, H)
        # Eyelets on the side panels, mid crown.
        for u in (0.50, 0.00):
            cx, cy = int(u * W) % W, int(H * (1 - 0.62))
            r = 11
            hole = (12, 12, 14, 255) if not white else (70, 70, 72, 255)
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=hole)

        word = Image.open(word_path).convert("RGBA")
        # Both front panels. Front center is u=0.75.
        lw = int(W * 0.24)
        ratio = word.height / word.width
        mark = embroider(curve_logo(word.resize((lw, max(1, int(lw * ratio))), Image.Resampling.LANCZOS), 0.16))
        paste(atlas, mark, (int(W * 0.75 - mark.width / 2), int(H * (1 - 0.64) - mark.height / 2)))

        # Rear of the wearer's left side panel, just above the sweatband.
        # That panel is u 0.417 (rear seam) to 0.583. Keep the name short and
        # against the rear seam so it does not run toward the bill.
        label = embroider(tracked("AGENT NAME", 20, ink))
        paste(atlas, label, (int(W * 0.438), int(H * (1 - 0.09) - label.height / 2)))
        print("name", name, label.size)

        emblem = Image.open(emb_path).convert("RGBA")
        ew = int(W * 0.038)
        eh = int(ew * emblem.height / emblem.width)
        emb = embroider(emblem.resize((ew, eh), Image.Resampling.LANCZOS))
        # Center back seam is u=0.25, directly above the strap opening.
        paste(atlas, emb, (int(W * 0.25 - emb.width / 2), int(H * (1 - 0.20) - emb.height / 2)))

        path = os.path.join(OUT, "cap-atlas-%s.png" % name)
        atlas.convert("RGB").save(path, "PNG", optimize=True)
        print(path, atlas.size)

        bill = Image.new("RGBA", (1024, 512), (0, 0, 0, 255))
        for y in range(0, 512, 512):
            bill.paste(tile.resize((1024, 512), Image.Resampling.LANCZOS), (0, y))
        bdraw = ImageDraw.Draw(bill, "RGBA")
        stitch = (24, 24, 26, 200) if not white else (170, 170, 172, 180)
        for i, yy in enumerate((70, 150, 250, 360)):
            bdraw.arc([40, yy - 30, 980, yy + 80], 200, 340, fill=stitch, width=3)
        bpath = os.path.join(OUT, "cap-bill-%s.png" % name)
        bill.convert("RGB").save(bpath, "PNG", optimize=True)
        print(bpath, bill.size)


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
