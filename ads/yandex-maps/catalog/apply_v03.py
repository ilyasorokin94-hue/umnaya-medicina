"""Каталог Карт v03: применяет итог аудита (по частям + каталог целиком) к v02 и проверяет правила.
python3 apply_v03.py <v02.xlsx> <audit_result.json> <decisions.json> <v03.xlsx>

audit_result.json — {"items": {n: {"name","short","long","price","popular","link"}}, "categories": [{"name","items":[n…]}],
                      "popular": [n…], "remove": [n…], "add": [{"n","name","category","price","short","long","link","photo"}]}
decisions.json   — {"photo_v2": [имена файлов без .jpg], …}
Порядок строк в файле меняет только вид в кабинете (в Картах порядок задаёт Яндекс); группируем по категориям для удобства."""
import sys, json, re
import openpyxl
from openpyxl.styles import PatternFill

NEW, FIX = PatternFill("solid", fgColor="E5F4E4"), PatternFill("solid", fgColor="F9EEDA")
WARN = "Есть противопоказания. Посоветуйтесь с врачом."   # ч. 7 ст. 24 закона «О рекламе»: в каждой позиции
KIDS_ORTHO_CATS = {"Брекеты и элайнеры", "Детская стоматология", "Детская ортодонтия"}   # консультация платная
DOCS = ["Солодухин", "Алиханов", "Хлудневск", "Раджабов", "Читайкин", "Каштанов", "Троицк"]
ERR_PAT = [
    (r"um-med", "um-med"), (r"\bкм\b", "км"), (r"\d\s*мин(ут|\.|\b)", "минуты"), (r"по прайсу", "«по прайсу»"),
    (r"по данным", "«по данным»"), (r"https?://|www\.|\.ru\b|\.com\b|@", "ссылка/e-mail"),
    (r"\+7|8\s?\(?\d{3}\)?\s?\d{3}[\s-]?\d{2}", "телефон"), (r"Сикачев", "Сикачева"),
    (r"\bлучш(ий|ая|ее|ие|его|ую)\b", "«лучший»"), (r"№\s?1\b", "«№1»"), (r"гарант", "гарантия"),
    (r"\bсам(ый|ая|ое|ые|ого|ую)\b", "«самый»"), (r"безопасн|безвредн", "безопасно/безвредно"),
    (r"12\s*месяц|без\s+процент|без\s+переплат", "условия рассрочки"),
    (r"условия\s+(подскажет|уточняйте|узнайте)", "«условия подскажет»"),
    (r"консультац\w*[^.]{0,40}в\s+подарок|в\s+подарок[^.]{0,40}консультац", "консультация «в подарок»"),
    (r"Имеются противопоказания|Необходима консультация специалиста", "старая формулировка предупреждения"),
    (r"\bв\s+(Жуковском|Раменском|Люберцах|Балашихе)\b", "клиника «в другом городе»"),
    (r"до\s*/\s*после", "до/после"), (r"благодар|отзыв", "отзывы/благодарности"),
]
LIMITS = {"Название": 250, "Категория": 250, "Короткое описание (до 250)": 250, "Описание (до 3000)": 3000}


def check(n, row):
    errs = []
    for col, lim in LIMITS.items():
        v = row.get(col) or ""
        if len(v) > lim:
            errs.append(f"{n}: {col} {len(v)} > {lim}")
    name, short, long_ = (row.get(c) or "" for c in ("Название", "Короткое описание (до 250)", "Описание (до 3000)"))
    try:
        price = int(row.get("Цена, ₽") or 0)
    except (TypeError, ValueError):
        price = 0
    if price <= 0:
        errs.append(f"{n}: цена {row.get('Цена, ₽')} — не опубликуется")
    if not short.rstrip().endswith(WARN):
        errs.append(f"{n}: короткое без предупреждения в конце")
    if not long_.rstrip().endswith(WARN):
        errs.append(f"{n}: полное без предупреждения в конце")
    m = re.search(r"(\d[\d \u00a0\u202f]*)\s*₽", short)
    if price > 0 and (not m or int(re.sub(r"\D", "", m.group(1))) != price):
        errs.append(f"{n}: первая цена в коротком ≠ поле {price}")
    for fld, txt in (("название", name), ("короткое", short), ("полное", long_)):
        for pat, lab in ERR_PAT:
            if re.search(pat, txt, re.I):
                errs.append(f"{n}: {fld}: {lab}")
        if re.search(r"акци", txt, re.I) and "31.12" not in txt:
            errs.append(f"{n}: {fld}: «акция» без срока")
    if any(d in name + short for d in DOCS):
        errs.append(f"{n}: ФИО врача в названии или коротком")
    if row.get("Категория") in KIDS_ORTHO_CATS and re.search(r"бесплатн", name + short + long_, re.I):
        errs.append(f"{n}: «бесплатно» в ортодонтии/детской")
    return errs


