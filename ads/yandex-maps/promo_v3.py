"""Баннер акции «Имплант от 17 500 ₽» в тёмном стиле сайта, 1800×960 (раздел «Акции» карточки).
python3 promo_v3.py <raw-v3/A/01-implantaciya.png> <выход.png> [до какого числа]"""
import sys, os
from PIL import Image, ImageDraw, ImageFont

W, H = 1800, 960
INK, INK3 = (12, 36, 16), (27, 69, 36)
WHITE, SAGE, MUTED, GREEN = (255, 255, 255), (183, 203, 179), (169, 187, 169), (76, 193, 72)
FONTS = os.environ.get("FONTS", os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts"))


def font(name, size, weight):
    f = ImageFont.truetype(os.path.join(FONTS, name), size)
    f.set_variation_by_axes([weight])
    return f


def banner(src, out, until="31.12.2026"):
    c = Image.new("RGBA", (W, H), INK + (255,))
    im = Image.open(src).convert("RGB")
    side = 1060
    im = im.resize((side, side), Image.LANCZOS)
    x0 = W - side + 60
    c.alpha_composite(im.crop((0, 50, side, 50 + H)).convert("RGBA"), (x0, 0))
    ov = Image.new("RGBA", (420, H)); d = ImageDraw.Draw(ov)
    for i in range(420):  # левый край предмета уходит в фон
        d.line([(i, 0), (i, H)], fill=INK + (int(255 * (1 - i / 420) ** 1.5),))
    c.alpha_composite(ov, (x0, 0))
    d = ImageDraw.Draw(c)
    x = 110
    fp = font("GolosText[wght].ttf", 38, 500); pt = f"Акция до {until}"
    d.rounded_rectangle([x, 110, x + d.textlength(pt, font=fp) + 64, 182], radius=36, fill=INK3)
    d.text((x + 32, 120), pt, font=fp, fill=SAGE)
    d.text((x - 6, 300), "Имплант", font=font("Manrope[wght].ttf", 136, 600), fill=WHITE)
    d.text((x - 6, 450), "от 17 500 ₽", font=font("Manrope[wght].ttf", 150, 700), fill=GREEN)
    fs = font("GolosText[wght].ttf", 50, 400)
    d.text((x, 680), "Консультация хирурга", font=fs, fill=MUTED)
    d.text((x, 746), "и 3D-снимок в подарок", font=fs, fill=MUTED)
    c.convert("RGB").save(out, optimize=True)


if __name__ == "__main__":
    banner(sys.argv[1], sys.argv[2], *(sys.argv[3:4]))
