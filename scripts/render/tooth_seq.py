# Кадры первого экрана: натуральный нижний первый моляр (Blender Cycles), сверху вниз проходит плоскость «снимка КТ»:
# всё, что выше плоскости, показано как на КТ (матовое полупрозрачное «стекло», внутри видны пульпа и каналы),
# ниже — живой зуб. За ролик зуб поворачивается вокруг вертикальной оси примерно на 30°.
# Вид КТ: стенки без преломления, дальние стенки ровно светятся «на просвет» (как негатоскоп, не зависят от ламп),
# эмаль светлее дентина, пульпа — непрозрачная тёмная тёпло-розово-коричневая; без линий и свечения на границе.
# Геометрия: поля расстояний на сетке numpy -> поверхность (surface nets) -> сглаживание с возвратом на поверхность.
# Три замкнутые сетки: наружная поверхность зуба, дентин (под эмалью и под тонким слоем цемента корней), пульпа с каналами.
# Единицы: 1 = 1 мм. Нужен Blender как модуль Python: python3 -m pip install bpy (5.2, Python 3.13).
# Запуск: python3 scripts/render/tooth_seq.py <папка_кадров> 0 <samples> <w> <h> <число_кадров> [номера,через,запятую]
# Сайт: python3 scripts/render/tooth_seq.py /tmp/tooth 0 64 1000 1200 96
#       python3 scripts/render/frames_to_webp.py /tmp/tooth src/images/tooth 96  (печатает data-crop для build.mjs)
# Отладка через переменные окружения: TOOTH_CLAY=1 (только форма), TOOTH_H (шаг сетки, мм, по умолчанию 0.065),
# TOOTH_ELEV (наклон камеры, °), TOOTH_VS/VA/VE/FROST/FROSTE/BACK/BACKE/BACKD/VD/PULP — параметры вида КТ (см. «материалы»).
# Один процесс рендерит все кадры: сетки строятся один раз (~45 с), Cycles на 2 потоках.
import bpy, math, sys, os, time
import numpy as np
from mathutils import Vector, Euler

args = sys.argv[1:]
OUT = args[0] if len(args) > 0 else "/tmp/tooth"
SAMPLES = int(args[2]) if len(args) > 2 else 64
W = int(args[3]) if len(args) > 3 else 1000
H = int(args[4]) if len(args) > 4 else 1200
N = int(args[5]) if len(args) > 5 else 96
ONLY = [int(x) for x in args[6].split(",")] if len(args) > 6 and args[6] else None
CLAY = os.environ.get("TOOTH_CLAY") == "1"          # отладка формы: серый пластилин, без КТ

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------- поля ----------
def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)

def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b * (1 - h) + a * h - k * h * (1 - h)

def smax(a, b, k):
    return -smin(-a, -b, k)

def prof(z, zs, vs):
    """Гладкий профиль по высоте: кусочно-линейный по узлам, сглаженный кубическим сплайном Катмулла-Рома."""
    zs = np.asarray(zs, float); vs = np.asarray(vs, float)
    o = np.argsort(zs); zs = zs[o]; vs = vs[o]
    zz = np.clip(z, zs[0], zs[-1])
    i = np.clip(np.searchsorted(zs, zz) - 1, 0, len(zs) - 2)
    t = (zz - zs[i]) / (zs[i + 1] - zs[i])
    p1 = vs[i]; p2 = vs[i + 1]
    p0 = vs[np.maximum(i - 1, 0)]; p3 = vs[np.minimum(i + 2, len(vs) - 1)]
    h0 = zs[i + 1] - zs[i]
    m1 = (p2 - p0) / (zs[np.minimum(i + 1, len(zs) - 1)] - zs[np.maximum(i - 1, 0)]) * h0
    m2 = (p3 - p1) / (zs[np.minimum(i + 2, len(zs) - 1)] - zs[i]) * h0
    t2 = t * t; t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * p1 + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2 + (t3 - t2) * m2

# Оси: x — мезиодистально (+x мезиально), y — вестибулооральной (−y щёчная сторона, +y язычная), z — вверх.
# z = 0 — эмалево-цементная граница на щёчной и язычной поверхностях.

# бугры: x, y, высота вершины, крутизна, скругление вершины
CUSPS = [
    (3.05, -2.40, 7.25, 0.74, 1.25),   # мезиощёчный
    (-0.35, -2.85, 7.05, 0.74, 1.20),  # дистощёчный
    (-3.65, -1.75, 6.60, 0.86, 0.90),  # дистальный
    (2.65, 2.40, 7.70, 0.84, 0.95),    # мезиоязычный
    (-1.85, 2.50, 7.45, 0.84, 0.95),   # дистоязычный
]
# краевые валики: отрезок, высота
RIDGES = [((4.30, -1.85), (4.15, 1.90), 6.15), ((-4.15, -0.55), (-3.45, 2.15), 5.85)]

def seg_dist(X, Y, a, b):
    ax, ay = a; bx, by = b
    dx, dy = bx - ax, by - ay
    t = np.clip(((X - ax) * dx + (Y - ay) * dy) / (dx * dx + dy * dy), 0, 1)
    return np.hypot(X - ax - t * dx, Y - ay - t * dy)

def occlusal(X, Y, fine=True):
    """Жевательная поверхность как высота T(x, y): бугры-купола, гладкий максимум, фиссуры по границам бугров."""
    cs = []
    for cx, cy, hgt, k, r0 in CUSPS:
        rho = np.hypot(X - cx, (Y - cy) * 1.05)
        cs.append(hgt - k * (np.sqrt(rho * rho + r0 * r0) - r0))
    cs = np.array(cs)
    rs = []
    for a, b, hgt in RIDGES:
        d = seg_dist(X, Y, a, b)
        rs.append(hgt - 0.95 * (np.sqrt(d * d + 0.5 ** 2) - 0.5))
    rs = np.array(rs)
    beta = 6.0 if fine else 2.6
    allv = np.concatenate([cs, rs], 0)
    mx = allv.max(0)
    T = mx + np.log(np.exp(beta * (allv - mx)).sum(0)) / beta
    if fine:
        srt = np.sort(cs, axis=0)
        c1, c2 = srt[-1], srt[-2]
        rmax = rs.max(0)
        fiss = np.exp(-((c1 - c2) / 0.26) ** 2) * smoothstep(-0.05, 0.35, c1 - rmax)
        T = T - 0.42 * fiss
        for px, py, dep in ((0.55, 0.05, 0.30), (3.35, 0.05, 0.25), (-2.75, 0.45, 0.22)):
            T = T - dep * np.exp(-((X - px) ** 2 + (Y - py) ** 2) / 0.42 ** 2)
    return T

