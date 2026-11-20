"""Flat business-card faces. No painted edge. Black and white share one layout."""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = "/workspace"
LOGO_W = os.path.join(ROOT, "assets/logo/wordmark-white.png")
LOGO_B = os.path.join(ROOT, "assets/logo/wordmark-black.png")
AGENT = os.path.join(ROOT, "assets/logo/agent-placeholder.jpg")
OUT = os.path.join(ROOT, "assets/renders")
W, H = 1750, 1000
FONT_B = "/usr/share/fonts/truetype/macos/Inter-Bold.ttf"
FONT_M = "/usr/share/fonts/truetype/macos/Inter-Medium.ttf"
FONT_R = "/usr/share/fonts/truetype/macos/Inter-Regular.ttf"


def font(path, size):
    return ImageFont.truetype(path, size)


def wordmark(dark, width):
    logo = Image.open(LOGO_W if dark else LOGO_B).convert("RGBA")
    height = max(1, int(width * logo.height / logo.width))
    return logo.resize((int(width), height), Image.Resampling.LANCZOS)


def red_line(width, height):
    line = Image.new("RGBA", (width, height))
    px = line.load()
    for x in range(width):
        t = x / max(1, width - 1)
        r = int(239 + (154 - 239) * t)
        g = int(2 + (0 - 2) * t)
        b = 7
        for y in range(height):
            px[x, y] = (r, g, b, 255)
    return line.filter(ImageFilter.GaussianBlur(0.6))


def circle_head(size):
    im = Image.open(AGENT).convert("RGBA")
    w, h = im.size
    side = int(min(w, h) * 0.92)
    left = (w - side) // 2
    top = int(h * 0.02)
    im = im.crop((left, top, left + side, min(h, top + side)))
    im = im.resize((size, size), Image.Resampling.LANCZOS)
    px = im.load()
    for y in range(size):
        for x in range(size):
            r, g, b, a = px[x, y]
            if r > 228 and g > 228 and b > 228:
                px[x, y] = (54, 54, 58, 255)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((1, 1, size - 2, size - 2), fill=255)
    im.putalpha(mask)
    return im


