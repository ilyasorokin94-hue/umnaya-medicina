"""Единая плашка v3 для всех карточек витрины: один цвет, шрифт и размер.
python3 plates_v3.py <папка raw> <папка final> <A|B>"""
import sys, os
from PIL import Image, ImageDraw, ImageFont

DISPLAY = "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf"

# цвета сайта smartmed.clinic
INK, WHITE = "#0C2410", "#FFFFFF"
THEMES = {"A": (WHITE, INK), "B": ("#12331A", WHITE)}  # фон плашки, текст

HOOKS = {
    "01-implantaciya": "Гарантия в договоре",
    "02-all-on-4": "Зубы в день операции",
    "03-mikroskop": "Спасём зуб",
    "04-koronki": "Цена в договоре",
    "05-brekety": "Ровная улыбка",
    "06-elajnery": "Никто не заметит",
    "07-semnye-protezy": "Без операции",
    "08-kt": "Разбор снимка 0 ₽",
    "09-zub-mudrosti": "Удалим без боли",
    "10-karies": "Без боли",
    "11-detskaya": "Без боли и слёз",
    "12-gigiena": "−22% по средам",
    "13-otbelivanie": "Белее за 1 визит",
    "14-konsultaciya": "0 ₽ при лечении",
}
SIDE = 1080
SIZE = 0.10          # кегль от стороны квадрата, у всех одинаковый
MAX_SHARE = 0.18     # плашка не больше 18% площади (правило Яндекса: текст до 20%)


STICKY = {"в", "за", "по", "при", "без", "и", "на", "с", "до", "от", "не"}


def lines_of(draw, text, font, width):
    # предлог и «не» уходят на строку со своим словом, число не отрываем от «₽» и слова
    words = text.split(" ")
    if draw.textlength(text, font=font) <= width:
        return [text]
    best = None
    for i in range(1, len(words)):
        if words[i - 1].lower() in STICKY or words[i - 1].isdigit() or words[i] == "₽":
            continue
        a, b = " ".join(words[:i]), " ".join(words[i:])
        w = max(draw.textlength(a, font=font), draw.textlength(b, font=font))
        if w <= width and (best is None or w < best[0]):
            best = (w, [a, b])
    return best[1] if best else [text]


def plate(img, text, bg, fg):
    W, H = img.size
    d = ImageDraw.Draw(img)
    m, pad_x, pad_y = int(W * 0.05), int(W * 0.045), int(W * 0.032)
    size = int(W * SIZE)
    f = ImageFont.truetype(DISPLAY, size)
    lines = lines_of(d, text, f, W - 2 * m - 2 * pad_x)
    # в одну строку только короткие крючки, иначе две ровные строки
    if len(lines) == 1 and d.textlength(text, font=f) > W * 0.62 and " " in text:
        lines = lines_of(d, text, f, W * 0.55)
    lh = int(size * 1.12)
    tw = max(d.textlength(l, font=f) for l in lines)
    asc, desc = f.getmetrics()
    pw = int(tw + 2 * pad_x)
    ph = int(lh * (len(lines) - 1) + asc + 2 * pad_y - size * 0.12)
    x0, y1 = m, H - m
    y0 = y1 - ph
    d.rounded_rectangle([x0, y0, x0 + pw, y1], radius=int(W * 0.03), fill=bg)
    y = y0 + pad_y - int(size * 0.12)
    for l in lines:
        d.text((x0 + pad_x, y), l, font=f, fill=fg)
        y += lh
    return pw * ph / (W * H)


def square(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size; s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
    return im.resize((SIDE, SIDE), Image.LANCZOS)


if __name__ == "__main__":
    src, dst, theme = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(dst, exist_ok=True)
    for name in sorted(os.listdir(src)):
        stem, ext = os.path.splitext(name)
        if ext.lower() not in (".png", ".jpg", ".jpeg", ".webp") or stem not in HOOKS:
            continue
        im = square(os.path.join(src, name))
        share = plate(im, HOOKS[stem], *THEMES[theme])
        im.save(os.path.join(dst, stem + ".jpg"), quality=92)
        print(f"{name}: плашка {share:.1%}", "ВЫШЕ НОРМЫ" if share > MAX_SHARE else "")