def side_field(X, Y, Z, fine=True):
    """Стенки коронки и корневого ствола: суперэллипс с размерами, зависящими от высоты."""
    z1 = Z[0, 0, :]
    xm = prof(z1, [-4, -2, -0.6, 0.6, 1.8, 3.2, 4.6, 5.4, 6.4, 7.6], [4.40, 4.25, 4.18, 4.50, 5.00, 5.35, 5.50, 5.48, 5.15, 4.50])
    xd = prof(z1, [-4, -2, -0.6, 0.6, 1.8, 3.2, 4.4, 5.2, 6.4, 7.6], [4.40, 4.25, 4.18, 4.45, 4.95, 5.30, 5.45, 5.40, 4.95, 4.20])
    yb = prof(z1, [-4, -2, -0.5, 0.4, 1.2, 2.0, 3.0, 4.2, 5.4, 6.4, 7.6], [4.05, 4.05, 4.15, 4.45, 4.80, 4.98, 5.00, 4.85, 4.45, 3.95, 3.30])
    yl = prof(z1, [-4, -2, -0.5, 0.6, 1.8, 3.0, 3.8, 4.8, 5.8, 6.6, 7.6], [4.10, 4.10, 4.20, 4.55, 5.00, 5.25, 5.30, 5.20, 4.90, 4.50, 3.80])
    ax = ((xm + xd) / 2)[None, None, :]; cx = ((xm - xd) / 2)[None, None, :]
    ay = ((yb + yl) / 2)[None, None, :]; cy = ((yl - yb) / 2)[None, None, :]
    m = prof(z1, [-4, -1, 1, 4, 7.6], [2.7, 2.6, 2.6, 2.75, 2.6])[None, None, :]
    Xr = X - cx; Yr = Y - cy
    yn = np.clip(Yr / ay, -1, 1)
    axe = ax * (1 - 0.045 * yn)                       # коронка сужается к язычной стороне
    aye = ay * (1 - 0.05 * np.clip(-Xr / ax, 0, 1) * smoothstep(0.5, 3.0, Z))   # и к дистальной
    u = np.abs(Xr) / axe + 1e-6; v = np.abs(Yr) / aye + 1e-6
    n = (u ** m + v ** m) ** (1 / m)
    gu = n ** (1 - m) * u ** (m - 1) / axe; gv = n ** (1 - m) * v ** (m - 1) / aye
    g = np.maximum(np.sqrt(gu * gu + gv * gv), 0.12)
    d = (n - 1) / g
    wb = smoothstep(0.35, 0.85, -yn); wl = smoothstep(0.35, 0.85, yn)
    if fine:
        # щёчные борозды между буграми и язычная борозда, сходят на нет к середине коронки
        d = d + 0.24 * np.exp(-((X - 1.25) / 0.42) ** 2) * smoothstep(3.6, 6.0, Z) * wb
        d = d + 0.18 * np.exp(-((X + 2.15) / 0.40) ** 2) * smoothstep(4.4, 6.2, Z) * wb
        d = d + 0.20 * np.exp(-((X - 0.45) / 0.42) ** 2) * smoothstep(4.2, 6.4, Z) * wl
    # углубление над фуркацией на щёчной и язычной стороне ствола
    d = d + 0.38 * np.exp(-((X + 0.05) / 1.0) ** 2) * (1 - smoothstep(-2.2, -0.2, Z)) * (wb + wl)
    return d

def ellipse_tube(X, Y, Z, cx, cy, ax, ay, zc, Lc, zt):
    """Трубка с эллиптическим сечением вдоль кривой оси, вверху обрезана на zt; ниже zc сечение сжимается как
    sqrt(1 - s^2), s = (zc - z) / Lc, — скруглённая верхушка без излома. cx, cy, ax, ay — функции высоты."""
    z1 = Z[0, 0, :]
    cxz = cx(z1)[None, None, :]; cyz = cy(z1)[None, None, :]
    axz = ax(z1)[None, None, :]; ayz = ay(z1)[None, None, :]
    s = (np.maximum(zc - z1, 0) / Lc)[None, None, :]
    Xr = X - cxz; Yr = Y - cyz
    n = np.sqrt((Xr / axz) ** 2 + (Yr / ayz) ** 2 + s * s)
    g = np.sqrt((Xr / axz ** 2) ** 2 + (Yr / ayz ** 2) ** 2 + (s / Lc) ** 2) / np.maximum(n, 1e-6)
    g = np.maximum(g, 1.0 / np.maximum(axz, ayz))
    d = (n - 1) / g
    return smax(d, Z - zt, 0.4), Xr, Yr

# корни: ось и полуширины по высоте; ниже zc сечение дополнительно сходится эллипсоидом длиной Lc к апексу
# (ширины продолжают плавно уменьшаться, поэтому перехода к верхушке не видно)
MR = dict(cx=lambda z: prof(z, [-1, -3, -5.5, -8.5, -11, -14], [2.05, 2.50, 2.90, 2.85, 2.45, 1.95]),   # верхушка загнута дистально
          cy=lambda z: 0.10 + 0 * z,
          ax=lambda z: prof(z, [-1, -4, -7, -10, -12, -14.1], [1.92, 1.92, 1.68, 1.42, 1.25, 1.08]),
          ay=lambda z: prof(z, [-1, -3, -5, -7.5, -10, -12, -14.1], [4.00, 3.98, 3.55, 2.70, 2.08, 1.78, 1.52]),
          zc=-10.0, Lc=4.05)
DR = dict(cx=lambda z: prof(z, [-1, -4, -8, -11, -13.3], [-2.25, -2.65, -3.25, -3.50, -3.65]),
          cy=lambda z: 0.05 + 0 * z,
          ax=lambda z: prof(z, [-1, -4, -7, -9.4, -11.3, -13.3], [1.98, 1.98, 1.74, 1.53, 1.38, 1.22]),
          ay=lambda z: prof(z, [-1, -3, -5, -7.5, -9.4, -11.3, -13.3], [3.85, 3.78, 3.30, 2.45, 1.95, 1.68, 1.45]),
          zc=-9.4, Lc=3.85)

