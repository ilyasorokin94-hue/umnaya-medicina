"""Файл загрузки «Товары и услуги» Яндекс Бизнеса по шаблону template/price-list-template.xls.
python3 build_xls.py <UM_Yandex_tovary_uslugi_v01.xlsx> <выход.xls>
Фото = ссылка на jpg/<файл> на GitHub Pages (папка ym-catalog ветки gh-pages)."""
import sys
import xlwt
from build_jpg import rows, BASE_URL

COLS = ["Категория", "Название", "Идентификатор", "Описание", "Короткое описание", "Цена", "Фото",
        "Популярный товар", "В наличии", "Количество", "Единицы измерения", "Ссылка"]

if __name__ == "__main__":
    wb = xlwt.Workbook(encoding="utf-8")
    ws = wb.add_sheet("Sheet1")
    for j, c in enumerate(COLS):
        ws.write(0, j, c)
    n = 0
    for i, r in enumerate(rows(sys.argv[1]), 1):
        vals = [r["Категория"], r["Название"], int(r["№"]), r["Описание (до 3000)"] or "",
                r["Короткое описание (до 250)"], int(r["Цена, ₽"]), BASE_URL + r["Фото (файл)"],
                "Да" if r["Популярный товар"] == "Да" else "Нет", "Да", "", "", r["Ссылка на страницу"]]
        for j, v in enumerate(vals):
            ws.write(i, j, v)
        n = i
    wb.save(sys.argv[2])
    print(n, "позиций →", sys.argv[2])
