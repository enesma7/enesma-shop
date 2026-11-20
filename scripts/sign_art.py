"""Recreate Enrique's sign layouts with a generic agent and placeholder contact details."""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = "/workspace"
LOGO_B = os.path.join(ROOT, "assets/logo/wordmark-black.png")
LOGO_W = os.path.join(ROOT, "assets/logo/wordmark-white.png")
AGENT = os.path.join(ROOT, "assets/logo/agent-placeholder.jpg")
OUT = os.path.join(ROOT, "assets/signs")
os.makedirs(OUT, exist_ok=True)

FONT_B = "/usr/share/fonts/truetype/macos/Inter-Bold.ttf"
FONT_M = "/usr/share/fonts/truetype/macos/Inter-Medium.ttf"
FONT_R = "/usr/share/fonts/truetype/macos/Inter-Regular.ttf"

def font(path, size):
    return ImageFont.truetype(path, size)

def cutout_agent(max_h):
    im = Image.open(AGENT).convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r > 236 and g > 236 and b > 236:
                px[x, y] = (r, g, b, 0)
            elif r > 220 and g > 220 and b > 220:
                # soft edge
                t = (min(r, g, b) - 220) / 20
                px[x, y] = (r, g, b, int(a * (1 - t)))
    im = im.crop(im.getbbox())
    scale = max_h / im.height
    im = im.resize((int(im.width * scale), max_h), Image.Resampling.LANCZOS)
    return im

def paste_logo(canvas, logo, cx, y, width):
    logo = logo.convert("RGBA")
    h = int(width * logo.height / logo.width)
    logo = logo.resize((width, h), Image.Resampling.LANCZOS)
    canvas.alpha_composite(logo, (int(cx - width / 2), int(y)))
    return h

def for_sale(dark=False):
    W, H = 1800, 2400
    bg = (12, 12, 14, 255) if dark else (248, 248, 246, 255)
    fg = (248, 248, 246, 255) if dark else (10, 10, 12, 255)
    muted = (180, 180, 184, 255) if dark else (70, 70, 74, 255)
    im = Image.new("RGBA", (W, H), bg)
    d = ImageDraw.Draw(im)
    logo = Image.open(LOGO_W if dark else LOGO_B)
    paste_logo(im, logo, W / 2, 160, 860)
    f = font(FONT_B, 168)
    text = "FOR SALE"
    gap = 28
    widths = [d.textlength(ch, font=f) for ch in text]
    total = sum(widths) + gap * (len(text) - 1)
    x = (W - total) / 2
    y = 620
    for ch, wch in zip(text, widths):
        d.text((x, y), ch, font=f, fill=fg)
        x += wch + gap
    # Standing placeholder, fully on the board, lower left. Name sits to its right.
    agent = cutout_agent(980)
    ax, ay = 90, H - agent.height - 70
    im.alpha_composite(agent, (ax, ay))
    nx = ax + agent.width + 40
    ny = ay + 80
    d.text((nx, ny), "AGENT", font=font(FONT_B, 84), fill=fg)
    name_f = font(FONT_B, 64)
    letters = "NAME"
    lw = [d.textlength(ch, font=name_f) for ch in letters]
    gapn = 14
    xx = nx
    for ch, wch in zip(letters, lw):
        d.text((xx, ny + 100), ch, font=name_f, fill=fg)
        xx += wch + gapn
    d.text((nx, ny + 200), "(000) 000-0000", font=font(FONT_M, 40), fill=fg)
    dre = "DRE# 00000000"
    df = font(FONT_R, 30)
    dw = d.textlength(dre, font=df)
    d.text((W - 80 - dw, H - 90), dre, font=df, fill=fg)
    return im

def tracked_width(draw, text, face, gap):
    widths = [draw.textlength(ch, font=face) for ch in text]
    return sum(widths) + gap * (len(text) - 1), widths

def draw_tracked(draw, text, face, x, y, fill, gap):
    total, widths = tracked_width(draw, text, face, gap)
    for ch, wch in zip(text, widths):
        draw.text((x, y), ch, font=face, fill=fill)
        x += wch + gap
    return total

def fit_tracked(draw, text, path, target_w, gap, lo=20, hi=800):
    best = font(path, lo)
    while lo <= hi:
        mid = (lo + hi) // 2
        face = font(path, mid)
        width, _ = tracked_width(draw, text, face, gap)
        if width <= target_w:
            best = face
            lo = mid + 1
        else:
            hi = mid - 1
    return best