def outer_field(X, Y, Z, fine=True):
    T = occlusal(X[:, :, 0], Y[:, :, 0], fine)
    gx, gy = np.gradient(T, X[1, 0, 0] - X[0, 0, 0], Y[0, 1, 0] - Y[0, 0, 0])
    dtop = (Z - T[:, :, None]) / np.sqrt(1 + gx * gx + gy * gy)[:, :, None]
    body = smax(side_field(X, Y, Z, fine), dtop, 0.9)
    body = smax(body, -3.0 - Z, 1.6)                                    # низ корневого ствола
    dm, Xm, Ym = ellipse_tube(X, Y, Z, MR["cx"], MR["cy"], MR["ax"], MR["ay"], MR["zc"], MR["Lc"], -0.6)
    # продольные вдавления на мезиальной и дистальной поверхности мезиального корня
    dm = dm + 0.40 * np.exp(-(Ym / 1.35) ** 2) * smoothstep(-2.6, -4.8, Z) * (1 - smoothstep(-7.0, -12.8, Z))
    dd, Xd, Yd = ellipse_tube(X, Y, Z, DR["cx"], DR["cy"], DR["ax"], DR["ay"], DR["zc"], DR["Lc"], -0.6)
    dd = dd + 0.16 * np.exp(-(Yd / 1.3) ** 2) * smoothstep(-3.0, -5.0, Z) * (1 - smoothstep(-7.0, -11.5, Z))
    roots = np.minimum(dm, dd)
    return smin(body, roots, 1.3)

def cej_z(X, Y):
    w = X * X / (X * X + Y * Y + 0.5)
    return w * np.where(X > 0, 0.75, 0.45)

def enamel_thickness(X, Y, Z):
    zc = cej_z(X, Y)
    e = 1.30 * smoothstep(zc, zc + 3.4, Z) ** 0.75
    return e + 0.80 * smoothstep(3.8, 5.8, Z)          # оценивается на высоте границы эмаль-дентин, не бугра

def dentin_field(X, Y, Z):
    # слой цемента 0.18 мм; у верхушек поле корня «растянуто» по высоте (оценка расстояния занижена),
    # поэтому сдвиг там меньше — дентин и каналы доходят почти до апекса
    cem = 0.18 * (1 - 0.55 * np.where(X > 0, smoothstep(-12.0, -13.9, Z), smoothstep(-11.2, -13.1, Z)))
    return outer_field(X, Y, Z, fine=False) + cem + enamel_thickness(X, Y, Z)

def capsule(X, Y, Z, a, b, r0, r1):
    ax_, ay_, az_ = a; bx, by, bz = b
    dx, dy, dz = bx - ax_, by - ay_, bz - az_
    L2 = dx * dx + dy * dy + dz * dz
    t = np.clip(((X - ax_) * dx + (Y - ay_) * dy + (Z - az_) * dz) / L2, 0, 1)
    d = np.sqrt((X - ax_ - t * dx) ** 2 + (Y - ay_ - t * dy) ** 2 + (Z - az_ - t * dz) ** 2)
    return d - (r0 + (r1 - r0) * t)

def rbox(X, Y, Z, c, h, r):
    qx = np.abs(X - c[0]) - (h[0] - r); qy = np.abs(Y - c[1]) - (h[1] - r); qz = np.abs(Z - c[2]) - (h[2] - r)
    out = np.sqrt(np.maximum(qx, 0) ** 2 + np.maximum(qy, 0) ** 2 + np.maximum(qz, 0) ** 2)
    return out + np.minimum(np.maximum(np.maximum(qx, qy), qz), 0) - r

def ellipsoid(X, Y, Z, c, r):
    k0 = np.sqrt(((X - c[0]) / r[0]) ** 2 + ((Y - c[1]) / r[1]) ** 2 + ((Z - c[2]) / r[2]) ** 2)
    k1 = np.sqrt(((X - c[0]) / r[0] ** 2) ** 2 + ((Y - c[1]) / r[1] ** 2) ** 2 + ((Z - c[2]) / r[2] ** 2) ** 2)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-6)

def pulp_field(X, Y, Z):
    # камера пульпы взрослого зуба: шире, чем высота, свод чуть выше эмалево-цементной границы, выпуклое дно
    # над фуркацией; рога короткие и широкие (мезиальные выше), сливаются в один мезиальный пик и дистальное плечо
    ch = rbox(X, Y, Z, (0.25, 0.0, 0.45), (2.55, 1.70, 0.85), 0.80)
    ch = ch + 0.30 * np.exp(-((X - 0.1) / 1.3) ** 2) * smoothstep(0.5, -0.8, Z)      # выпуклое дно камеры
    horns = [((1.70, -1.05, 1.55), (0.80, 0.70, 0.95)),    # мезиощёчный
             ((1.60, 1.05, 1.60), (0.80, 0.70, 1.00)),     # мезиоязычный
             ((-0.30, -1.10, 1.40), (0.75, 0.65, 0.70)),   # дистощёчный
             ((-1.20, 1.10, 1.45), (0.75, 0.65, 0.75)),    # дистоязычный
             ((-2.00, -0.70, 1.25), (0.70, 0.60, 0.55))]   # дистальный
    f = ch
    for c, r in horns:
        f = smin(f, ellipsoid(X, Y, Z, c, r), 1.0)
    # каналы: два узких в мезиальном корне (щёчный и язычный), один широкий лентовидный в дистальном;
    # доходят почти до верхушки (~0.35 мм не доходя), не выходя из дентина
    dm = []
    for side in (-1, 1):
        cyf = lambda z, s=side: s * prof(z, [0.0, -2.5, -7, -11, -13.4], [1.20, 1.25, 0.95, 0.55, 0.24])
        d, _, _ = ellipse_tube(X, Y, Z, MR["cx"], cyf,
                               lambda z: prof(z, [0.0, -2.0, -6, -10, -13.0], [0.40, 0.24, 0.19, 0.14, 0.11]),
                               lambda z: prof(z, [0.0, -2.0, -6, -10, -13.0], [0.51, 0.32, 0.24, 0.16, 0.11]),
                               -13.35, 0.25, 0.6)
        dm.append(d)
    f = smin(f, smin(dm[0], dm[1], 0.12), 0.6)       # каналы между собой почти без слияния, чтобы не росли у апекса
    d, _, _ = ellipse_tube(X, Y, Z, DR["cx"], lambda z: 0.05 + 0 * z,
                           lambda z: prof(z, [0.0, -2.0, -6, -10, -12.3], [0.60, 0.42, 0.33, 0.24, 0.16]),
                           lambda z: prof(z, [0.0, -2.0, -5, -8, -10.5, -12.3], [1.15, 0.95, 0.72, 0.48, 0.28, 0.15]),
                           -12.65, 0.25, 0.6)
    return smin(f, d, 0.6)

