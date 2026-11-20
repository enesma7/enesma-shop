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


def follow_band(mark, alpha, x0, gap=14):
    """Drop a mark onto the crown's lower edge so it arcs with the sweatband.

    The rear (left) end sits higher, matching the edge as it rises toward the back.
    """
    arr = np.array(mark.convert("RGBA"))
    mh, mw = arr.shape[:2]
    h, w = alpha.shape
    # One baseline for the whole word, so letters move together instead of tearing.
    ink = np.where(arr[:, :, 3] > 12)[0]
    baseline = float(ink.max()) if len(ink) else mh - 1
    dest = np.zeros(mw, np.float32)
    for i in range(mw):
        x = min(w - 1, max(0, x0 + i))
        col = np.where(alpha[:, x] > 40)[0]
        dest[i] = col.max() if len(col) else 0
    dest = np.convolve(dest, np.ones(31) / 31, mode="same")
    shift = dest - gap - baseline
    y0 = int(np.floor(shift.min())) - 2
    y1 = int(np.ceil(shift.max())) + mh + 2
    out_h = y1 - y0
    out = np.zeros((out_h, mw, 4), np.float32)
    rows = np.arange(out_h)
    for i in range(mw):
        # Output row 0 is destination y `y0`, so the ink bottom lands on the band.
        src = rows + y0 - shift[i]
        good = (src >= 0) & (src < mh - 1)
        if not good.any():
            continue
        s0 = np.floor(src).astype(np.int32)
        s1 = np.minimum(s0 + 1, mh - 1)
        t = (src - s0)[:, None]
        sample = (1 - t) * arr[np.clip(s0, 0, mh - 1), i] + t * arr[np.clip(s1, 0, mh - 1), i]
        out[good, i] = sample[good]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA"), int(y0)


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


def crown_word(word, width, far, slope):
    """Wordmark wrapped on the front panels of a three-quarter photo.

    The far end shortens as the panels turn away. The returned point is the
    center of the mark, which the caller puts on the front seam.
    """
    sized = word.resize(
        (width, max(1, int(width * word.height / word.width))),
        Image.Resampling.LANCZOS,
    )
    curved = curve_logo(sized, 0.15)
    big = curved.resize((curved.width * 2, curved.height * 2), Image.Resampling.LANCZOS)
    mark, center = perspective_mark(big, yaw=0.62, half=0.40, far=far, slope=slope)
    mark = mark.resize((max(1, mark.width // 2), max(1, mark.height // 2)), Image.Resampling.LANCZOS)
    center = (center[0] // 2, center[1] // 2)
    return embroider(mark), center


def perspective_mark(mark, yaw=0.55, half=0.50, far="right", slope=0.0):
    """Wrap a mark around the crown.

    Columns toward `far` get shorter and narrower, the way a logo does as
    the front panels turn away. `slope` tips the baseline (image y per px of
    width, so a negative slope lifts the right side). The returned point is
    the screen position of the mark's center, which belongs on the front seam.
    """
    arr = np.array(mark.convert("RGBA"))
    h, w = arr.shape[:2]
    if w < 2 or h < 2:
        return mark, (mark.width // 2, mark.height // 2)
    u = np.linspace(0.0, 1.0, w)
    phi = (u - 0.5) * 2.0 * half
    psi = (phi if far == "right" else -phi) + yaw
    scale = np.clip(np.cos(psi), 0.22, None)
    c0 = float(scale[w // 2])
    rel = scale / c0
    centers = np.cumsum(rel) - rel / 2.0
    centers -= centers[w // 2]
    # Baseline: a gentle tilt, plus the arch already baked into the bitmap.
    baseline = centers * slope
    top = baseline - (h * rel) / 2.0
    bot = baseline + (h * rel) / 2.0
    y_min = float(top.min())
    x_min = float((centers - rel / 2.0).min())
    out_h = int(np.ceil(bot.max() - y_min)) + 2
    out_w = int(np.ceil((centers + rel / 2.0).max() - x_min)) + 2
    # Inverse map. One sample per output pixel, from the source column that
    # lands there, so letters stay whole instead of being clipped.
    xs = np.arange(out_w) + x_min
    src_x = np.interp(xs, centers, np.arange(w))
    src_x = np.clip(src_x, 0, w - 1.001)
    x0 = np.floor(src_x).astype(np.int32)
    x1 = np.minimum(x0 + 1, w - 1)
    tx = (src_x - x0).astype(np.float32)
    rel_s = (1.0 - tx) * rel[x0] + tx * rel[x1]
    base_s = (1.0 - tx) * baseline[x0] + tx * baseline[x1]
    out = np.zeros((out_h, out_w, 4), np.float32)
    ys = np.arange(out_h, dtype=np.float32)[:, None] + y_min
    # Source row for every output pixel.
    sy = (ys - base_s[None, :]) / rel_s[None, :] + (h - 1) / 2.0
    valid = (sy >= 0) & (sy < h - 1) & (rel_s[None, :] > 0.05)
    sy_c = np.clip(sy, 0, h - 1.001)
    y0 = np.floor(sy_c).astype(np.int32)
    y1 = np.minimum(y0 + 1, h - 1)
    ty = (sy_c - y0).astype(np.float32)
    # Bilinear sample, vectorized across rows.
    for x in range(out_w):
        if not valid[:, x].any():
            continue
        c0s = arr[:, x0[x]].astype(np.float32)
        c1s = arr[:, x1[x]].astype(np.float32)
        col = (1.0 - tx[x]) * c0s + tx[x] * c1s
        yy0 = y0[:, x]
        yy1 = y1[:, x]
        tyx = ty[:, x][:, None]
        sample = (1.0 - tyx) * col[yy0] + tyx * col[yy1]
        m = valid[:, x]
        out[m, x] = sample[m]
    center = (int(round(-x_min)), int(round((h - 1) / 2.0 + baseline[w // 2] - y_min)))
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA"), center


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
            # Wearer's left 3/4, bill to the right. The right end turns away
            # around the crown. Center of the mark is the front seam.
            mark, center = crown_word(word, int(w * 0.31), "right", -0.06)
            paste(im, mark, (1035 - center[0], 530 - center[1]))
            # Same small size, bent onto the sweatband. The rear end rises with the edge.
            label = embroider(tracked("AGENT NAME", max(22, int(h * 0.032)), ink))
            x0 = int(w * 0.028)
            label, y0 = follow_band(label, np.array(im)[:, :, 3], x0, gap=28)
            paste(im, label, (x0, y0))
        elif key == "three":
            # The other 3/4, bill to the left. The left end is the far end.
            mark, center = crown_word(word, int(w * 0.31), "left", 0.05)
            paste(im, mark, (668 - center[0], 530 - center[1]))
        elif key == "back":
            # On the center seam, one third of the way from the strap arch up
            # toward the button. About twice the old mark, turned with the panel.
            ew = 400
            eh = int(ew * emblem.height / max(1, emblem.width))
            mark = emblem.resize((ew, eh), Image.Resampling.LANCZOS)
            mark = mark.resize((int(ew * 0.86), eh), Image.Resampling.LANCZOS)
            mark = embroider(mark)
            mark = mark.rotate(-23, expand=True, resample=Image.Resampling.BICUBIC)
            paste(im, mark, (408 - mark.width // 2, 525 - mark.height // 2))
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