if __name__ == "__main__":
    src, res_p, dec_p, dst = sys.argv[1:5]
    res = json.load(open(res_p, encoding="utf-8"))
    dec = json.load(open(dec_p, encoding="utf-8"))
    wb = openpyxl.load_workbook(src)
    ws = wb["Каталог"]
    head = [c.value for c in ws[1]]
    rows = {}
    for r in ws.iter_rows(min_row=2, values_only=True):
        if r[0] is not None:
            rows[int(r[0])] = dict(zip(head, r))
    changed = {}
    colmap = {"name": "Название", "short": "Короткое описание (до 250)", "long": "Описание (до 3000)",
              "price": "Цена, ₽", "popular": "Популярный товар", "link": "Ссылка на страницу"}
    for n_s, ch in res.get("items", {}).items():
        n = int(n_s)
        for k, col in colmap.items():
            v = ch.get(k)
            if v is not None and v != rows[n].get(col):
                rows[n][col] = v
                changed.setdefault(n, set()).add(col)
    for n in res.get("remove", []):
        rows.pop(int(n), None)
    for a in res.get("add", []):
        n = int(a["n"])
        rows[n] = {"№": n, "Название": a["name"], "Категория": a["category"], "Цена, ₽": a["price"],
                   "Короткое описание (до 250)": a["short"], "Описание (до 3000)": a["long"],
                   "Популярный товар": "Нет", "В наличии": "Да", "Ссылка на страницу": a["link"],
                   "Фото (файл)": a["photo"], "Заметка": a.get("note")}
        changed[n] = {"new"}
    for stem in dec.get("photo_v2", []):
        for n, r in rows.items():
            if r.get("Фото (файл)") == stem + ".jpg":
                r["Фото (файл)"] = stem + "-v2.jpg"
                changed.setdefault(n, set()).add("Фото (файл)")
    if res.get("popular"):
        pop = set(int(x) for x in res["popular"])
        for n, r in rows.items():
            want = "Да" if n in pop else "Нет"
            if r.get("Популярный товар") != want:
                r["Популярный товар"] = want
                changed.setdefault(n, set()).add("Популярный товар")
    order = []
    for cat in res.get("categories", []):
        for n in cat["items"]:
            n = int(n)
            if n in rows:
                if rows[n].get("Категория") != cat["name"]:
                    rows[n]["Категория"] = cat["name"]
                    changed.setdefault(n, set()).add("Категория")
                order.append(n)
    order += [n for n in rows if n not in order]
    assert len(order) == len(set(order)) == len(rows), "дубли или потери в плане категорий"
    errs = [e for n in order for e in check(n, rows[n])]
    npop = sum(1 for r in rows.values() if r.get("Популярный товар") == "Да")
    if npop > 10:
        errs.append(f"популярных {npop} > 10")
    size = sum(len(str(rows[n].get(c) or "").encode()) for n in order
               for c in ("Название", "Категория", "Короткое описание (до 250)", "Описание (до 3000)"))
    # запись
    ws.delete_rows(2, ws.max_row)
    for i, n in enumerate(order, 2):
        r = rows[n]
        for j, col in enumerate(head, 1):
            v = r.get(col)
            if col == "Знаков" and j > 1 and head[j - 2] in LIMITS:
                v = len(r.get(head[j - 2]) or "") or None
            c = ws.cell(row=i, column=j, value=v)
            if n in changed and ("new" in changed[n] or col in changed[n]):
                c.fill = NEW if "new" in changed[n] else FIX
    wb.save(dst)
    print(f"позиций {len(order)}, изменено {len(changed)}, популярных {npop}, объём {size / 1024:.0f} КБ → {dst}")
    for e in errs:
        print("ОШИБКА", e)
    sys.exit(1 if errs else 0)