# ---------- поле -> сетка (surface nets), сглаживание с проекцией на поверхность ----------
def sample(fn, lo, hi, h, chunk=24):
    xs = np.arange(lo[0], hi[0] + h * 0.5, h); ys = np.arange(lo[1], hi[1] + h * 0.5, h); zs = np.arange(lo[2], hi[2] + h * 0.5, h)
    F = np.empty((len(xs), len(ys), len(zs)), np.float32)
    for k0 in range(0, len(zs), chunk):
        X, Y, Z = np.meshgrid(xs, ys, zs[k0:k0 + chunk], indexing="ij")
        F[:, :, k0:k0 + chunk] = fn(X, Y, Z)
    return F, np.array([xs[0], ys[0], zs[0]]), h

def surface_nets(F, org, h):
    s = F < 0
    nx, ny, nz = F.shape
    acc = np.zeros((nx - 1, ny - 1, nz - 1, 3), np.float64)
    cnt = np.zeros((nx - 1, ny - 1, nz - 1), np.int32)
    for ax in range(3):
        sl0 = [slice(None)] * 3; sl1 = [slice(None)] * 3
        sl0[ax] = slice(0, -1); sl1[ax] = slice(1, None)
        f0 = F[tuple(sl0)].astype(np.float64); f1 = F[tuple(sl1)].astype(np.float64)
        e = s[tuple(sl0)] != s[tuple(sl1)]
        t = np.where(e, f0 / np.where(e, f0 - f1, 1.0), 0.0)
        idx = np.indices(e.shape).astype(np.float64)
        pos = np.stack([idx[0], idx[1], idx[2]], -1)
        pos[..., ax] += t
        pos *= e[..., None]
        others = [a for a in range(3) if a != ax]
        for d1 in (0, 1):
            for d2 in (0, 1):
                sl = [slice(None)] * 3
                sl[others[0]] = slice(d1, d1 + (F.shape[others[0]] - 1))
                sl[others[1]] = slice(d2, d2 + (F.shape[others[1]] - 1))
                acc += pos[tuple(sl)]
                cnt += e[tuple(sl)]
    act = cnt > 0
    vid = -np.ones(cnt.shape, np.int64)
    vid[act] = np.arange(act.sum())
    V = acc[act] / cnt[act][:, None] * h + org
    quads = []
    for ax in range(3):
        b, c = (ax + 1) % 3, (ax + 2) % 3
        sl0 = [slice(None)] * 3; sl1 = [slice(None)] * 3
        sl0[ax] = slice(0, -1); sl1[ax] = slice(1, None)
        e = s[tuple(sl0)] != s[tuple(sl1)]
        inside0 = s[tuple(sl0)]
        # только рёбра, у которых есть все четыре соседние ячейки
        msk = np.zeros_like(e)
        sl = [slice(None)] * 3; sl[b] = slice(1, -1); sl[c] = slice(1, -1)
        msk[tuple(sl)] = e[tuple(sl)]
        I = np.argwhere(msk)
        flip = inside0[msk]
        def cell(db, dc):
            J = I.copy(); J[:, b] -= db; J[:, c] -= dc
            return vid[J[:, 0], J[:, 1], J[:, 2]]
        q = np.stack([cell(1, 1), cell(0, 1), cell(0, 0), cell(1, 0)], 1)
        q[~flip] = q[~flip][:, ::-1]
        quads.append(q)
    return V, np.concatenate(quads, 0)

