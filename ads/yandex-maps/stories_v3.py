"""Истории Яндекс Карт в тёмном стиле сайта smartmed.clinic: макеты слайдов 1080×1920.
python3 stories_v3.py <папка вывода> [--ui]   (--ui рисует поверх полоски и кнопку Яндекса, только для показа)"""
import sys, os
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
INK = (12, 36, 16)            # --ink сайта
WHITE, SAGE, MUTED, GREEN = (255, 255, 255), (183, 203, 179), (169, 187, 169), (76, 193, 72)
HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.environ.get("FONTS", os.path.join(HERE, "fonts"))
PHOTOS = os.environ.get("PHOTOS", "/mnt/project-files/Фото_клиники/фото")
DOCTORS = os.environ.get("DOCTORS", "")
SIDE = 88                      # поля слева и справа
SAFE_BOTTOM = 230              # снизу кнопка Яндекса в приложении


def font(name, size, weight):
    f = ImageFont.truetype(os.path.join(FONTS, name), size)
    f.set_variation_by_axes([weight])
    return f


def cover(img, w, h, fx=0.5, fy=0.5):
    # заполнить w×h с обрезкой, точка фокуса fx/fy
    k = max(w / img.width, h / img.height)
    im = img.resize((int(img.width * k + 0.5), int(img.height * k + 0.5)), Image.LANCZOS)
    x = int((im.width - w) * fx); y = int((im.height - h) * fy)
    return im.crop((x, y, x + w, y + h))


def fade(canvas, y0, y1):
    # снизу фото плавно уходит в фон
    ov = Image.new("RGBA", (W, y1 - y0))
    d = ImageDraw.Draw(ov)
    for i in range(y1 - y0):
        t = i / (y1 - y0)
        d.line([(0, i), (W, i)], fill=INK + (int(255 * t ** 1.6),))
    canvas.alpha_composite(ov, (0, y0))


def base(photo, photo_h=1260, fx=0.5, fy=0.5, top=0):
    c = Image.new("RGBA", (W, H), INK + (255,))
    if photo is not None:
        c.alpha_composite(cover(photo, W, photo_h, fx, fy).convert("RGBA"), (0, top))
        fade(c, top + photo_h - 420, top + photo_h)
    return c


def text_block(c, lines, sub=None, size=100, y_end=None):
    """lines: [(текст, цвет)], заголовок прижат к низу безопасной зоны."""
    d = ImageDraw.Draw(c)
    while True:  # заголовок не шире полей
        fh = font("Manrope[wght].ttf", size, 600)
        if max(d.textlength(t, font=fh) for t, _ in lines) <= W - 2 * SIDE or size <= 60:
            break
        size -= 4
    fs = font("GolosText[wght].ttf", 42, 400)
    lh = int(size * 1.04)
    sub_lines = wrap(d, sub, fs, W - 2 * SIDE) if sub else []
    total = lh * len(lines) + (30 + 56 * len(sub_lines) if sub_lines else 0)
    y = (y_end or H - SAFE_BOTTOM) - total
    for t, col in lines:
        d.text((SIDE - 4, y), t, font=fh, fill=col); y += lh
    y += 30
    for t in sub_lines:
        d.text((SIDE, y), t, font=fs, fill=MUTED); y += 56
    return y


def wrap(d, text, f, width):
    out, cur = [], ""
    for w in text.split(" "):
        t = (cur + " " + w).strip()
        if d.textlength(t, font=f) <= width or not cur:
            cur = t
        else:
            out.append(cur); cur = w
    out.append(cur)
    return out


def price_rows(c, title, rows, note):
    d = ImageDraw.Draw(c)
    fh = font("Manrope[wght].ttf", 84, 600)
    fn = font("GolosText[wght].ttf", 40, 400)
    fp = font("Manrope[wght].ttf", 44, 700)
    fnote = font("GolosText[wght].ttf", 30, 400)
    row_h = 112
    y = H - SAFE_BOTTOM - row_h * len(rows) - 70
    ty = y - 48 - 92 * len(title)
    for t, col in title:
        d.text((SIDE - 3, ty), t, font=fh, fill=col); ty += 92
    for name, price in rows:
        d.line([(SIDE, y), (W - SIDE, y)], fill=(255, 255, 255, 40), width=2)
        d.text((SIDE, y + 34), name, font=fn, fill=WHITE)
        pw = d.textlength(price, font=fp)
        d.text((W - SIDE - pw, y + 30), price, font=fp, fill=GREEN)
        y += row_h
    d.line([(SIDE, y), (W - SIDE, y)], fill=(255, 255, 255, 40), width=2)
    d.text((SIDE, y + 26), note, font=fnote, fill=MUTED)


