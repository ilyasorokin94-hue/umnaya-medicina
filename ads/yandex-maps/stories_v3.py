"""Истории Яндекс Карт в тёмном стиле сайта smartmed.clinic: макеты слайдов 1080×1920.
python3 stories_v3.py <папка вывода> [--ui]   (--ui рисует поверх полоски и кнопку Яндекса, только для показа; 31 слайд, 7 историй)"""
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


def text_block(c, lines, sub=None, size=100, y_end=None, price=None):
    """lines: [(текст, цвет)] или [(текст, цвет, кегль)]; заголовок прижат к низу безопасной зоны.
    price: строка цены зелёным между заголовком и пояснением."""
    d = ImageDraw.Draw(c)
    while True:  # заголовок не шире полей
        fh = font("Manrope[wght].ttf", size, 600)
        widths = [d.textlength(l[0], font=font("Manrope[wght].ttf", l[2], 600) if len(l) > 2 else fh) for l in lines]
        if max(widths) <= W - 2 * SIDE or size <= 60:
            break
        size -= 4
    fs = font("GolosText[wght].ttf", 42, 400)
    fp = font("Manrope[wght].ttf", 76, 700)
    heights = [int((l[2] if len(l) > 2 else size) * 1.04) for l in lines]
    sub_lines = wrap(d, sub, fs, W - 2 * SIDE) if sub else []
    total = sum(heights) + (24 + 86 if price else 0) + (30 + 56 * len(sub_lines) if sub_lines else 0)
    y = (y_end or H - SAFE_BOTTOM) - total
    for l, lh in zip(lines, heights):
        f = font("Manrope[wght].ttf", l[2], 600) if len(l) > 2 else fh
        d.text((SIDE - 4, y), l[0], font=f, fill=l[1]); y += lh
    if price:
        y += 24
        d.text((SIDE - 2, y), price, font=fp, fill=GREEN); y += 86
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


def step_rows(c, title, steps):
    # как price_rows, номер шага шалфейным, без цен
    d = ImageDraw.Draw(c)
    fh = font("Manrope[wght].ttf", 84, 600)
    fn = font("GolosText[wght].ttf", 42, 400)
    fnum = font("Manrope[wght].ttf", 44, 700)
    row_h = 112
    y = H - SAFE_BOTTOM - row_h * len(steps)
    ty = y - 48 - 92 * len(title)
    for t, col in title:
        d.text((SIDE - 3, ty), t, font=fh, fill=col); ty += 92
    for k, name in enumerate(steps, 1):
        d.line([(SIDE, y), (W - SIDE, y)], fill=(255, 255, 255, 40), width=2)
        d.text((SIDE, y + 30), str(k), font=fnum, fill=SAGE)
        d.text((SIDE + 80, y + 33), name, font=fn, fill=WHITE)
        y += row_h


def portraits(names, cols, area_h, top=0):
    # ряд или сетка портретов врачей на всю ширину, снизу уход в фон
    c = Image.new("RGBA", (W, H), INK + (255,))
    rows = (len(names) + cols - 1) // cols
    gap = 8
    for r in range(rows):
        row = names[r * cols:(r + 1) * cols]
        cw = (W - gap * (len(row) - 1)) / len(row)
        chh = (area_h - gap * (rows - 1)) / rows
        for k, n in enumerate(row):
            im = Image.open(os.path.join(DOCTORS, n + ".jpg")).convert("RGB")
            tile = cover(im, int(cw), int(chh), 0.5, 0.08)
            c.alpha_composite(tile.convert("RGBA"), (int(k * (cw + gap)), int(top + r * (chh + gap))))
    fade(c, top + area_h - 420, top + area_h)
    return c