def fix_pinches(V, Q):
    """Разводит вершины, где сходятся два листа поверхности (неоднозначные ячейки): у каждого веера граней своя копия.
    У ребра с четырьмя гранями листы сшиваются попарно по ориентации и близости нормалей."""
    v = Q.ravel(); nxt = np.roll(Q, -1, 1).ravel(); prv = np.roll(Q, 1, 1).ravel()
    ne = np.int64(len(V) + 1)
    ka = np.minimum(v, nxt) * ne + np.maximum(v, nxt); kb = np.minimum(v, prv) * ne + np.maximum(v, prv)
    allk = np.concatenate([ka, kb])
    _, inv, c = np.unique(allk, return_inverse=True, return_counts=True)
    man = (c[inv] // 2) == 2
    ncor = len(v)
    cid = np.concatenate([np.arange(ncor), np.arange(ncor)])
    endv = np.concatenate([v, v])
    hk = np.stack([allk, endv], 1)[man]; hc = cid[man]
    o = np.lexsort((hk[:, 1], hk[:, 0])); hk = hk[o]; hc = hc[o]
    same = (hk[1:] == hk[:-1]).all(1)
    pa = list(hc[:-1][same]); pb = list(hc[1:][same])
    # рёбра с четырьмя гранями: пары граней с противоположным обходом и близкими нормалями
    badk = np.unique(allk[~man])
    if len(badk):
        nrm = np.cross(V[Q[:, 2]] - V[Q[:, 0]], V[Q[:, 3]] - V[Q[:, 1]])
        nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-12)
        for k in badk:
            a, b = int(k // ne), int(k % ne)
            fs = np.nonzero((Q == a).any(1) & (Q == b).any(1))[0]
            fwd = [f for f in fs if Q[f][(list(Q[f]).index(a) + 1) % 4] == b]
            bwd = [f for f in fs if f not in fwd]
            if len(fwd) != 2 or len(bwd) != 2: continue
            s1 = nrm[fwd[0]] @ nrm[bwd[0]] + nrm[fwd[1]] @ nrm[bwd[1]]
            s2 = nrm[fwd[0]] @ nrm[bwd[1]] + nrm[fwd[1]] @ nrm[bwd[0]]
            prs = [(fwd[0], bwd[0]), (fwd[1], bwd[1])] if s1 >= s2 else [(fwd[0], bwd[1]), (fwd[1], bwd[0])]
            for f1, f2 in prs:
                for x in (a, b):
                    pa.append(f1 * 4 + list(Q[f1]).index(x)); pb.append(f2 * 4 + list(Q[f2]).index(x))
    pa = np.array(pa, np.int64); pb = np.array(pb, np.int64)
    lab = np.arange(ncor)
    for _ in range(200):
        old = lab.copy()
        m = np.minimum(lab[pa], lab[pb])
        np.minimum.at(lab, pa, m); np.minimum.at(lab, pb, m)
        lab = lab[lab]
        if (lab == old).all(): break
    pair = np.stack([v, lab], 1)
    up, inv2 = np.unique(pair, axis=0, return_inverse=True)
    first = np.ones(len(up), bool); first[1:] = up[1:, 0] != up[:-1, 0]
    newid = np.where(first, up[:, 0], 0)
    extra = np.nonzero(~first)[0]
    newid[extra] = len(V) + np.arange(len(extra))
    Vn = np.concatenate([V, V[up[extra, 0]]], 0)
    return Vn, newid[inv2.ravel()].reshape(Q.shape), len(extra)

def trilinear(F, org, h, P):
    g = (P - org) / h
    i = np.clip(np.floor(g).astype(np.int64), 0, np.array(F.shape) - 2)
    t = g - i
    x, y, z = i[:, 0], i[:, 1], i[:, 2]
    tx, ty, tz = t[:, 0], t[:, 1], t[:, 2]
    c = 0.0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (tx if dx else 1 - tx) * (ty if dy else 1 - ty) * (tz if dz else 1 - tz)
                c = c + w * F[x + dx, y + dy, z + dz]
    return c

def relax(V, Q, F, org, h, iters=8):
    E = np.concatenate([Q[:, [0, 1]], Q[:, [1, 2]], Q[:, [2, 3]], Q[:, [3, 0]]], 0)
    E = np.sort(E, 1); E = np.unique(E, axis=0)
    deg = np.bincount(E.ravel(), minlength=len(V)).astype(np.float64)
    for it in range(iters):
        nb = np.zeros_like(V)
        for k in range(3):
            nb[:, k] = np.bincount(E[:, 0], V[E[:, 1], k], len(V)) + np.bincount(E[:, 1], V[E[:, 0], k], len(V))
        V = V + 0.55 * (nb / deg[:, None] - V)
        for _ in range(2):
            f = trilinear(F, org, h, V)
            gr = np.stack([(trilinear(F, org, h, V + dv) - trilinear(F, org, h, V - dv)) / h
                           for dv in (np.array([h / 2, 0, 0]), np.array([0, h / 2, 0]), np.array([0, 0, h / 2]))], 1)
            g2 = np.maximum((gr * gr).sum(1), 1e-6)
            step = (f / g2)[:, None] * gr
            nrm = np.linalg.norm(step, axis=1, keepdims=True)
            step = step * np.minimum(1.0, h / np.maximum(nrm, 1e-9))
            V = V - step
    return V, E

def build(name, fn, lo, hi, h):
    t0 = time.time()
    F, org, h = sample(fn, lo, hi, h)
    V, Q = surface_nets(F, org, h)
    V, Q, nsplit = fix_pinches(V, Q)
    V, E = relax(V, Q, F, org, h)
    # проверка замкнутости: каждое ребро ровно у двух граней
    Ed = np.concatenate([Q[:, [0, 1]], Q[:, [1, 2]], Q[:, [2, 3]], Q[:, [3, 0]]], 0)
    _, c = np.unique(np.sort(Ed, 1), axis=0, return_counts=True)
    print("mesh", name, len(V), "verts", len(Q), "quads", "non-manifold edges", int((c != 2).sum()), "split", nsplit, "euler", len(V) - len(Q),
          "%.1fs" % (time.time() - t0), flush=True)
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(V)); me.vertices.foreach_set("co", V.astype(np.float32).ravel())
    me.loops.add(len(Q) * 4); me.loops.foreach_set("vertex_index", Q.astype(np.int32).ravel())
    me.polygons.add(len(Q))
    me.polygons.foreach_set("loop_start", (np.arange(len(Q)) * 4).astype(np.int32))
    me.update(); me.validate()
    me.shade_smooth()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob

HG = float(os.environ.get("TOOTH_H", "0.065"))
tooth = build("tooth", outer_field, (-6.3, -6.0, -14.4), (6.3, 6.0, 8.3), HG)
dentin = build("dentin", dentin_field, (-6.0, -5.7, -14.1), (6.0, 5.7, 7.6), HG)
pulp = build("pulp", pulp_field, (-4.3, -2.9, -13.6), (4.6, 2.9, 4.2), HG * 0.75)

# ---------- материалы ----------
SCAN_NODES = []      # узлы Map Range, куда на каждом кадре пишется высота плоскости
VOL_SCATTER = float(os.environ.get("TOOTH_VS", "0.0"))   # рассеяние в толще, 1/мм
VOL_ABS = float(os.environ.get("TOOTH_VA", "0.045"))       # поглощение в толще, 1/мм
VOL_EMIT = float(os.environ.get("TOOTH_VE", "0.0"))      # «свечение плотности», на 1 мм пути
CT_FROST = float(os.environ.get("TOOTH_FROST", "0.04"))   # матовость наружной стенки корня (у эмали — CT_FROST_E)
CT_FROST_E = float(os.environ.get("TOOTH_FROSTE", "0.08"))  # матовость эмали: эмаль на КТ самая плотная и светлая
CT_BACK = float(os.environ.get("TOOTH_BACK", "0.85"))      # молочность дальней стенки на просвет
CT_BACK_E = float(os.environ.get("TOOTH_BACKE", "2.0"))    # яркость дальней стенки (свечение, не зависит от ламп)
CT_BACK_D = float(os.environ.get("TOOTH_BACKD", "0.45"))   # молочность дальней стенки дентина
VOL_DENTIN = float(os.environ.get("TOOTH_VD", "0.06"))    # поглощение в дентине, 1/мм
PULP_COL = tuple(float(x) for x in os.environ.get("TOOTH_PULP", "0.10,0.03,0.026").split(","))

def ct_factor(nt):
    """1 там, где плоскость уже прошла (z объекта выше плоскости), и для лучей, прошедших сквозь «стекло»."""
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Object"], sep.inputs["Vector"])
    mr = nt.nodes.new("ShaderNodeMapRange"); mr.interpolation_type = "SMOOTHSTEP"
    nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
    mr.inputs["From Min"].default_value = 100; mr.inputs["From Max"].default_value = 100.3
    SCAN_NODES.append(mr)
    # луч уже внутри зуба (прошёл сквозь прозрачную часть) или смотрит на стенку изнутри — тоже вид КТ,
    # иначе сквозь «стекло» была бы видна изнанка непрозрачной нижней части
    lp = nt.nodes.new("ShaderNodeLightPath")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    depth = _math(nt, "ADD", lp.outputs["Transparent Depth"], lp.outputs["Transmission Depth"])
    inside = _math(nt, "MAXIMUM", _math(nt, "GREATER_THAN", depth, 0.5), geo.outputs["Backfacing"])
    return _math(nt, "MAXIMUM", mr.outputs["Result"], inside), sep

