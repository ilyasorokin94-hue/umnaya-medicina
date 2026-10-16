# Кадры первого экрана варианта 2: имплант в Blender (Cycles), фикстура с настоящей резьбой, абатмент, коронка моляра.
# Единицы: 1 = 1 мм. Нужен Blender как модуль Python: python3 -m pip install bpy (5.2, Python 3.13).
# Запуск: python3 scripts/render/implant_seq.py <папка_кадров> 0 <samples> <w> <h> <число_кадров> [номера,через,запятую]
# Сайт: python3 scripts/render/implant_seq.py /tmp/seq 0 64 1000 1200 96
#       python3 scripts/render/frames_to_webp.py /tmp/seq src/images/implant 96  (печатает data-crop для build.mjs)
import bpy, bmesh, math, sys
import numpy as np
from mathutils import Vector, Euler

args = sys.argv[1:]
OUT = args[0] if len(args) > 0 else "/tmp/implant.png"
T = float(args[1]) if len(args) > 1 else 0.0     # 0 = собран, 1 = разобран
SAMPLES = int(args[2]) if len(args) > 2 else 64
W = int(args[3]) if len(args) > 3 else 1000
H = int(args[4]) if len(args) > 4 else 1300

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)

def grid_mesh(name, P, close_u=True, cap_bottom=None, cap_top=None):
    """P: массив (nv, nu, 3), u по кругу (замкнуто), v снизу вверх."""
    nv, nu, _ = P.shape
    verts = P.reshape(-1, 3).tolist()
    faces = []
    uu = nu if close_u else nu - 1
    for j in range(nv - 1):
        for i in range(uu):
            a = j * nu + i; b = j * nu + (i + 1) % nu
            c = (j + 1) * nu + (i + 1) % nu; d = (j + 1) * nu + i
            faces.append((a, b, c, d))
    if cap_bottom is not None:
        verts.append(cap_bottom); ci = len(verts) - 1
        for i in range(nu):
            faces.append((ci, (i + 1) % nu, i))
    if cap_top is not None:
        verts.append(cap_top); ci = len(verts) - 1
        base = (nv - 1) * nu
        for i in range(nu):
            faces.append((ci, base + i, base + (i + 1) % nu))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob

def lathe(profile_r, profile_z, nu, rfun=None):
    """Тело вращения по профилю; rfun(theta, r, z) правит радиус (лыска, шестигранник)."""
    th = np.linspace(0, 2 * np.pi, nu, endpoint=False)
    R = np.array(profile_r)[:, None] * np.ones((1, nu))
    Z = np.array(profile_z)[:, None] * np.ones((1, nu))
    TH = np.ones((len(profile_r), 1)) * th[None, :]
    if rfun is not None: R = rfun(TH, R, Z)
    return np.stack([R * np.cos(TH), R * np.sin(TH), Z], axis=-1)