def chevron_mask(size, boxes):
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    for x, y, w, h in boxes:
        draw.polygon([
            (x, y),
            (x + w * 0.58, y),
            (x + w, y + h / 2),
            (x + w * 0.58, y + h),
            (x, y + h),
            (x + w * 0.36, y + h / 2),
        ], fill=255)
    return mask

def open_house(dark=False):
    # Catalog sheet board is 18 wide by 12 tall. Keep that exact 3:2.
    W, H = 3600, 2400
    bg = (14, 14, 16, 255) if dark else (246, 246, 246, 255)
    fg = (248, 248, 246, 255) if dark else (8, 8, 10, 255)
    im = Image.new("RGBA", (W, H), bg)
    d = ImageDraw.Draw(im)
    # OPEN sits in the upper left, about 54% of the board width.
    open_left = int(W * 0.055)
    open_w = int(W * 0.545)
    open_gap = 22
    open_f = fit_tracked(d, "OPEN", FONT_B, open_w, open_gap)
    open_y = int(H * 0.055)
    draw_tracked(d, "OPEN", open_f, open_left, open_y, fg, open_gap)
    # HOUSE is widely tracked under OPEN, same overall width.
    house_f = font(FONT_B, int(H * 0.078))
    house = "HOUSE"
    house_widths = [d.textlength(ch, font=house_f) for ch in house]
    span = open_w - house_widths[-1] - int(W * 0.03)
    house_y = int(H * 0.335)
    for i, ch in enumerate(house):
        hx = open_left + span * i / (len(house) - 1)
        d.text((hx, house_y), ch, font=house_f, fill=fg)
    # Two chevrons, same height as OPEN through HOUSE, gradient left to right.
    chev_top = int(H * 0.07)
    chev_bot = int(H * 0.415)
    chev_h = chev_bot - chev_top
    chev_w = int(W * 0.168)
    chev_x = int(W * 0.675)
    shift = int(chev_w * 0.72)
    mask = chevron_mask((W, H), [
        (chev_x, chev_top, chev_w, chev_h),
        (chev_x + shift, chev_top, chev_w, chev_h),
    ])
    grad = Image.new("RGBA", (W, H))
    gd = ImageDraw.Draw(grad)
    x0, x1 = chev_x, min(W - 1, chev_x + shift + chev_w)
    for x in range(x0, x1 + 1):
        t = (x - x0) / max(1, (x1 - x0))
        # Illyrian Red, #EF0207 into #9A0007.
        col = (
            int(239 + (154 - 239) * t),
            int(2 + (0 - 2) * t),
            7,
            255,
        )
        gd.line([(x, 0), (x, H)], fill=col)
    grad.putalpha(mask)
    im.alpha_composite(grad)
    agent = cutout_agent(int(H * 0.50))
    im.alpha_composite(agent, (int(W * 0.05), H - agent.height - int(H * 0.04)))
    logo = Image.open(LOGO_W if dark else LOGO_B)
    logo_w = int(W * 0.34)
    logo_x = int(W * 0.70)
    logo_y = int(H * 0.50)
    paste_logo(im, logo, logo_x, logo_y, logo_w)
    name_f = font(FONT_B, int(H * 0.072))
    name = "AGENT NAME"
    name_w = d.textlength(name, font=name_f)
    name_x = logo_x - name_w / 2
    name_y = int(H * 0.665)
    d.text((name_x, name_y), name, font=name_f, fill=fg)
    phone_f = font(FONT_B, int(H * 0.058))
    phone = "(000) 000-0000"
    phone_w = d.textlength(phone, font=phone_f)
    d.text((logo_x - phone_w / 2, int(H * 0.755)), phone, font=phone_f, fill=fg)
    dre = "DRE# 00000000"
    dre_f = font(FONT_R, int(H * 0.032))
    dre_w = d.textlength(dre, font=dre_f)
    d.text((logo_x + logo_w / 2 - dre_w - int(W * 0.01), int(H * 0.855)), dre, font=dre_f, fill=fg)
    return im

def main():
    for dark, name in ((False, "white"), (True, "black")):
        for_sale(dark).convert("RGB").save(os.path.join(OUT, f"for-sale-{name}.png"), quality=95)
        open_house(dark).convert("RGB").save(os.path.join(OUT, f"open-house-{name}.png"), quality=95)
        print("wrote", name)

if __name__ == "__main__":
    main()