def mix_rgb(nt, fac, a, b):
    m = nt.nodes.new("ShaderNodeMix"); m.data_type = "RGBA"
    if isinstance(fac, float): m.inputs["Factor"].default_value = fac
    else: nt.links.new(fac, m.inputs["Factor"])
    for k, v in ((6, a), (7, b)):
        if isinstance(v, tuple): m.inputs[k].default_value = (*v, 1) if len(v) == 3 else v
        else: nt.links.new(v, m.inputs[k])
    return m.outputs[2]

def mix_f(nt, fac, a, b):
    m = nt.nodes.new("ShaderNodeMix"); m.data_type = "FLOAT"
    if isinstance(fac, float): m.inputs["Factor"].default_value = fac
    else: nt.links.new(fac, m.inputs["Factor"])
    for k, v in ((2, a), (3, b)):
        if isinstance(v, float): m.inputs[k].default_value = v
        else: nt.links.new(v, m.inputs[k])
    return m.outputs[0]

def cej_fac(nt, sep, lo=-0.05, hi=0.30):
    """Доля эмали: выше линии эмалево-цементной границы (как cej_z в геометрии, но в узлах)."""
    m = lambda op, a, b=None: _math(nt, op, a, b)
    x2 = m("MULTIPLY", sep.outputs["X"], sep.outputs["X"]); y2 = m("MULTIPLY", sep.outputs["Y"], sep.outputs["Y"])
    w = m("DIVIDE", x2, m("ADD", m("ADD", x2, y2), 0.5))
    amp = m("ADD", m("MULTIPLY", m("GREATER_THAN", sep.outputs["X"], 0.0), 0.30), 0.45)
    zc = m("MULTIPLY", w, amp)
    dz = m("SUBTRACT", sep.outputs["Z"], zc)
    mr = nt.nodes.new("ShaderNodeMapRange"); mr.interpolation_type = "SMOOTHSTEP"
    mr.inputs["From Min"].default_value = lo; mr.inputs["From Max"].default_value = hi
    nt.links.new(dz, mr.inputs["Value"])
    return mr.outputs["Result"]

def _math(nt, op, a, b=None):
    n = nt.nodes.new("ShaderNodeMath"); n.operation = op
    for k, v in ((0, a), (1, b)):
        if v is None: continue
        if isinstance(v, (int, float)): n.inputs[k].default_value = v
        else: nt.links.new(v, n.inputs[k])
    return n.outputs[0]

def principled(nt, **kw):
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    for k, v in kw.items():
        k = k.replace("_", " ")
        if isinstance(v, tuple): b.inputs[k].default_value = (*v, 1) if len(v) == 3 and k != "Subsurface Radius" else v
        elif isinstance(v, (int, float)): b.inputs[k].default_value = v
        else: nt.links.new(v, b.inputs[k])
    return b

def _fac(nt, sock, v):
    """Вход-коэффициент: число или выход другого узла."""
    if isinstance(v, (int, float)): sock.default_value = v
    else: nt.links.new(v, sock)

def ct_surface(nt, frost, back_milk, milk_col, gloss_rough=0.16, ior=1.45, gloss=True, back_emit=None,
               gloss_col=(0.92, 0.92, 0.90)):
    """Поверхность в виде КТ — матовое стекло без преломления.
    Снаружи: прозрачность, френелевский блик (gloss=False — без блика) и матовость frost.
    Изнутри (дальняя стенка): прозрачность и молочный слой со своим ровным свечением — как негатоскоп за снимком;
    он не зависит от ламп (иначе через стенку просвечивает зелёный и холодный свет сзади), пульпа перед ним тёмная.
    frost и back_milk — число или выход узла."""
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    front = tr
    if gloss:
        gl = nt.nodes.new("ShaderNodeBsdfGlossy"); gl.inputs["Roughness"].default_value = gloss_rough
        gl.inputs["Color"].default_value = (*gloss_col, 1)
        fr = nt.nodes.new("ShaderNodeFresnel"); fr.inputs["IOR"].default_value = ior
        front = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(fr.outputs[0], front.inputs[0]); nt.links.new(tr.outputs[0], front.inputs[1]); nt.links.new(gl.outputs[0], front.inputs[2])
    if frost:
        df = nt.nodes.new("ShaderNodeBsdfDiffuse"); df.inputs["Color"].default_value = (*milk_col, 1)
        m2 = nt.nodes.new("ShaderNodeMixShader"); _fac(nt, m2.inputs[0], frost)
        nt.links.new(front.outputs[0], m2.inputs[1]); nt.links.new(df.outputs[0], m2.inputs[2])
        front = m2
    tl = nt.nodes.new("ShaderNodeEmission"); tl.inputs["Color"].default_value = (*milk_col, 1)
    tl.inputs["Strength"].default_value = CT_BACK_E if back_emit is None else back_emit
    back = nt.nodes.new("ShaderNodeMixShader"); _fac(nt, back.inputs[0], back_milk)
    nt.links.new(tr.outputs[0], back.inputs[1]); nt.links.new(tl.outputs[0], back.inputs[2])
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    mx = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(geo.outputs["Backfacing"], mx.inputs[0]); nt.links.new(front.outputs[0], mx.inputs[1]); nt.links.new(back.outputs[0], mx.inputs[2])
    return mx.outputs[0]

def volume(nt, scatter, scol, sigma_a, emit=0.0, ecol=(1, 1, 1), aniso=0.2):
    """Толща в виде КТ: рассеяние (объём освещён), поглощение и слабое собственное «свечение плотности»,
    как на рентгене: чем толще слой, тем светлее; пульпа заслоняет толщу за собой и читается тёмной."""
    out = nt.nodes.get("Material Output")
    parts = []
    if scatter:
        vs = nt.nodes.new("ShaderNodeVolumeScatter"); vs.inputs["Density"].default_value = scatter
        vs.inputs["Color"].default_value = (*scol, 1); vs.inputs["Anisotropy"].default_value = aniso
        parts.append(vs.outputs[0])
    if max(sigma_a) > 0:
        # у Volume Absorption коэффициент поглощения = Density * (1 - Color); задаём его по каналам, 1/мм
        va = nt.nodes.new("ShaderNodeVolumeAbsorption"); va.inputs["Density"].default_value = 1.0
        va.inputs["Color"].default_value = (*(1.0 - min(1.0, c) for c in sigma_a), 1)
        parts.append(va.outputs[0])
    if emit:
        em = nt.nodes.new("ShaderNodeEmission"); em.inputs["Strength"].default_value = emit
        em.inputs["Color"].default_value = (*ecol, 1)
        parts.append(em.outputs[0])
    sh = parts[0]
    for p in parts[1:]:
        ad = nt.nodes.new("ShaderNodeAddShader")
        nt.links.new(sh, ad.inputs[0]); nt.links.new(p, ad.inputs[1]); sh = ad.outputs[0]
    nt.links.new(sh, out.inputs["Volume"])

