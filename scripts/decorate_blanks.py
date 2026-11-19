"""Place ENESMA decoration on the Company Casuals blanks that match the shop styles.

Styles, from the catalog sheet collar tag and Company Casuals:
  Tee        Gildan 8000
  Polo       Sport-Tek ST640
  Quarter-Zip Sport-Tek ST581
  Cap        Sport-Tek STC26
"""
import os
import numpy as np
from PIL import Image, ImageFilter, ImageDraw, ImageFont

ROOT = "/workspace"
REF = "/tmp/refs"
OUT = os.path.join(ROOT, "assets", "gear")
RENDERS = os.path.join(ROOT, "assets", "renders")
os.makedirs(OUT, exist_ok=True)

WORD_W = Image.open(os.path.join(ROOT, "assets/logo/wordmark-white.png")).convert("RGBA")
WORD_B = Image.open(os.path.join(ROOT, "assets/logo/wordmark-black.png")).convert("RGBA")
EMB_W = Image.open(os.path.join(ROOT, "assets/logo/emblem-white.png")).convert("RGBA")
EMB_B = Image.open(os.path.join(ROOT, "assets/logo/emblem-black.png")).convert("RGBA")
FONT = "/usr/share/fonts/truetype/macos/Inter-SemiBold.ttf"


def bbox(im, thresh=236):
    g = im.convert("L")
    mask = g.point(lambda p: 255 if p < thresh else 0)
    box = mask.getbbox()
    return box


def paste_center(base, mark, cx, cy, width):
    mark = mark.copy()
    h = max(1, int(width * mark.height / mark.width))
    mark = mark.resize((int(width), h), Image.Resampling.LANCZOS)
    base.alpha_composite(mark, (int(cx - width / 2), int(cy - h / 2)))