# ---------- фикстура ----------
L = 11.5; COLLAR = 10.7
def fixture():
    nu, nv = 288, 1100
    z = np.linspace(0, L, nv)
    th = np.linspace(0, 2 * np.pi, nu, endpoint=False)
    Z, TH = np.meshgrid(z, th, indexing="ij")
    # сердцевина: конус с куполом на апексе
    core = 1.08 + (1.72 - 1.08) * smoothstep(0.9, 10.2, Z) ** 0.9
    dome = np.where(Z < 1.1, np.sqrt(np.clip(1 - ((1.1 - Z) / 1.1) ** 2, 0, 1)), 1.0)
    core = core * (0.25 + 0.75 * dome)
    # двухзаходная резьба, шаг между вершинами 0.8 мм
    p = 0.8; leads = 2
    u = np.mod(Z / p - leads * TH / (2 * np.pi), 1.0)
    # профиль витка: пологий верхний бок, крутой нижний, скруглённая вершина
    f = np.where(u < 0.42, smoothstep(0.0, 0.42, u), 1 - smoothstep(0.50, 0.80, u))
    f = f ** 1.15
    h = 0.46 * smoothstep(0.25, 2.2, Z) * (1 - smoothstep(9.6, 10.45, Z))
    r = core + h * f
    # три режущие канавки у апекса
    g = np.maximum(0, np.cos(3 * (TH - 0.4))) ** 10
    depth = 0.55 * (1 - smoothstep(0.4, 3.6, Z))
    r = r - depth * g * (h + 0.35)
    # гладкая шейка
    collar_r = 2.18 - 0.08 * smoothstep(L - 0.25, L, Z)
    r = np.where(Z > COLLAR, collar_r, np.where(Z > 10.3, np.maximum(r, core + (collar_r - core) * smoothstep(10.3, COLLAR, Z)), r))
    P = np.stack([r * np.cos(TH), r * np.sin(TH), Z], axis=-1)
    ob = grid_mesh("fixture", P, cap_bottom=(0, 0, 0))
    # платформа и внутреннее отверстие под абатмент
    me = ob.data
    bm = bmesh.new(); bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    top = [bm.verts[(nv - 1) * nu + i] for i in range(nu)]
    ring1 = []; ring2 = []; ring3 = []
    for i, v in enumerate(top):
        a = th[i]
        ring1.append(bm.verts.new((1.32 * math.cos(a), 1.32 * math.sin(a), L)))
        ring2.append(bm.verts.new((1.22 * math.cos(a), 1.22 * math.sin(a), L - 2.4)))
    c = bm.verts.new((0, 0, L - 2.6))
    for i in range(nu):
        j = (i + 1) % nu
        bm.faces.new((top[i], top[j], ring1[j], ring1[i]))
        bm.faces.new((ring1[i], ring1[j], ring2[j], ring2[i]))
        bm.faces.new((ring2[i], ring2[j], c))
    bm.to_mesh(me); bm.free()
    for poly in me.polygons:
        poly.use_smooth = True
        zc = poly.center.z
        poly.material_index = 1 if zc > COLLAR - 0.02 else 0
    return ob

# ---------- абатмент ----------
def abutment():
    # профиль снизу вверх: шестигранник, конус соединения, десневая манжета, головка
    pr = []; pz = []
    def seg(r0, z0, r1, z1, n):
        for k in range(n):
            t = k / n
            pr.append(r0 + (r1 - r0) * t); pz.append(z0 + (z1 - z0) * t)
    # z = 0 на уровне платформы фикстуры
    seg(0.0, -2.4, 0.86, -2.4, 6)
    seg(0.90, -2.38, 0.92, -1.7, 10)        # шестигранник
    seg(0.98, -1.62, 1.26, 0.0, 30)         # конус
    # манжета: вогнутый профиль 2.05 -> 2.45
    for k in range(40):
        t = k / 40
        pr.append(2.05 + 0.4 * t ** 1.8 - 0.05 * math.sin(math.pi * t)); pz.append(0.02 + 2.0 * t)
    seg(2.45, 2.02, 2.05, 2.25, 8)          # уступ под коронку
    seg(2.0, 2.3, 1.72, 7.4, 60)            # головка с конусом
    # скругление верха и отверстие под винт
    for k in range(16):
        a = (k / 16) * math.pi / 2
        pr.append(1.42 + 0.3 * math.cos(a)); pz.append(7.4 + 0.3 * math.sin(a))
    seg(1.42, 7.7, 0.72, 7.7, 8)
    seg(0.68, 7.66, 0.62, 5.0, 20)
    pr.append(0.0); pz.append(4.95)
    def rfun(TH, R, Z):
        # шестигранник у основания
        hexr = 0.86 / np.cos(np.mod(TH, np.pi / 3) - np.pi / 6)
        R = np.where((Z > -2.39) & (Z < -1.66), np.minimum(R * 1.12, hexr), R)
        # лыска на головке
        flat = 1.5 / np.maximum(np.cos(TH - 0.0), 1e-3)
        R = np.where((Z > 2.6) & (Z < 7.75) & (np.cos(TH) > 0), np.minimum(R, flat), R)
        return R
    P = lathe(pr, pz, 256, rfun)
    return grid_mesh("abutment", P)

