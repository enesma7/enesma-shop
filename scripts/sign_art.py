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
FONT_SB = "/usr/share/fonts/truetype/macos/Inter-SemiBold.ttf"
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

def illyrian_ring(diameter, thickness):
    """Open ring. Left of the stroke is #EF0207, right is #9A0007."""
    im = Image.new("RGBA", (diameter, diameter), (0, 0, 0, 0))
    px = im.load()
    c = (diameter - 1) / 2.0
    outer = diameter / 2.0 - 2
    inner = outer - thickness
    for y in range(diameter):
        for x in range(diameter):
            dx = x - c
            dy = y - c
            dist = (dx * dx + dy * dy) ** 0.5
            if inner - 1.6 <= dist <= outer + 1.6:
                fade = 1.0
                if dist > outer:
                    fade = max(0.0, 1 - (dist - outer) / 1.6)
                elif dist < inner:
                    fade = max(0.0, 1 - (inner - dist) / 1.6)
                # 1 on the left of the ring, 0 on the right. Steep so both reds read.
                u = (1 - (dx / max(dist, 0.001))) / 2
                t = max(0.0, min(1.0, (u - 0.12) / 0.76))
                r = int(154 + (239 - 154) * t)
                g = int(2 * t)
                px[x, y] = (r, g, 7, int(255 * fade))
    return im


def illyrian_rule(width, thickness):
    """Hairline, #EF0207 on the left into #9A0007 on the right."""
    width = max(1, int(width))
    thickness = max(1, int(thickness))
    im = Image.new("RGBA", (width, thickness), (0, 0, 0, 0))
    px = im.load()
    for x in range(width):
        t = x / max(1, width - 1)
        color = (
            int(round(239 + (154 - 239) * t)),
            int(round(2 + (0 - 2) * t)),
            7,
            255,
        )
        for y in range(thickness):
            px[x, y] = color
    return im


def for_sale(dark=False, material=None):
    """18x24 For Sale face. Plastic and Aluminum share this artwork."""
    W, H = 1800, 2400
    bg = (12, 12, 14, 255) if dark else (248, 248, 246, 255)
    fg = (248, 248, 246, 255) if dark else (10, 10, 12, 255)
    im = Image.new("RGBA", (W, H), bg)
    d = ImageDraw.Draw(im)
    logo = Image.open(LOGO_W if dark else LOGO_B)
    paste_logo(im, logo, W / 2, 160, 860)
    f = font(FONT_B, 168)
    text = "FOR SALE"
    sale_gap = 28
    widths = [d.textlength(ch, font=f) for ch in text]
    total = sum(widths) + sale_gap * (len(text) - 1)
    x = (W - total) / 2
    y = 620
    for ch, wch in zip(text, widths):
        d.text((x, y), ch, font=f, fill=fg)
        x += wch + sale_gap
    # Full-length placeholder stays on the left.
    agent = cutout_agent(980)
    ax, ay = 70, H - agent.height - 70
    im.alpha_composite(agent, (ax, ay))

    # Name matches the FOR SALE headline: Inter, uppercase, tracked.
    # SemiBold (600) instead of Bold, so it stays street-readable without the heavy block.
    # "AGENT NAME" at that size is wider than the column beside the photo, so it wraps.
    right = int(W * 0.95)
    breath = int(W * 0.035)
    max_w = right - (ax + agent.width + breath)
    headline = 168
    name_track = 0.10
    name_size = headline
    name_face = font(FONT_SB, name_size)
    name_gap = name_size * name_track
    agent_w, _ = tracked_width(d, "AGENT", name_face, name_gap)
    name_w, _ = tracked_width(d, "NAME", name_face, name_gap)
    full_w, _ = tracked_width(d, "AGENT NAME", name_face, name_gap)
    one_line = full_w <= max_w
    if not one_line and max(agent_w, name_w) > max_w:
        lo, hi = 80, headline
        while lo <= hi:
            mid = (lo + hi) // 2
            face = font(FONT_SB, mid)
            gap = mid * name_track
            widest = max(
                tracked_width(d, "AGENT", face, gap)[0],
                tracked_width(d, "NAME", face, gap)[0],
            )
            if widest <= max_w:
                name_size = mid
                name_face = face
                name_gap = gap
                lo = mid + 1
            else:
                hi = mid - 1
        agent_w, _ = tracked_width(d, "AGENT", name_face, name_gap)
        name_w, _ = tracked_width(d, "NAME", name_face, name_gap)

    # Phone is 58% of the name cap height, Regular (400), with its own tracking.
    phone = "(000) 000-0000"
    phone_size = max(1, round(name_size * 0.58))
    phone_track = 0.08
    phone_face = font(FONT_R, phone_size)
    phone_gap = phone_size * phone_track
    phone_w, _ = tracked_width(d, phone, phone_face, phone_gap)
    while phone_w > max_w and phone_track > 0.02:
        phone_track = round(phone_track - 0.01, 2)
        phone_gap = phone_size * phone_track
        phone_w, _ = tracked_width(d, phone, phone_face, phone_gap)

    lines = ["AGENT NAME"] if one_line else ["AGENT", "NAME"]
    line_ws = [full_w] if one_line else [agent_w, name_w]
    block_w = max(line_ws + [phone_w])
    # About 2.5px when this 1800px-wide art is shown on a 390px phone.
    rule_h = max(2, round(2.5 * W / 390))
    rule_w = max(1, int(round(block_w * 0.40)))
    name_box = d.textbbox((0, 0), "AGENT", font=name_face)
    phone_box = d.textbbox((0, 0), "000", font=phone_face)
    line_step = name_size * 1.12
    after_name = name_size * 0.26
    before_phone = name_size * 0.30
    ink_top = name_box[1]
    name_ink_bottom = (len(lines) - 1) * line_step + name_box[3]
    rule_y = name_ink_bottom + after_name
    phone_y = rule_y + rule_h + before_phone - phone_box[1]
    ink_bottom = phone_y + phone_box[3]
    block_h = ink_bottom - ink_top
    photo_mid = ay + agent.height / 2
    top = photo_mid - block_h / 2 - ink_top
    # Stay clear of FOR SALE and the DRE line.
    top = max(top, 900)
    top = min(top, H - 150 - (ink_bottom - ink_top) - ink_top)

    y = top
    for line, _lw in zip(lines, line_ws):
        draw_tracked(d, line, name_face, right - tracked_width(d, line, name_face, name_gap)[0], y, fg, name_gap)
        y += line_step
    rule = illyrian_rule(rule_w, rule_h)
    im.alpha_composite(rule, (int(right - rule_w), int(round(top + rule_y))))
    draw_tracked(
        d, phone, phone_face,
        right - phone_w, top + phone_y, fg, phone_gap,
    )
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
    renders = os.path.join(ROOT, "assets/renders")
    os.makedirs(renders, exist_ok=True)
    # Open House is approved and is not rewritten here.
    for dark, name in ((False, "white"), (True, "black")):
        art = for_sale(dark).convert("RGB")
        art.save(os.path.join(OUT, f"for-sale-{name}.png"), quality=95)
        for kind in ("for-sale-plastic", "for-sale-aluminum"):
            base = os.path.join(renders, f"{kind}-{name}-hero")
            art.save(base + ".jpg", quality=92, optimize=True)
            art.save(base + ".webp", quality=86, method=4)
            thumb = art.copy()
            thumb.thumbnail((720, 960))
            thumb.save(base + "-thumb.webp", quality=82, method=4)
        print("wrote", name)

if __name__ == "__main__":
    main()