def front(dark):
    bg = (16, 16, 18, 255) if dark else (251, 251, 251, 255)
    im = Image.new("RGBA", (W, H), bg)
    mark = wordmark(dark, int(W * 0.62))
    x = (W - mark.width) // 2
    y = (H - mark.height) // 2 - 36
    im.alpha_composite(mark, (x, y))
    line = red_line(int(W * 0.28), 16)
    im.alpha_composite(line, ((W - line.width) // 2, y + mark.height + 36))
    return im


def fit_width(draw, text, path, target, lo=12, hi=400):
    best = font(path, lo)
    while lo <= hi:
        mid = (lo + hi) // 2
        face = font(path, mid)
        if draw.textlength(text, font=face) <= target:
            best = face
            lo = mid + 1
        else:
            hi = mid - 1
    return best


def back(dark):
    """Photo side. Headshot is about 1.16 in on a 2 in card, inside a 0.125 in safe margin."""
    bg = (16, 16, 18, 255) if dark else (251, 251, 251, 255)
    fg = (248, 248, 246, 255) if dark else (16, 16, 18, 255)
    muted = (176, 176, 180, 255) if dark else (70, 70, 74, 255)
    im = Image.new("RGBA", (W, H), bg)
    d = ImageDraw.Draw(im)
    margin = int(round(0.125 / 3.5 * W))
    photo_d = int(round(H * 0.58))
    photo = circle_head(photo_d)
    photo_x = margin
    photo_y = (H - photo_d) // 2
    im.alpha_composite(photo, (photo_x, photo_y))
    mark = wordmark(dark, int(W * 0.20))
    logo_x = W - margin - mark.width
    logo_y = H - margin - mark.height
    text_left = photo_x + photo_d + int(W * 0.04)
    name_right = W - margin
    body_right = logo_x - int(W * 0.025)
    name_f = fit_width(d, "AGENT NAME", FONT_B, name_right - text_left)
    role_f = font(FONT_M, max(18, int(name_f.size * 0.32)))
    body_f = fit_width(d, "agent@email.com", FONT_M, body_right - text_left, hi=int(name_f.size * 0.48))
    lines = ["(000) 000-0000", "agent@email.com", "DRE# 00000000"]
    gap_n = int(name_f.size * 0.22)
    gap_b = int(body_f.size * 0.38)

    def draw_left(text, face, y, fill):
        d.text((text_left, y), text, font=face, fill=fill)
        return d.textbbox((text_left, y), text, font=face)[3]

    probe = d.textbbox((0, 0), "AGENT NAME", font=name_f)
    role_h = d.textbbox((0, 0), "REALTOR®", font=role_f)[3] - d.textbbox((0, 0), "REALTOR®", font=role_f)[1]
    body_h = d.textbbox((0, 0), lines[0], font=body_f)[3] - d.textbbox((0, 0), lines[0], font=body_f)[1]
    block_h = (probe[3] - probe[1]) + gap_n + role_h + int(name_f.size * 0.34) + 3 * body_h + 2 * gap_b
    top = photo_y + max(0, (photo_d - block_h) // 2)
    top = max(margin, min(top, logo_y - block_h - 10))
    y = draw_left("AGENT NAME", name_f, top, fg) + gap_n
    y = draw_left("REALTOR®", role_f, y, muted) + int(name_f.size * 0.34)
    for line in lines:
        y = draw_left(line, body_f, y, fg) + gap_b
    im.alpha_composite(mark, (logo_x, logo_y))
    return im


def radial_stage(w, h):
    """Dark studio sweep, lighter toward the top center."""
    yy, xx = np.mgrid[0:h, 0:w]
    nx = (xx - w * 0.5) / (w * 0.72)
    ny = (yy - h * 0.38) / (h * 0.85)
    t = np.clip(np.sqrt(nx * nx + ny * ny), 0, 1)
    # #2a2a2e near the light, #0c0c0e at the edges
    light = np.array([42, 42, 46], dtype=np.float32)
    dark = np.array([10, 10, 12], dtype=np.float32)
    rgb = light * (1 - t[..., None]) + dark * t[..., None]
    return Image.fromarray(rgb.astype(np.uint8), "RGB")


def card_sprite(face, thick=14):
    """A 3.5×2 card with a thin stock edge and a soft drop shadow."""
    face = face.convert("RGBA")
    w, h = face.size
    canvas = Image.new("RGBA", (w + thick + 6, h + thick + 8), (0, 0, 0, 0))
    for i in range(thick, 0, -1):
        shade = 18 + int(28 * (i / thick))
        edge = Image.new("RGBA", (w, h), (shade, shade, shade + 2, 255))
        canvas.alpha_composite(edge, (i, i))
    canvas.alpha_composite(face, (0, 0))
    return canvas


def studio_pair(front_im, back_im):
    stage_w, stage_h = 2400, 1320
    stage = radial_stage(stage_w, stage_h).convert("RGBA")
    gap = 36
    card_w = int((stage_w * 0.90 - gap) / 2)
    sprites = []
    for im in (front_im, back_im):
        face = im.convert("RGBA").resize((card_w, int(card_w * im.height / im.width)), Image.Resampling.LANCZOS)
        sprites.append(card_sprite(face, 14))
    total = sprites[0].width + gap + sprites[1].width
    x = (stage.width - total) // 2
    y = (stage.height - sprites[0].height) // 2 + 6
    for sprite, dx in ((sprites[0], 0), (sprites[1], sprites[0].width + gap)):
        shadow = Image.new("RGBA", sprite.size, (0, 0, 0, 0))
        alpha = sprite.split()[-1].filter(ImageFilter.GaussianBlur(22))
        shade = Image.new("RGBA", sprite.size, (0, 0, 0, 150))
        shade.putalpha(alpha)
        shadow.alpha_composite(shade, (0, 0))
        stage.alpha_composite(shadow, (x + dx + 10, y + 28))
        stage.alpha_composite(sprite, (x + dx, y))
    return stage.convert("RGB")


def save(im, name):
    rgb = im.convert("RGB")
    base = os.path.join(OUT, name)
    rgb.save(base + ".jpg", quality=92, optimize=True)
    rgb.save(base + ".webp", quality=86, method=4)
    thumb = rgb.copy()
    thumb.thumbnail((720, 720))
    thumb.save(base + "-thumb.webp", quality=82, method=4)


def main():
    cards_dir = os.path.join(ROOT, "assets/cards")
    os.makedirs(cards_dir, exist_ok=True)
    for dark, color in ((True, "black"), (False, "white")):
        face = front(dark)
        rear = back(dark)
        save(face, f"cards-1000-{color}-front")
        save(rear, f"cards-1000-{color}-back")
        pair = studio_pair(face, rear)
        save(pair, f"cards-1000-{color}-hero")
        pair.save(os.path.join(cards_dir, f"card-{color}.jpg"), quality=92, optimize=True)
        print("cards", color, pair.size, "name", face.size)


if __name__ == "__main__":
    main()
