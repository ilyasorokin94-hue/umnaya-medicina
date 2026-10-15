"""Единая обработка фотографий сайта.

Исходники лежат в src/photos-raw/<папка>/ (в сайт не попадают), результат пишется
в src/images/<папка>/ с тем же именем в JPEG. Повторный запуск ничего не портит.

Что делаем с каждым фото:
- 2ГИС: отрезаем нижнюю полосу с водяным знаком «2GIS»;
- выравниваем баланс белого наполовину (без синевы и желтизны, но без «пластика»);
- чуть приглушаем насыщенность и выравниваем контраст, чтобы фото из разных
  источников (2ГИС, Яндекс Карты, старый сайт, ChatGPT) выглядели одной серией;
- уменьшаем до 1800 px по длинной стороне, JPEG 80, прогрессивный, без EXIF.

Запуск: python3 scripts/photos.py
"""
from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "src" / "photos-raw"
OUT = ROOT / "src" / "images"
FOLDERS = ["clinic", "old", "gen2"]
MAX_SIDE = 1800


def balance(im: Image.Image, strength: float = 0.5) -> Image.Image:
    """Серый мир: каналы тянем к общему среднему на strength."""
    r, g, b = im.split()
    means = [sum(i * c for i, c in enumerate(ch.histogram())) / max(1, ch.size[0] * ch.size[1]) for ch in (r, g, b)]
    avg = sum(means) / 3
    chans = []
    for ch, m in zip((r, g, b), means):
        k = 1 + strength * (avg / max(m, 1) - 1)
        chans.append(ch.point(lambda v, k=k: max(0, min(255, round(v * k)))))
    return Image.merge("RGB", chans)


def process(src: Path, dst: Path) -> None:
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    if src.stem.startswith("2gis"):
        w, h = im.size
        im = im.crop((0, 0, w, round(h * 0.94)))
    im = balance(im)
    im = ImageEnhance.Color(im).enhance(0.9)
    im = ImageEnhance.Contrast(im).enhance(1.03)
    im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "JPEG", quality=80, optimize=True, progressive=True)


def main() -> None:
    for folder in FOLDERS:
        src_dir = RAW / folder
        if not src_dir.is_dir():
            continue
        for src in sorted(src_dir.iterdir()):
            if src.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
                continue
            dst = OUT / folder / (src.stem + ".jpg")
            process(src, dst)
            print(f"{folder}/{src.name} -> {dst.relative_to(ROOT)} {Image.open(dst).size}")


if __name__ == "__main__":
    main()