# ---------- винт ----------
def screw():
    nu, nv = 160, 500
    z = np.linspace(-6.0, 1.0, nv)
    th = np.linspace(0, 2 * np.pi, nu, endpoint=False)
    Z, TH = np.meshgrid(z, th, indexing="ij")
    core = np.full_like(Z, 0.62)
    u = np.mod(Z / 0.35 - TH / (2 * np.pi), 1.0)
    f = np.where(u < 0.5, smoothstep(0, 0.5, u), 1 - smoothstep(0.5, 1, u))
    thr = (Z < -2.6) * smoothstep(-5.95, -5.6, Z)
    r = core + 0.16 * f * thr
    r = np.where(Z < -5.9, 0.62 * np.sqrt(np.clip(1 - ((Z + 5.9) / 0.1) ** 2, 0.05, 1)), r)
    head = smoothstep(0.0, 0.08, Z)
    r = r + (0.98 - 0.62) * head
    r = np.where(Z > 0.9, 0.98 - 0.25 * smoothstep(0.9, 1.0, Z), r)
    P = np.stack([r * np.cos(TH), r * np.sin(TH), Z], axis=-1)
    return grid_mesh("screw", P, cap_bottom=(0, 0, -6.0), cap_top=(0, 0, 1.0))

# ---------- коронка моляра ----------
def crown():
    # тело: суперэллипсоид (сечение скруглённый прямоугольник, профиль «яблоко»),
    # окклюзионная поверхность: четыре бугра и фиссуры крестом
    nu, nv = 320, 260
    om = np.linspace(-np.pi, np.pi, nu, endpoint=False)
    eta = np.linspace(-0.98, np.pi / 2, nv)
    ETA, OM = np.meshgrid(eta, om, indexing="ij")
    def C(w, e): return np.sign(np.cos(w)) * np.abs(np.cos(w)) ** e
    def S(w, e): return np.sign(np.sin(w)) * np.abs(np.sin(w)) ** e
    a, b, c = 5.15, 4.8, 4.1
    e1, e2 = 0.86, 0.6
    neck = 0.74 + 0.26 * smoothstep(-0.98, -0.1, ETA)
    X = a * C(ETA, e1) * C(OM, e2) * neck
    Y = b * C(ETA, e1) * S(OM, e2) * neck
    Z = c * S(ETA, e1)
    top = smoothstep(0.35, 1.25, ETA)
    cusps = ((2.25, 2.05, 1.0), (-2.2, 2.0, 0.92), (2.3, -2.0, 0.85), (-2.15, -2.05, 0.8), (0.0, 2.6, 0.35))
    bump = np.zeros_like(X)
    for cx, cy, amp in cusps:
        bump += amp * np.exp(-(((X - cx) / 1.75) ** 2 + ((Y - cy) / 1.6) ** 2))
    groove = np.exp(-(Y / 0.42) ** 2) * smoothstep(4.4, 1.0, np.abs(X)) + 0.8 * np.exp(-(X / 0.38) ** 2) * smoothstep(4.0, 0.8, np.abs(Y))
    pit = np.exp(-((X / 0.9) ** 2 + (Y / 0.9) ** 2))
    Z = Z + top * (1.35 * bump - 0.9 * groove - 0.35 * pit) - 0.6 * top
    # лёгкая неидеальность формы
    Z = Z + 0.05 * np.sin(2.3 * X + 1.1) * np.cos(1.7 * Y) * top
    X = X * (1 + 0.02 * np.sin(OM * 3 + 0.4))
    Z = Z - Z.min()
    P = np.stack([X, Y, Z], axis=-1)
    ob = grid_mesh("crown", P)
    me = ob.data
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    bot = [bm.verts[i] for i in range(nu)]
    inner = [bm.verts.new((2.1 * math.cos(w), 2.1 * math.sin(w), 0.3)) for w in om]
    cc = bm.verts.new((0, 0, 5.0))
    for i in range(nu):
        j = (i + 1) % nu
        bm.faces.new((bot[j], bot[i], inner[i], inner[j]))
        bm.faces.new((inner[j], inner[i], cc))
    bm.to_mesh(me); bm.free()
    for poly in me.polygons: poly.use_smooth = True
    return ob

