"""Накладывает плашки с крючками на картинки витрины и собирает баннер акции.
python3 plates.py <папка raw> <папка final> [срок акции]"""
import sys, os
from PIL import Image, ImageDraw, ImageFont

INTER = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
DISPLAY = "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf"
SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"

# файл: (крючок, фон плашки, цвет текста, шрифт)
HOOKS = {
    "01-implantaciya": ("Без боли. Гарантия в договоре", "#FFFFFF", "#15181C", INTER),
    "02-all-on-4": ("Зубы в день операции", "#B5532E", "#FFFFFF", DISPLAY),
    "03-mikroskop": ("Сказали удалить? Спасём зуб", "#3FD0C9", "#0B0F14", INTER),
    "04-koronki": ("Без доплат: цена в договоре", "#F5E6C8", "#5B1A2B", SERIF),
    "05-brekety": ("Ровная улыбка. Брекеты из США", "#15181C", "#F2D33B", DISPLAY),
    "06-elajnery": ("Ровные зубы, и никто не заметит", "#FFFFFF", "#3E2F6B", INTER),
    "06-vyravnivanie": ("Ровные зубы без брекетов", "#FFFFFF", "#3E2F6B", INTER),
    "07-semnye-protezy": ("Новые зубы без операции", "#EDEBD8", "#3D4020", SERIF),
    "08-kt": ("Разбор снимка с врачом 0 ₽", "#00B3D6", "#05070A", DISPLAY),
    "09-zub-mudrosti": ("Удалим восьмёрку без боли", "#F07A22", "#15181C", INTER),
    "10-karies": ("Без боли. −10% в день консультации", "#D8342B", "#FFFFFF", DISPLAY),
    "11-detskaya": ("Молочные зубы без боли и слёз", "#C92A2A", "#FFFFFF", INTER),
    "12-gigiena": ("Чистка по средам −22%", "#FFFFFF", "#0E4D47", DISPLAY),
    "13-otbelivanie": ("Белее за один визит", "#FFFFFF", "#A3271A", SERIF),
    "14-konsultaciya": ("0 ₽, если лечитесь у нас", "#143327", "#F5EBDD", INTER),
}
SIDE = 1080          # итоговый квадрат, у Яндекса минимум 450
MAX_SHARE = 0.18     # плашка не больше 18% площади (правило Яндекса: текст до 20%)


def wrap(draw, text, font, width):
    # однобуквенные предлоги и союзы держим со следующим словом, как в вёрстке
    words, buf = [], ""
    for w in text.split(" "):
        if buf:
            w, buf = buf + "\u00a0" + w, ""
        if len(w) <= 1:
            buf = w
        else:
            words.append(w)
    if buf:
        words.append(buf)
    lines, cur = [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=font) <= width or not cur:
            cur = t
        else:
            lines.append(cur); cur = w
    lines.append(cur)
    return lines


def plate(img, text, bg, fg, font_path):
    W, H = img.size
    d = ImageDraw.Draw(img)
    m = int(W * 0.045); pad_x = int(W * 0.035); pad_y = int(W * 0.026)
    for size in range(int(W * 0.075), 20, -2):
        f = ImageFont.truetype(font_path, size)
        lines = wrap(d, text, f, W * 0.78 - 2 * pad_x)
        if len(lines) > 2:
            continue
        lh = int(size * 1.18)
        tw = max(d.textlength(l, font=f) for l in lines)
        pw, ph = int(tw + 2 * pad_x), int(lh * len(lines) + 2 * pad_y - (lh - size) * 0.6)
        if pw * ph / (W * H) <= MAX_SHARE:
            break
    x0, y1 = m, H - m; y0 = y1 - ph
    d.rounded_rectangle([x0, y0, x0 + pw, y1], radius=int(W * 0.022), fill=bg)
    y = y0 + pad_y - int(size * 0.08)
    for l in lines:
        d.text((x0 + pad_x, y), l, font=f, fill=fg); y += lh
    return pw * ph / (W * H)


def square(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size; s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
    return im.resize((SIDE, SIDE), Image.LANCZOS)


def banner(path, out, until):
    W, H = 1800, 960
    im = Image.open(path).convert("RGB")
    w, h = im.size; k = max(W / w, H / h)
    im = im.resize((int(w * k + 1), int(h * k + 1)), Image.LANCZOS)
    im = im.crop(((im.width - W) // 2, (im.height - H) // 2, (im.width - W) // 2 + W, (im.height - H) // 2 + H))
    d = ImageDraw.Draw(im)
    x = 96
    pf = ImageFont.truetype(INTER, 36); pt = f"Акция до {until}"
    d.rounded_rectangle([x, 96, x + d.textlength(pt, font=pf) + 56, 160], radius=32, fill="#FFFFFF")
    d.text((x + 28, 104), pt, font=pf, fill="#1F3A93")
    d.text((x, 300), "Имплант", font=ImageFont.truetype(DISPLAY, 120), fill="#FFFFFF")
    d.text((x, 430), "от 17 500 ₽", font=ImageFont.truetype(DISPLAY, 150), fill="#FFFFFF")
    sub = ImageFont.truetype(INTER, 50)
    d.text((x, 650), "Консультация хирурга", font=sub, fill="#E6ECFF")
    d.text((x, 715), "и 3D-снимок в подарок", font=sub, fill="#E6ECFF")
    im.save(out, optimize=True)


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    until = sys.argv[3] if len(sys.argv) > 3 else "31.12.2026"
    os.makedirs(dst, exist_ok=True)
    for name in sorted(os.listdir(src)):
        stem, ext = os.path.splitext(name)
        if ext.lower() not in (".png", ".jpg", ".jpeg", ".webp"):
            continue
        key = stem[:-2] if stem.endswith("-b") else stem
        if key == "00-akciya-implant":
            banner(os.path.join(src, name), os.path.join(dst, stem + ".png"), until); print(name, "баннер"); continue
        if key not in HOOKS:
            print(name, "нет крючка, пропуск"); continue
        im = square(os.path.join(src, name))
        share = plate(im, *HOOKS[key])
        im.save(os.path.join(dst, stem + ".jpg"), quality=92)
        print(f"{name}: плашка {share:.1%}")