def finish(nt, natural, ct, fac):
    out = nt.nodes.get("Material Output") or nt.nodes.new("ShaderNodeOutputMaterial")
    for l in list(out.inputs["Surface"].links): nt.links.remove(l)
    mx = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(fac, mx.inputs[0]); nt.links.new(natural, mx.inputs[1]); nt.links.new(ct, mx.inputs[2])
    nt.links.new(mx.outputs[0], out.inputs["Surface"])

def new_mat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree
    if "Principled BSDF" in nt.nodes: nt.nodes.remove(nt.nodes["Principled BSDF"])
    return m, nt

def mat_outer():
    m, nt = new_mat("tooth_outer")
    fac, sep = ct_factor(nt)
    en = cej_fac(nt, sep)
    # живой зуб: эмаль цвета слоновой кости, к вершинам бугров светлее, серее и прозрачнее; корень тёплый бежевый
    tip = nt.nodes.new("ShaderNodeMapRange"); tip.inputs["From Min"].default_value = 5.6; tip.inputs["From Max"].default_value = 7.6
    nt.links.new(sep.outputs["Z"], tip.inputs["Value"])
    enamel_col = mix_rgb(nt, tip.outputs["Result"], (0.80, 0.72, 0.57), (0.71, 0.71, 0.69))
    ao = nt.nodes.new("ShaderNodeAmbientOcclusion"); ao.inputs["Distance"].default_value = 0.7; ao.samples = 12
    enamel_col = mix_rgb(nt, ao.outputs["AO"], (0.50, 0.42, 0.31), enamel_col)
    # корень: тёплый бежевый, чуть неравномерный по тону
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 0.35; nz.inputs["Detail"].default_value = 3
    nt.links.new(nt.nodes.new("ShaderNodeTexCoord").outputs["Object"], nz.inputs["Vector"])
    root_col = mix_rgb(nt, nz.outputs["Fac"], (0.72, 0.56, 0.37), (0.66, 0.51, 0.34))
    col = mix_rgb(nt, en, root_col, enamel_col)
    nat = principled(nt, Base_Color=col,
                     Roughness=mix_f(nt, en, 0.60, 0.30),
                     Subsurface_Weight=mix_f(nt, en, 0.25, mix_f(nt, tip.outputs["Result"], 0.35, 0.65)),
                     Subsurface_Radius=(1.0, 0.72, 0.48), Subsurface_Scale=0.45,
                     Coat_Weight=mix_f(nt, en, 0.0, 0.35), Coat_Roughness=mix_f(nt, en, 0.32, 0.08))   # цемент матовый
    nat.subsurface_method = "RANDOM_WALK"
    # в виде КТ эмаль (выше эмалево-цементной границы) плотнее и светлее: больше матовости, плотнее дальняя стенка
    ct = ct_surface(nt, mix_f(nt, en, CT_FROST, CT_FROST_E), mix_f(nt, en, CT_BACK, min(1.0, CT_BACK + 0.08)), (0.90, 0.87, 0.82),
                    gloss_rough=0.28, ior=1.33, gloss_col=(0.62, 0.62, 0.60))
    finish(nt, nat.outputs[0], ct, fac)
    # толща зуба в виде КТ: по умолчанию только лёгкое поглощение (рассеяние и свечение — TOOTH_VS / TOOTH_VE)
    volume(nt, VOL_SCATTER, (0.88, 0.85, 0.78), (VOL_ABS * 0.92, VOL_ABS, VOL_ABS * 1.15), VOL_EMIT, (1.0, 0.94, 0.85))
    return m

def mat_dentin():
    # дентин виден только сквозь «стекло»: поверхность прозрачная, толща чуть темнее и теплее эмали
    m, nt = new_mat("dentin")
    out = nt.nodes.get("Material Output") or nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(ct_surface(nt, 0.03, CT_BACK_D, (0.62, 0.605, 0.58), gloss=False), out.inputs["Surface"])
    volume(nt, 0.0, (1, 1, 1), (VOL_DENTIN * 0.8, VOL_DENTIN, VOL_DENTIN * 1.3))
    return m

def mat_pulp():
    m, nt = new_mat("pulp")
    b = principled(nt, Base_Color=PULP_COL, Roughness=0.85, Specular_IOR_Level=0.2)   # без блика «стеклянной трубки»
    out = nt.nodes.get("Material Output") or nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(b.outputs[0], out.inputs["Surface"])
    return m

def mat_clay():
    m, nt = new_mat("clay")
    b = principled(nt, Base_Color=(0.6, 0.6, 0.6), Roughness=0.5)
    out = nt.nodes.get("Material Output") or nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(b.outputs[0], out.inputs["Surface"])
    return m

if CLAY:
    tooth.data.materials.append(mat_clay()); dentin.hide_render = True; pulp.hide_render = True
else:
    tooth.data.materials.append(mat_outer())
    dentin.data.materials.append(mat_dentin())
    pulp.data.materials.append(mat_pulp())

# ---------- свет и камера (как у импланта) ----------
world = bpy.data.worlds.new("w"); scene.world = world; world.use_nodes = True
bg = world.node_tree.nodes["Background"]; bg.inputs["Color"].default_value = (0.006, 0.02, 0.01, 1); bg.inputs["Strength"].default_value = 1.0

def area(name, loc, size, power, color=(1, 1, 1), sy=None):
    ld = bpy.data.lights.new(name, "AREA"); ld.shape = "RECTANGLE"; ld.size = size
    ld.size_y = sy if sy else size
    ld.energy = power; ld.color = color
    ob = bpy.data.objects.new(name, ld); bpy.context.collection.objects.link(ob)
    ob.location = loc
    return ob

def aim(ob, target=(0, 0, 3)):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

