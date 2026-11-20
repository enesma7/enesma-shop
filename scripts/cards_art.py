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


def back(dark):
    bg = (16, 16, 18, 255) if dark else (251, 251, 251, 255)
    fg = (248, 248, 246, 255) if dark else (16, 16, 18, 255)
    muted = (176, 176, 180, 255) if dark else (70, 70, 74, 255)
    im = Image.new("RGBA", (W, H), bg)
    d = ImageDraw.Draw(im)
    photo = circle_head(250)
    name_f = font(FONT_B, 52)
    role_f = font(FONT_M, 24)
    body_f = font(FONT_R, 30)
    lines = ["(000) 000-0000", "agent@email.com", "DRE# 00000000"]
    block_h = 52 + 16 + 28 + 36 + 30 * 3 + 12 * 2
    top = (H - max(photo.height, block_h)) // 2
    im.alpha_composite(photo, (110, top + (max(photo.height, block_h) - photo.height) // 2))
    x = 110 + photo.width + 64
    y = top + (max(photo.height, block_h) - block_h) // 2
    d.text((x, y), "AGENT NAME", font=name_f, fill=fg)
    d.text((x, y + 64), "REALTOR®", font=role_f, fill=muted)
    yy = y + 130
    for line in lines:
        d.text((x, yy), line, font=body_f, fill=fg)
        yy += 42
    mark = wordmark(dark, 260)
    margin = 72
    im.alpha_composite(mark, (W - margin - mark.width, H - margin - mark.height))
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
    for dark, color in ((True, "black"), (False, "white")):
        pair = studio_pair(front(dark), back(dark))
        save(pair, f"cards-1000-{color}-hero")
        print("cards", color, pair.size)


if __name__ == "__main__":
    main()