# ---------- материалы ----------
def mat_ti(name, base, rough, bump=0.0, aniso=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*base, 1)
    b.inputs["Metallic"].default_value = 1.0
    b.inputs["Roughness"].default_value = rough
    if aniso: b.inputs["Anisotropic"].default_value = aniso
    if bump:
        nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 260; nz.inputs["Detail"].default_value = 6
        bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = bump; bp.inputs["Distance"].default_value = 0.02
        nt.links.new(nz.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
        # шероховатость гуляет вместе с рельефом SLA
        mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs["To Min"].default_value = rough - 0.08; mr.inputs["To Max"].default_value = rough + 0.08
        nt.links.new(nz.outputs["Fac"], mr.inputs["Value"]); nt.links.new(mr.outputs["Result"], b.inputs["Roughness"])
    return m

def mat_zirconia():
    m = bpy.data.materials.new("zirconia"); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.80, 0.765, 0.68, 1)
    b.inputs["Subsurface Weight"].default_value = 0.22
    b.inputs["Subsurface Radius"].default_value = (1.0, 0.55, 0.35)
    b.inputs["Subsurface Scale"].default_value = 0.6
    b.inputs["Roughness"].default_value = 0.3
    b.inputs["Coat Weight"].default_value = 0.55
    b.inputs["Coat Roughness"].default_value = 0.06
    # к вершинам бугров эмаль чуть прозрачнее и холоднее
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Position"], sep.inputs["Vector"])
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = 4.5; mr.inputs["From Max"].default_value = 7.6
    nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
    mix.inputs[6].default_value = (0.80, 0.765, 0.68, 1)
    mix.inputs[7].default_value = (0.76, 0.76, 0.74, 1)
    nt.links.new(mr.outputs["Result"], mix.inputs["Factor"])
    ao = nt.nodes.new("ShaderNodeAmbientOcclusion"); ao.inputs["Distance"].default_value = 0.8; ao.samples = 16
    mix2 = nt.nodes.new("ShaderNodeMix"); mix2.data_type = "RGBA"
    nt.links.new(ao.outputs["AO"], mix2.inputs["Factor"])
    mix2.inputs[6].default_value = (0.52, 0.44, 0.33, 1)
    nt.links.new(mix.outputs[2], mix2.inputs[7])
    nt.links.new(mix2.outputs[2], b.inputs["Base Color"])
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 40; nz.inputs["Detail"].default_value = 4
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.05; bp.inputs["Distance"].default_value = 0.05
    nt.links.new(nz.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m

ti_sla = mat_ti("ti_sla", (0.50, 0.51, 0.52), 0.46, bump=0.35)
ti_pol = mat_ti("ti_polished", (0.78, 0.77, 0.75), 0.10)
ti_abut = mat_ti("ti_abutment", (0.80, 0.79, 0.77), 0.14, aniso=0.35)
zr = mat_zirconia()

fx = fixture(); fx.data.materials.append(ti_sla); fx.data.materials.append(ti_pol)
ab = abutment(); ab.data.materials.append(ti_abut)
sc = screw(); sc.data.materials.append(ti_pol)
cr = crown(); cr.data.materials.append(zr)

# ---------- свет и камера ----------
world = bpy.data.worlds.new("w"); scene.world = world; world.use_nodes = True
bg = world.node_tree.nodes["Background"]; bg.inputs["Color"].default_value = (0.006, 0.02, 0.01, 1); bg.inputs["Strength"].default_value = 1.0

def area(name, loc, rot, size, power, color=(1, 1, 1), shape="RECTANGLE", sy=None):
    ld = bpy.data.lights.new(name, "AREA"); ld.shape = shape; ld.size = size
    if sy: ld.size_y = sy
    ld.energy = power; ld.color = color
    ob = bpy.data.objects.new(name, ld); bpy.context.collection.objects.link(ob)
    ob.location = loc; ob.rotation_euler = Euler([math.radians(a) for a in rot], "XYZ")
    return ob

def aim(ob, target=(0, 0, 3)):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

k = area("key", (-70, -60, 50), (0, 0, 0), 55, 2.4e5, (1.0, 0.98, 0.95)); aim(k)
s1 = area("stripL", (-50, 60, 8), (0, 0, 0), 5, 2.2e5, (0.92, 0.97, 1.0), sy=100); aim(s1, (0, 0, 2))
s2 = area("stripR", (55, 55, 12), (0, 0, 0), 5, 2.4e5, (0.92, 0.97, 1.0), sy=100); aim(s2, (0, 0, 2))
sf = area("stripF", (-40, -50, 0), (0, 0, 0), 4, 0.6e5, (1.0, 1.0, 1.0), sy=90); aim(sf, (0, 0, 2))
tp = area("top", (10, 10, 80), (0, 0, 0), 30, 4.0e4, (1, 1, 1)); aim(tp, (0, 0, 8))
gb = area("green", (10, 70, -10), (0, 0, 0), 50, 3.5e4, (0.3, 0.9, 0.35)); aim(gb, (0, 0, 0))
fill = area("fill", (70, -60, 20), (0, 0, 0), 50, 0.8e4, (0.85, 0.95, 0.9)); aim(fill)


# ---------- поза по параметру прокрутки ----------
root = bpy.data.objects.new("root", None); bpy.context.collection.objects.link(root)
for o in (fx, ab, sc, cr): o.parent = root
sc.hide_render = True
cam_d = bpy.data.cameras.new("cam"); cam_d.lens = 135; cam_d.sensor_width = 36
cam = bpy.data.objects.new("cam", cam_d); bpy.context.collection.objects.link(cam)
scene.camera = cam

def ease(x): return x * x * (3 - 2 * x)

def pose(t):
    """t = 0: собран, вид 3/4; t = 1: разобран и повернут."""
    e = ease(min(1.0, t / 0.8))
    fx.location = (0, 0, -L)
    ab.location = (0, 0, 4.4 * e)
    cr.location = (0, 0, 1.9 + 13.5 * e)
    root.rotation_euler = Euler((0, 0, math.radians(-28 + 96 * ease(t))), "XYZ")
    cr.rotation_euler = Euler((math.radians(-16 * e), math.radians(6 * e), 0), "XYZ")
    ab.rotation_euler = Euler((math.radians(7 * e), 0, 0), "XYZ")
    fx.rotation_euler = Euler((math.radians(-3 * e), 0, 0), "XYZ")
    elev = math.radians(17 - 7 * ease(t))
    dist = 128 + 44 * e
    cz = -1.1 + 6.6 * e
    cam.location = (0, -dist * math.cos(elev), cz + dist * math.sin(elev))
    aim(cam, (0, 0, cz))

# ---------- рендер ----------
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = SAMPLES
scene.cycles.use_adaptive_sampling = True
scene.cycles.use_denoising = True
try: scene.cycles.denoiser = "OPENIMAGEDENOISE"
except Exception as ex: print("denoiser", ex)
scene.cycles.max_bounces = 8; scene.cycles.glossy_bounces = 6
scene.render.film_transparent = True
scene.render.resolution_x = W; scene.render.resolution_y = H; scene.render.resolution_percentage = 100
scene.view_settings.view_transform = "AgX"
try: scene.view_settings.look = "AgX - Medium High Contrast"
except Exception as ex: print("look", ex)
scene.render.image_settings.file_format = "PNG"; scene.render.image_settings.color_mode = "RGBA"
scene.render.filepath = OUT
scene.render.threads_mode = "AUTO"

import time, os
OUTDIR = OUT
os.makedirs(OUTDIR, exist_ok=True)
N = int(args[5]) if len(args) > 5 else 60
ONLY = [int(x) for x in args[6].split(",")] if len(args) > 6 and args[6] else None
for i in range(N):
    if ONLY is not None and i not in ONLY: continue
    t0 = time.time()
    pose(i / (N - 1))
    scene.render.filepath = os.path.join(OUTDIR, "f%03d.png" % i)
    bpy.ops.render.render(write_still=True)
    print("frame", i, round(time.time() - t0, 1), "s", flush=True)
