# Слои для первого экрана из картинок ChatGPT на ровном тёмно-зелёном фоне.
# bone:  python3 scripts/render/gpt_layers.py bone <exploded.png> <assembled.png|-> <папка> [--da-abut N] [--da-crown N] [--clip-abut Y] [--clip-crown Y]
#        Режет разобранную картинку по пустым горизонтальным полосам на коронку, абатмент и челюсть,
#        подбирает сдвиг коронки до собранного положения по второй картинке и пишет spec.json для data-layers.
# tooth: python3 scripts/render/gpt_layers.py tooth <whole.png> <top.png> <папка>
#        Две совмещённые картинки для data-reveal: верхняя открывается сверху вниз.
# Фон убирается в прозрачность по расстоянию до цвета фона, цвет краёв очищается от зелёного.
import sys, os, json
import numpy as np
from PIL import Image

def key_bg(path):
    im = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    h, w, _ = im.shape
    border = np.concatenate([im[:8].reshape(-1, 3), im[-8:].reshape(-1, 3), im[:, :8].reshape(-1, 3), im[:, -8:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    dev = np.percentile(np.linalg.norm(border - bg, axis=1), 99)
    d = np.linalg.norm(im - bg, axis=2)
    lo, hi = max(6.0, dev * 1.5), max(36.0, dev * 4)
    a = np.clip((d - lo) / (hi - lo), 0, 1)
    rgb = np.where(a[..., None] > 0.02, (im - bg * (1 - a[..., None])) / np.maximum(a[..., None], 0.02), im)
    rgba = np.dstack([np.clip(rgb, 0, 255), a * 255]).astype(np.uint8)
    print(f"{os.path.basename(path)}: {w}x{h}, фон {bg.round().astype(int).tolist()}, разброс по краю {dev:.1f}")
    return rgba, bg

def components(alpha, f=4, thr=40):
    """Связные области непрозрачного на сетке в f раз мельче: [(площадь, маска полного размера)], по убыванию."""
    H, W = alpha.shape
    h, w = (H + f - 1) // f, (W + f - 1) // f
    pad = np.zeros((h * f, w * f), alpha.dtype); pad[:H, :W] = alpha
    m = pad.reshape(h, f, w, f).max(axis=(1, 3)) > thr
    lab = np.zeros((h, w), np.int32); n = 0
    for y0, x0 in zip(*np.nonzero(m)):
        if lab[y0, x0]: continue
        n += 1; lab[y0, x0] = n; st = [(y0, x0)]
        while st:
            y, x = st.pop()
            for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= yy < h and 0 <= xx < w and m[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n; st.append((yy, xx))
    big = np.kron(lab, np.ones((f, f), np.int32))[:H, :W]
    out = []
    for i in range(1, n + 1):
        mk = (big == i) & (alpha > 2)
        out.append((int(mk.sum()), mk))
    return sorted(out, key=lambda c: -c[0])

def dilate(mask, r):
    out = mask.copy()
    for _ in range(r):
        m = out.copy()
        m[1:] |= out[:-1]; m[:-1] |= out[1:]; m[:, 1:] |= out[:, :-1]; m[:, :-1] |= out[:, 1:]
        out = m
    return out

def bbox_of(mask, pad=4):
    ys, xs = np.nonzero(mask)
    return max(0, xs.min() - pad), max(0, ys.min() - pad), min(mask.shape[1], xs.max() + 1 + pad), min(mask.shape[0], ys.max() + 1 + pad)

def save(arr, path):
    Image.fromarray(arr).save(path, "WEBP", quality=86, method=6, alpha_quality=92)
    return os.path.getsize(path)

def match_dy(layer, x, y, target, search=(0, 900), dx=12):
    """Сдвиг слоя вниз, при котором он лучше всего совпадает с собранной картинкой (по пикселям слоя)."""
    L = layer.astype(np.float32); m = L[..., 3] / 255.0
    T = np.asarray(Image.fromarray(target).convert("RGB")).astype(np.float32)
    h, w = L.shape[:2]
    best = (1e18, 0, 0)
    for ddx in range(-dx, dx + 1, 3):
        for dy in range(search[0], search[1], 2):
            yy, xx = y + dy, x + ddx
            if yy < 0 or xx < 0 or yy + h > T.shape[0] or xx + w > T.shape[1]: continue
            diff = ((T[yy:yy + h, xx:xx + w] - L[..., :3]) ** 2).sum(axis=2)
            e = (diff * m).sum() / m.sum()
            if e < best[0]: best = (e, dy, ddx)
    return best

def bone(exp_p, asm_p, out, da_abut=None, da_crown=None, clip_abut=None, clip_crown=None):
    os.makedirs(out, exist_ok=True)
    rgba, bg = key_bg(exp_p)
    H, W = rgba.shape[:2]
    a = rgba[..., 3]
    comps = [c for c in components(a) if c[0] > 0.002 * H * W]
    print("области:", [c[0] for c in comps])
    if len(comps) < 3: raise SystemExit("ожидались челюсть и две отдельные детали над ней (коронка и абатмент)")
    jaw = comps[0][1]
    # из остальных: коронка выше всех, абатмент следующий
    parts = sorted(comps[1:3], key=lambda c: np.nonzero(c[1])[0].min())
    crown_m, abut_m = parts[0][1], parts[1][1]
    items = []
    total = 0
    # мягкие края (полупрозрачные пиксели) отходят к ближайшей детали, а не остаются ореолом на челюсти
    soft = a > 2
    crown_d, abut_d = dilate(crown_m, 8) & soft, dilate(abut_m, 8) & soft
    jaw_d = dilate(jaw, 8) & soft & ~crown_d & ~abut_d
    for name, mk in (("base", jaw_d), ("abut", abut_d & ~crown_d), ("crown", crown_d)):
        x0, y0, x1, y1 = bbox_of(mk)
        crop = rgba[y0:y1, x0:x1].copy()
        crop[..., 3] = np.where(mk[y0:y1, x0:x1], crop[..., 3], 0)
        total += save(crop, os.path.join(out, name + ".webp"))
        items.append({"src": name + ".webp", "x": int(x0), "y": int(y0), "w": int(x1 - x0), "h": int(y1 - y0), "arr": crop})
    base, ab, cr = items
    if asm_p:
        asm, _ = key_bg(asm_p)
        comp = np.zeros((H, W, 3), np.float32) + bg
        al = asm[..., 3:4] / 255.0
        comp = (asm[..., :3] * al + comp * (1 - al)).astype(np.uint8)
        e, dy, ddx = match_dy(cr["arr"], cr["x"], cr["y"], comp, (0, H - cr["y"] - cr["h"]))
        print(f"коронка: сдвиг вниз {dy} px, вбок {ddx} px (ошибка {e:.0f})")
        if da_crown is None: da_crown = dy
        cr["dxa"] = int(ddx)
    if da_crown is None: raise SystemExit("нужна собранная картинка или --da-crown")
    if da_abut is None:
        # абатмент встаёт под коронку: его верх на том же расстоянии под верхом коронки, что и в собранном виде
        da_abut = int(round(da_crown - (ab["y"] - cr["y"] - cr["h"] * 0.55)))
        print("абатмент: сдвиг вниз по оценке", da_abut, "px, проверить на глаз")
    cr.update(da=int(da_crown), **{"from": 0.0, "to": 0.8})
    ab.update(da=int(da_abut), **{"from": 0.18, "to": 1.0})
    if clip_abut is not None: ab["clip"] = [0, int(clip_abut)]
    if clip_crown is not None: cr["clip"] = [0, int(clip_crown)]; cr["soft"] = 10
    if clip_abut is not None: ab["soft"] = 6
    spec = {"fw": W, "fh": H, "items": [{k: v for k, v in it.items() if k != "arr"} for it in (base, ab, cr)]}
    json.dump(spec, open(os.path.join(out, "spec.json"), "w"))
    # проверочные кадры: собрано и разобрано, на фоне сайта
    for t, nm in ((0.0, "check_assembled.png"), (0.35, "check_35.png"), (0.6, "check_60.png"), (1.0, "check_exploded.png")):
        c = Image.new("RGBA", (W, H), (12, 36, 16, 255))
        for it in (base, ab, cr):
            e = 0.0 if "da" not in it else min(1, max(0, (t - it["from"]) / (it["to"] - it["from"])))
            y = it["y"] + it.get("da", 0) * (1 - e * e * (3 - 2 * e))
            x = it["x"] + it.get("dxa", 0) * (1 - e * e * (3 - 2 * e))
            lay = Image.fromarray(it["arr"])
            if "clip" in it:
                yy = np.arange(lay.size[1])[:, None] + y
                sf = max(1, it.get("soft", 0))
                m = np.clip((it["clip"][1] - yy) / sf, 0, 1) * np.ones((1, lay.size[0]))
                lay.putalpha(Image.fromarray((np.asarray(lay.split()[3]) * m).astype(np.uint8)))
            c.alpha_composite(lay, (int(round(x)), int(round(y))))
        c.convert("RGB").save(os.path.join(out, nm))
    print(f"слои {total / 1024:.0f} КБ, spec.json и проверочные кадры в {out}")

def tooth(whole_p, top_p, out):
    os.makedirs(out, exist_ok=True)
    a, _ = key_bg(whole_p); b, _ = key_bg(top_p)
    if a.shape != b.shape:
        b = np.asarray(Image.fromarray(b).resize((a.shape[1], a.shape[0]), Image.LANCZOS))
    H, W = a.shape[:2]
    al = np.maximum(a[..., 3], b[..., 3])
    ys = np.nonzero((al > 8).any(axis=1))[0]
    total = save(a, os.path.join(out, "base.webp")) + save(b, os.path.join(out, "top.webp"))
    spec = {"fw": W, "fh": H, "base": "base.webp", "top": "top.webp", "y0": int(ys.min()) - 20, "y1": int(ys.max()) + 20, "soft": 14}
    json.dump(spec, open(os.path.join(out, "spec.json"), "w"))
    print(f"картинки {total / 1024:.0f} КБ, spec.json в {out}")

if __name__ == "__main__":
    mode = sys.argv[1]
    rest = sys.argv[2:]
    opts = {}
    pos = []
    i = 0
    while i < len(rest):
        if rest[i].startswith("--"): opts[rest[i][2:].replace("-", "_")] = int(rest[i + 1]); i += 2
        else: pos.append(rest[i]); i += 1
    if mode == "bone": bone(pos[0], pos[1] if pos[1] != "-" else None, pos[2], **opts)
    else: tooth(pos[0], pos[1], pos[2])