k = area("key", (-70, -60, 50), 55, 2.4e5, (1.0, 0.98, 0.95)); aim(k)
s1 = area("stripL", (-50, 60, 8), 5, 2.2e5, (0.92, 0.97, 1.0), sy=100); aim(s1, (0, 0, 2))
s2 = area("stripR", (55, 55, 12), 5, 2.4e5, (0.92, 0.97, 1.0), sy=100); aim(s2, (0, 0, 2))
sf = area("stripF", (-40, -50, 0), 4, 0.6e5, (1.0, 1.0, 1.0), sy=90); aim(sf, (0, 0, 2))
tp = area("top", (10, 10, 80), 30, 2.2e4); aim(tp, (0, 0, 8))
gb = area("green", (10, 70, -10), 50, 3.5e4, (0.3, 0.9, 0.35)); aim(gb, (0, 0, 0))
# у зуба зелёный подсвет слабее, чем у импланта: сквозь прозрачную часть он подсвечивал край живой части
# у фуркации — мятная искра на границе
gb.data.energy = 1.2e4
fill = area("fill", (70, -60, 20), 50, 0.8e4, (0.85, 0.95, 0.9)); aim(fill)

# зуб: середина по высоте примерно там же, где была середина импланта с коронкой
Z_TOP, Z_APEX = 7.75, -14.05
root = bpy.data.objects.new("root", None); bpy.context.collection.objects.link(root)
root.location = (0, 0, -1.0 - (Z_TOP + Z_APEX) / 2)
for o in (tooth, dentin, pulp): o.parent = root

cam_d = bpy.data.cameras.new("cam"); cam_d.lens = 135; cam_d.sensor_width = 36
cam = bpy.data.objects.new("cam", cam_d); bpy.context.collection.objects.link(cam)
scene.camera = cam
CAM_ELEV, CAM_DIST, CAM_Z = math.radians(float(os.environ.get("TOOTH_ELEV", "14"))), 104.0, -0.6
cam.location = (0, -CAM_DIST * math.cos(CAM_ELEV), CAM_Z + CAM_DIST * math.sin(CAM_ELEV))
aim(cam, (0, 0, CAM_Z))

def ease(x): return x * x * (3 - 2 * x)

def pose(t):
    """t = 0: живой зуб; плоскость идёт сверху вниз; t = 1: весь зуб в виде КТ. Поворот на 30° за ролик."""
    root.rotation_euler = Euler((0, 0, math.radians(-24 + 30 * ease(t))), "XYZ")
    u = min(1.0, max(0.0, (t - 0.03) / 0.94))
    u = 0.5 * u + 0.5 * ease(u)
    zs = (Z_TOP + 0.35) + ((Z_APEX - 0.35) - (Z_TOP + 0.35)) * u
    for mr in SCAN_NODES:
        mr.inputs["From Min"].default_value = zs - 0.15
        mr.inputs["From Max"].default_value = zs + 0.15
    return zs

# ---------- рендер ----------
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = SAMPLES
scene.cycles.use_adaptive_sampling = True
scene.cycles.use_denoising = True
try: scene.cycles.denoiser = "OPENIMAGEDENOISE"
except Exception as ex: print("denoiser", ex)
scene.cycles.max_bounces = 24; scene.cycles.glossy_bounces = 8
scene.cycles.transmission_bounces = 24; scene.cycles.transparent_max_bounces = 24
scene.cycles.diffuse_bounces = 3; scene.cycles.volume_bounces = 3
scene.cycles.transparent_max_bounces = 32
scene.render.film_transparent = True
scene.cycles.film_transparent_glass = True
scene.cycles.film_transparent_roughness = 0.6
scene.render.resolution_x = W; scene.render.resolution_y = H; scene.render.resolution_percentage = 100
scene.view_settings.view_transform = "AgX"
scene.view_settings.exposure = -0.35
try: scene.view_settings.look = "AgX - Medium High Contrast"
except Exception as ex: print("look", ex)
scene.render.image_settings.file_format = "PNG"; scene.render.image_settings.color_mode = "RGBA"
scene.render.threads_mode = "FIXED"
scene.render.threads = 2

# альфа у матового стекла шумит (часть лучей уходит в прозрачный фон), шумоподавитель Cycles её не трогает:
# в композиторе прогоняем альфу через тот же OIDN по нормалям и альбедо
vl = scene.view_layers[0]
vl.cycles.denoising_store_passes = True
comp = bpy.data.node_groups.new("comp", "CompositorNodeTree")
comp.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
scene.compositing_node_group = comp
rl = comp.nodes.new("CompositorNodeRLayers"); rl.scene = scene
cc = comp.nodes.new("CompositorNodeCombineColor")
for ch in ("Red", "Green", "Blue"): comp.links.new(rl.outputs["Alpha"], cc.inputs[ch])
dn = comp.nodes.new("CompositorNodeDenoise")
comp.links.new(cc.outputs["Image"], dn.inputs["Image"])
comp.links.new(rl.outputs["Denoising Normal"], dn.inputs["Normal"])
comp.links.new(rl.outputs["Denoising Albedo"], dn.inputs["Albedo"])
try: dn.inputs["HDR"].default_value = False
except Exception: pass
sp = comp.nodes.new("CompositorNodeSeparateColor"); comp.links.new(dn.outputs["Image"], sp.inputs["Image"])
cl = comp.nodes.new("ShaderNodeMath"); cl.operation = "MINIMUM"; cl.use_clamp = True
comp.links.new(sp.outputs["Red"], cl.inputs[0]); cl.inputs[1].default_value = 1.0
sa = comp.nodes.new("CompositorNodeSetAlpha")
comp.links.new(rl.outputs["Image"], sa.inputs["Image"]); comp.links.new(cl.outputs[0], sa.inputs["Alpha"])
try: sa.inputs["Type"].default_value = "Replace Alpha"
except Exception as ex: print("setalpha", ex)
go = comp.nodes.new("NodeGroupOutput"); comp.links.new(sa.outputs["Image"], go.inputs[0])
scene.render.use_compositing = True
scene.render.compositor_device = "CPU"
try: scene.render.compositor_denoise_device = "CPU"
except Exception as ex: print("denoise device", ex)

os.makedirs(OUT, exist_ok=True)
for i in range(N):
    if ONLY is not None and i not in ONLY: continue
    t0 = time.time()
    zs = pose(i / (N - 1) if N > 1 else 0.0)
    scene.render.filepath = os.path.join(OUT, "f%03d.png" % i)
    bpy.ops.render.render(write_still=True)
    print("frame", i, "scan z %.2f" % zs, round(time.time() - t0, 1), "s", flush=True)
