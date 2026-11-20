"""Flat business-card faces. No painted edge. Black and white share one layout."""
import os
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
    photo = circle_head(280)
    im.alpha_composite(photo, (96, (H - photo.height) // 2 - 20))
    x = 96 + photo.width + 56
    y = 250
    d.text((x, y), "AGENT NAME", font=font(FONT_B, 54), fill=fg)
    d.text((x, y + 68), "REALTOR®", font=font(FONT_M, 26), fill=muted)
    d.text((x, y + 150), "(000) 000-0000", font=font(FONT_R, 32), fill=fg)
    d.text((x, y + 196), "agent@email.com", font=font(FONT_R, 32), fill=fg)
    d.text((x, y + 242), "DRE# 00000000", font=font(FONT_R, 32), fill=fg)
    mark = wordmark(dark, 280)
    margin = 64
    im.alpha_composite(mark, (W - margin - mark.width, H - margin - mark.height))
    return im


def save(im, name):
    rgb = Image.new("RGB", im.size, (255, 255, 255))
    rgb.paste(im, mask=im.split()[-1])
    base = os.path.join(OUT, name)
    rgb.save(base + ".jpg", quality=92, optimize=True)
    rgb.save(base + ".webp", quality=86, method=4)
    thumb = rgb.copy()
    thumb.thumbnail((720, 720))
    thumb.save(base + "-thumb.webp", quality=82, method=4)


def main():
    for dark, color in ((True, "black"), (False, "white")):
        save(front(dark), f"cards-1000-{color}-hero")
        save(back(dark), f"cards-1000-{color}-back")
        print("cards", color)


if __name__ == "__main__":
    main()