def quote_slide(lines, who):
    # отзыв без фото: кавычка и цитата прижаты к низу, как заголовки остальных слайдов
    c = Image.new("RGBA", (W, H), INK + (255,))
    d = ImageDraw.Draw(c)
    text_block(c, lines, who, size=96)
    d.text((SIDE - 14, 1010), "«", font=font("Manrope[wght].ttf", 400, 600), fill=SAGE)
    return c


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
    CAT = os.path.join(HERE, "catalog", "raw")

    def S(showcase, catalog=None):
        # предмет в студии: картинка каталога, если уже есть, иначе витрины
        if catalog and os.path.exists(os.path.join(CAT, catalog + ".png")):
            return Image.open(os.path.join(CAT, catalog + ".png")).convert("RGB")
        return Image.open(os.path.join(HERE, "raw-v3", "A", showcase + ".png")).convert("RGB")

    def studio(img):
        return base(img, 1240, fy=0.3, top=60)

    out = []
    add = lambda story, k, c: out.append((f"{story}_{k}", c))

    # 1. Как доехать
    c = base(P("yandex-08.jpg"), 1300, fx=0.35)
    text_block(c, [("Громова, 10/2", WHITE), ("рядом с Жуковским", SAGE)], "Посёлок Удельная. Парковка у здания")
    add("1-kak-doekhat", 1, c)
    c = base(P("yandex-05.jpg"), 1300, fx=0.33)
    text_block(c, [("Вход с улицы", WHITE), ("под вывеской", SAGE)], "Белое здание, вывеска «Умная Медицина»")
    add("1-kak-doekhat", 2, c)
    c = base(P("2gis-01.jpg"), 1300, fx=0.2)
    text_block(c, [("Встретим", WHITE), ("на ресепшене", SAGE)], "Администратор подскажет и проводит к врачу")
    add("1-kak-doekhat", 3, c)

    # 2. О клинике
    c = base(P("2gis-02.jpg"), 1300, fx=0.42)
    text_block(c, [("Сначала думаем.", WHITE), ("Потом лечим.", SAGE)], "Стоматология в Удельной, рядом с Жуковским", size=104)
    add("2-o-klinike", 1, c)
    c = portraits(["hludnevskiy", "solodukhin", "chitaykin"], 3, 1300)
    text_block(c, [("Три врача.", WHITE), ("Один план лечения.", SAGE)], "Хирург, ортопед и терапевт смотрят ваш случай вместе")
    add("2-o-klinike", 2, c)
    c = base(P("2gis-09.jpg"), 1320, fy=0.35)
    text_block(c, [("Свой 3D-томограф", WHITE), ("в клинике", SAGE)], "Снимок делаем на месте, врач разбирает его вместе с вами")
    add("2-o-klinike", 3, c)
    c = studio(S("14-konsultaciya"))
    text_block(c, [("План с ценой", WHITE), ("до начала лечения", SAGE)], "Стоимость каждого этапа знаете заранее")
    add("2-o-klinike", 4, c)
    c = base(P("old-7.jpg"), 1300, fx=0.45)
    text_block(c, [("Гарантия", WHITE), ("в договоре", SAGE)], "Сроки и условия гарантии прописаны в договоре", size=110)
    add("2-o-klinike", 5, c)
    c = base(P("old-1.jpg"), 1300, fx=0.5)
    text_block(c, [("Рассрочка", WHITE), ("и налоговый вычет", SAGE)], "Выдадим документы для вычета")
    add("2-o-klinike", 6, c)

    # 3. Акции
    c = studio(S("01-implantaciya"))
    text_block(c, [("Имплант", WHITE), ("от 17 500 ₽", GREEN)], "Osstem по акции до 31 декабря. Консультация хирурга и 3D-снимок в подарок", size=110)
    add("3-akcii", 1, c)
    c = base(P("old-3.jpg"), 1300, fx=0.5)
    text_block(c, [("−10%", WHITE), ("в день консультации", SAGE)], "При оплате лечения в тот же день")
    add("3-akcii", 2, c)
    c = studio(S("12-gigiena"))
    text_block(c, [("Чистка −22%", WHITE), ("по средам", SAGE)], "Профессиональная гигиена до 31 декабря", size=110)
    add("3-akcii", 3, c)

    # 4. Имплантация
    c = studio(S("01-implantaciya", "konsultaciya-implantologa"))
    text_block(c, [("Имплантация", WHITE), ("от зуба до челюсти", SAGE)], "Один зуб, несколько или все зубы на имплантах")
    add("4-implantaciya", 1, c)
    c = base(S("01-implantaciya"), 900, fy=0.25, top=80)
    price_rows(c, [("Сколько стоит", WHITE), ("имплантация", SAGE)],
               [("Консультация хирурга", "0 ₽*"), ("3D-снимок челюстей", "0 ₽*"),
                ("Имплант Osstem по акции", "17 500 ₽"), ("Все зубы на 4 имплантах", "от 114 000 ₽")],
               "* в подарок при записи на имплантацию. Акция до 31.12.2026")
    add("4-implantaciya", 2, c)
    c = studio(S("02-all-on-4"))
    text_block(c, [("Все зубы", WHITE), ("на 4 имплантах", SAGE)], "Хирургический этап", price="от 114 000 ₽")
    add("4-implantaciya", 3, c)
    c = base(S("01-implantaciya", "ustanovka-implanta"), 900, fy=0.25, top=80)
    step_rows(c, [("Как проходит", WHITE), ("имплантация", SAGE)],
              ["Консультация и КТ", "Установка импланта", "Приживление", "Коронка на имплант"])
    add("4-implantaciya", 4, c)

    # 5. Лечение
    c = studio(S("03-mikroskop"))
    text_block(c, [("Спасём зуб", WHITE), ("под микроскопом", SAGE)], "Лечим каналы под увеличением")
    add("5-lechenie", 1, c)
    c = studio(S("10-karies"))
    text_block(c, [("Кариес", WHITE), ("без боли", SAGE)], None, size=110, price="от 4 000 ₽")
    add("5-lechenie", 2, c)
    c = studio(S("04-koronki"))
    text_block(c, [("Коронки", WHITE), ("цена в договоре", SAGE)], "Цирконий, металлокерамика, E.max")
    add("5-lechenie", 3, c)
    c = studio(S("11-detskaya"))
    text_block(c, [("Детский врач", WHITE), ("без боли и слёз", SAGE)], "Отдельный детский кабинет")
    add("5-lechenie", 4, c)

    # 6. Врачи
    team = ["solodukhin", "hludnevskiy", "radzhabov", "alikhanova", "chitaykin", "kashtanova", "troitskiy"]
    c = portraits(team[:3], 3, 640)
    c2 = portraits(team[3:], 4, 640)
    c.alpha_composite(c2.crop((0, 0, W, 640)), (0, 648))
    fade(c, 1288 - 420, 1288)
    text_block(c, [("Семь врачей", WHITE), ("одна команда", SAGE)], "Хирурги, ортопеды, терапевты и детский врач")
    add("6-vrachi", 1, c)
    people = [("solodukhin", "Евгений", "Солодухин", "Главный врач, стоматолог-ортопед"),
              ("hludnevskiy", "Михаил", "Хлудневский", "Хирург-имплантолог"),
              ("radzhabov", "Азамат", "Раджабов", "Хирург-имплантолог"),
              ("alikhanova", "Светлана", "Алиханова", "Стоматолог-ортопед"),
              ("chitaykin", "Артём", "Читайкин", "Терапевт, эндодонтист"),
              ("kashtanova", "Екатерина", "Каштанова", "Терапевт, ортодонт"),
              ("troitskiy", "Даниил", "Троицкий", "Детский стоматолог")]
    for k, (n, first, last, role) in enumerate(people, 2):
        c = base(Image.open(os.path.join(DOCTORS, n + ".jpg")).convert("RGB"), 1500, fy=0.0)
        text_block(c, [(first, WHITE), (last, SAGE)], role, size=104)
        add("6-vrachi", k, c)

    # 7. Отзывы
    c = base(P("2gis-03.jpg"), 1240, fx=0.5)
    text_block(c, [("5,0", WHITE, 240), ("на Яндекс Картах", SAGE)], "Больше 270 оценок пациентов")
    add("7-otzyvy", 1, c)
    c = quote_slide([("Очень качественно", WHITE), ("сделали лечение", SAGE)], "Л. М., отзыв с Яндекс Карт")
    add("7-otzyvy", 2, c)
    c = base(P("old-9.jpg"), 1300, fx=0.3)
    text_block(c, [("Уже были у нас?", WHITE), ("Оставьте отзыв", SAGE)], "Это помогает другим выбрать врача")
    add("7-otzyvy", 3, c)
    return out


BUTTONS = {"6-vrachi": "О враче", "7-otzyvy_3": "Оставить отзыв"}


if __name__ == "__main__":
    dst = sys.argv[1]
    ui = "--ui" in sys.argv
    os.makedirs(dst, exist_ok=True)
    items = slides()
    count = {}
    for name, _ in items:
        count[name.split("_")[0]] = count.get(name.split("_")[0], 0) + 1
    for name, c in items:
        story, k = name.split("_")
        if ui:
            btn = BUTTONS.get(name) or (BUTTONS.get(story) if not (story == "6-vrachi" and k == "1") else None) or "Записаться"
            yandex_ui(c, count[story], int(k) - 1, btn)
        c.convert("RGB").save(os.path.join(dst, name + ".jpg"), quality=92)
    print(len(items), "слайдов")