def yandex_ui(c, n, i, button="Записаться"):
    # только для показа: полоски историй и кнопка, их рисует сам Яндекс
    d = ImageDraw.Draw(c)
    gap, x0, x1 = 10, 40, W - 40
    seg = (x1 - x0 - gap * (n - 1)) / n
    for k in range(n):
        a = x0 + k * (seg + gap)
        d.rounded_rectangle([a, 36, a + seg, 44], radius=4, fill=(255, 255, 255, 230 if k <= i else 90))
    d.rounded_rectangle([60, H - 150, W - 60, H - 50], radius=50, fill=(255, 255, 255, 245))
    f = font("GolosText[wght].ttf", 38, 500)
    tw = d.textlength(button, font=f)
    d.text(((W - tw) / 2, H - 124), button, font=f, fill=(30, 30, 30))


def slides():
    P = lambda n: Image.open(os.path.join(PHOTOS, n)).convert("RGB")
    S = lambda n: Image.open(os.path.join(HERE, "raw-v3", "A", n)).convert("RGB")
    out = []

    c = base(P("2gis-02.jpg"), 1300, fx=0.42)
    text_block(c, [("Сначала думаем.", WHITE), ("Потом лечим.", SAGE)],
               "Стоматология в Удельной, рядом с Жуковским", size=104)
    out.append(("01_o-klinike_oblozhka", c, 6, 0))

    c = base(P("2gis-09.jpg"), 1320, fy=0.35)
    text_block(c, [("Свой 3D-томограф", WHITE), ("в клинике", SAGE)],
               "Снимок делаем на месте, врач разбирает его вместе с вами")
    out.append(("02_o-klinike_kt", c, 6, 1))

    c = base(S("01-implantaciya.png"), 1240, fy=0.3, top=60)
    text_block(c, [("Имплант", WHITE), ("от 17 500 ₽", GREEN)],
               "Osstem по акции до 31 декабря. Консультация хирурга 0 ₽, если лечитесь у нас", size=110)
    out.append(("03_implantaciya_oblozhka", c, 5, 0))

    c = base(S("01-implantaciya.png"), 900, fy=0.25, top=80)
    price_rows(c, [("Сколько стоит", WHITE), ("имплантация", SAGE)],
               [("Консультация хирурга", "0 ₽*"), ("КТ двух челюстей", "4 500 ₽"),
                ("Имплант Osstem по акции", "17 500 ₽"), ("Все зубы на 4 имплантах", "от 114 000 ₽")],
               "* если лечитесь у нас. Акция до 31.12.2026")
    out.append(("04_implantaciya_ceny", c, 5, 1))

    if DOCTORS:
        c = base(Image.open(os.path.join(DOCTORS, "solodukhin.jpg")).convert("RGB"), 1500, fy=0.0)
        text_block(c, [("Евгений", WHITE), ("Солодухин", WHITE)],
                   "Главный врач, стоматолог-ортопед", size=104)
        out.append(("05_vrachi_solodukhin", c, 7, 1))

    c = base(P("2gis-14.jpg"), 1300, fx=0.45)
    text_block(c, [("Громова, 10/2", WHITE), ("рядом с Жуковским", SAGE)],
               "Посёлок Удельная. Парковка у здания", size=100)
    out.append(("06_kak-doekhat", c, 3, 0))
    return out


if __name__ == "__main__":
    dst = sys.argv[1]
    ui = "--ui" in sys.argv
    os.makedirs(dst, exist_ok=True)
    for name, c, n, i in slides():
        if ui:
            yandex_ui(c, n, i)
        c.convert("RGB").save(os.path.join(dst, name + ".jpg"), quality=92)
        print(name)
