# Кадры PNG из Blender -> webp для сайта, обрезанные по общей рамке объекта.
# l: все кадры; s: 24 кадра того же размера для телефона (реже, меньше трафика).
# Печатает data-crop: полный_w,полный_h,x,y,w,h
import sys, os
import numpy as np
from PIL import Image
src, dst, N = sys.argv[1], sys.argv[2], int(sys.argv[3])
NS = 24
frames = [Image.open(os.path.join(src, "f%03d.png" % i)).convert("RGBA") for i in range(N)]
FW, FH = frames[0].size
x0, y0, x1, y1 = FW, FH, 0, 0
for im in frames:
    a = np.asarray(im)[:, :, 3]
    ys, xs = np.nonzero(a > 3)
    x0, y0, x1, y1 = min(x0, xs.min()), min(y0, ys.min()), max(x1, xs.max()), max(y1, ys.max())
pad = 10
x0 = max(0, (x0 - pad) // 2 * 2); y0 = max(0, (y0 - pad) // 2 * 2)
x1 = min(FW, (x1 + pad + 1) // 2 * 2); y1 = min(FH, (y1 + pad + 1) // 2 * 2)
box = (x0, y0, x1, y1)
for sub in ("l", "s"):
    d = os.path.join(dst, sub); os.makedirs(d, exist_ok=True)
    for f in os.listdir(d): os.remove(os.path.join(d, f))
tot_l = tot_s = 0
for i, im in enumerate(frames):
    p = os.path.join(dst, "l", "f%03d.webp" % i)
    im.crop(box).save(p, "WEBP", quality=80, method=6, alpha_quality=90)
    tot_l += os.path.getsize(p)
for j in range(NS):
    i = round(j * (N - 1) / (NS - 1))
    c = frames[i].crop(box)
    p = os.path.join(dst, "s", "f%03d.webp" % j)
    c.save(p, "WEBP", quality=80, method=6, alpha_quality=90)
    tot_s += os.path.getsize(p)
print("crop-l", f"{FW},{FH},{x0},{y0},{x1 - x0},{y1 - y0}")
print("crop-s = crop-l (те же кадры, реже)")
# то же для сборки превью (scripts/hero_lab.mjs)
import json
json.dump({"frames": N, "framesS": NS, "crop": f"{FW},{FH},{x0},{y0},{x1 - x0},{y1 - y0}"}, open(os.path.join(dst, "meta.json"), "w"))
print("l: %d frames %.0f KB (avg %.1f KB); s: %d frames %.0f KB" % (N, tot_l / 1024, tot_l / 1024 / N, NS, tot_s / 1024))