def name_mark(text, fill, width):
    # small sleeve / side name
    font = ImageFont.truetype(FONT, 64)
    tmp = Image.new("RGBA", (10, 10))
    draw = ImageDraw.Draw(tmp)
    tw = draw.textlength(text, font=font)
    im = Image.new("RGBA", (int(tw) + 8, 80), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((4, 4), text, font=font, fill=fill)
    h = max(1, int(width * im.height / im.width))
    return im.resize((int(width), h), Image.Resampling.LANCZOS)


def cut_white(im, thresh=248):
    rgb = np.array(im.convert("RGB"))
    white = (rgb[:, :, 0] >= thresh) & (rgb[:, :, 1] >= thresh) & (rgb[:, :, 2] >= thresh)
    h, w = white.shape
    seen = np.zeros_like(white, dtype=bool)
    stack = [(0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)]
    while stack:
        y, x = stack.pop()
        if y < 0 or x < 0 or y >= h or x >= w or seen[y, x] or not white[y, x]:
            continue
        seen[y, x] = True
        stack.extend(((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)))
    rgba = im.convert("RGBA")
    alpha = np.array(rgba.split()[-1])
    alpha[seen] = 0
    rgba.putalpha(Image.fromarray(alpha))
    return rgba


def studio(cut, size=(1600, 2000)):
    canvas = Image.new("RGB", size, (247, 246, 243))
    # fit the garment
    margin = 0.08
    max_w = int(size[0] * (1 - margin * 2))
    max_h = int(size[1] * (1 - margin * 2))
    scale = min(max_w / cut.width, max_h / cut.height)
    w, h = int(cut.width * scale), int(cut.height * scale)
    cloth = cut.resize((w, h), Image.Resampling.LANCZOS)
    # soft shadow from the alpha
    shadow = Image.new("RGBA", size, (0, 0, 0, 0))
    sh = cloth.split()[-1].filter(ImageFilter.GaussianBlur(28))
    sh_img = Image.new("RGBA", cloth.size, (0, 0, 7, 70))
    sh_img.putalpha(sh)
    x = (size[0] - w) // 2
    y = (size[1] - h) // 2 + int(size[1] * 0.02)
    shadow.alpha_composite(sh_img, (x + 8, y + 18))
    canvas.paste(shadow, (0, 0), shadow)
    canvas.paste(cloth, (x, y), cloth)
    return canvas


def save_pair(cut, slug, color, view):
    # transparent source for the closet
    cut.save(os.path.join(OUT, f"{slug}-{color}-{view}.png"))
    shot = studio(cut, (1600, 2000))
    base = os.path.join(RENDERS, f"{slug}-{color}-{view}")
    shot.save(base + ".jpg", quality=86, optimize=True)
    shot.save(base + ".webp", quality=82, method=4)
    thumb = shot.copy()
    thumb.thumbnail((720, 720))
    thumb.save(base + "-thumb.webp", quality=80, method=4)


def decorate_tee(color):
    front = Image.open(f"{REF}/tee-{color}-3.jpg").convert("RGBA")
    back = Image.open(f"{REF}/tee-{color}-4.jpg").convert("RGBA")
    word = WORD_W if color == "black" else WORD_B
    box = bbox(front)
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0, y1 - y0
    paste_center(front, word, x0 + bw * 0.50, y0 + bh * 0.36, bw * 0.46)
    save_pair(cut_white(front), "t-shirt", color, "front")
    save_pair(cut_white(front), "t-shirt", color, "hero")
    save_pair(cut_white(back), "t-shirt", color, "back")
    print("tee", color, box)


def shirt_mask_from_black_polo():
    im = Image.open(f"{REF}/polo-black-0.jpg").convert("RGB")
    # keep the black shirt, drop skin, jeans, and white background
    px = im.load()
    w, h = im.size
    mask = Image.new("L", (w, h), 0)
    mp = mask.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if r < 55 and g < 55 and b < 55 and max(r, g, b) - min(r, g, b) < 18:
                mp[x, y] = 255
    return mask.filter(ImageFilter.MaxFilter(3))


POLO_FRONT = {
    "black": f"{REF}/st550-black-1200W-9060-Black-12-ST550BlackFormFront8.jpg",
    "white": f"{REF}/st550-white-1200W-9060-White-12-ST550WhiteFormFront8.jpg",
}
POLO_BACK = {
    "black": f"{REF}/st550-black-1200W-9060-Black-13-ST550BlackFormBack8.jpg",
    "white": f"{REF}/st550-white-1200W-9060-White-13-ST550WhiteFormBack8.jpg",
}


def tonal_emblem(color):
    src = EMB_W if color == "black" else EMB_B
    im = src.copy()
    px = im.load()
    # A slightly lighter or darker mark, not a bright print.
    tone = (150, 150, 154, 210) if color == "black" else (90, 90, 94, 170)
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            px[x, y] = (tone[0], tone[1], tone[2], int(a * tone[3] / 255))
    return im


def decorate_polo(color):
    im = Image.open(POLO_FRONT[color]).convert("RGBA")
    back = Image.open(POLO_BACK[color]).convert("RGBA")
    word = WORD_W if color == "black" else WORD_B
    box = bbox(im)
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0, y1 - y0
    # Wearer's left chest, and the name on that same sleeve.
    paste_center(im, word, x0 + bw * 0.66, y0 + bh * 0.30, bw * 0.18)
    fill = (247, 247, 245, 255) if color == "black" else (20, 20, 22, 255)
    mark = name_mark("AGENT NAME", fill, bw * 0.16)
    im.alpha_composite(mark, (int(x0 + bw * 0.70), int(y0 + bh * 0.40)))
    front_cut = cut_white(im)
    back_cut = cut_white(back)
    save_pair(front_cut, "polo", color, "front")
    save_pair(front_cut, "polo", color, "hero")
    save_pair(back_cut, "polo", color, "back")
    emblem_back = back_cut.copy()
    paste_center(emblem_back, tonal_emblem(color), (x0 + x1) / 2, y0 + bh * 0.16, bw * 0.12)
    emblem_back.save(os.path.join(OUT, f"polo-{color}-back-emblem.png"))
    print("polo", color, box)


def decorate_qzip(color):
    front = Image.open(f"{REF}/qzip-{color}-3.jpg").convert("RGBA")
    back = Image.open(f"{REF}/qzip-{color}-4.jpg").convert("RGBA")
    word = WORD_W if color == "black" else WORD_B
    box = bbox(front)
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0, y1 - y0
    # form is turned; place the small chest mark on the wearer's left, image-right of center
    paste_center(front, word, x0 + bw * 0.58, y0 + bh * 0.30, bw * 0.16)
    save_pair(cut_white(front), "quarter-zip", color, "front")
    save_pair(cut_white(front), "quarter-zip", color, "hero")
    save_pair(cut_white(back), "quarter-zip", color, "back")
    print("qzip", color, box)


def decorate_cap(color):
    front = Image.open(f"{REF}/cap-{color}-0.jpg").convert("RGBA")
    word = WORD_W if color == "black" else WORD_B
    box = bbox(front)
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0, y1 - y0
    paste_center(front, word, x0 + bw * 0.40, y0 + bh * 0.40, bw * 0.30)
    fill = (247, 247, 245, 255) if color == "black" else (20, 20, 22, 255)
    mark = name_mark("AGENT NAME", fill, bw * 0.18)
    front.alpha_composite(mark, (int(x0 + bw * 0.62), int(y0 + bh * 0.46)))
    cut = cut_white(front)
    save_pair(cut, "cap", color, "front")
    save_pair(cut, "cap", color, "hero")
    save_pair(cut, "cap", color, "back")
    print("cap", color, box)


def alpha_box(im):
    return im.split()[-1].point(lambda p: 255 if p > 16 else 0).getbbox()


def stamp_backs():
    for slug in ("t-shirt", "quarter-zip"):
        for color in ("black", "white"):
            im = Image.open(os.path.join(OUT, f"{slug}-{color}-back.png")).convert("RGBA")
            box = alpha_box(im) or im.getbbox()
            x0, y0, x1, y1 = box
            paste_center(im, tonal_emblem(color), (x0 + x1) / 2, y0 + (y1 - y0) * 0.16, (x1 - x0) * 0.12)
            im.save(os.path.join(OUT, f"{slug}-{color}-back-emblem.png"))


def publish_for_sale():
    import subprocess
    subprocess.check_call(["python3", os.path.join(ROOT, "scripts/sign_art.py")])
    for color in ("white", "black"):
        art = Image.open(os.path.join(ROOT, "assets/signs", f"for-sale-{color}.png")).convert("RGB")
        art = art.resize((1800, 2400), Image.Resampling.LANCZOS)
        for kind in ("for-sale-plastic", "for-sale-aluminum"):
            base = os.path.join(RENDERS, f"{kind}-{color}-hero")
            art.save(base + ".jpg", quality=90, optimize=True)
            art.save(base + ".webp", quality=84, method=4)
            thumb = art.copy()
            thumb.thumbnail((720, 960))
            thumb.save(base + "-thumb.webp", quality=80, method=4)


def tile():
    canvas = Image.new("RGB", (2000, 1400), (247, 246, 243))
    files = [
        "t-shirt-black-hero.jpg",
        "polo-black-hero.jpg",
        "quarter-zip-black-hero.jpg",
        "cap-black-hero.jpg",
    ]
    slot = 480
    for i, name in enumerate(files):
        im = Image.open(os.path.join(RENDERS, name)).convert("RGBA")
        im.thumbnail((slot, 1100))
        x = 40 + i * 490 + (slot - im.width) // 2
        y = (1400 - im.height) // 2
        canvas.paste(im, (x, y), im)
    base = os.path.join(RENDERS, "tile-gear")
    canvas.save(base + ".jpg", quality=86)
    canvas.save(base + ".webp", quality=82)
    thumb = canvas.copy()
    thumb.thumbnail((720, 720))
    thumb.save(base + "-thumb.webp", quality=80)


def main():
    for color in ("black", "white"):
        decorate_tee(color)
        decorate_polo(color)
        decorate_qzip(color)
        decorate_cap(color)
    stamp_backs()
    publish_for_sale()
    tile()


if __name__ == "__main__":
    main()
