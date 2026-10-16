# Кадры сцены «имплант в кости» для первого экрана варианта 2 (Blender Cycles).
# Отрезок нижней челюсти со стороны щеки: по краям два своих моляра в десне, посередине десна и кость
# срезаны плоскостью, в кости стоит фикстура, сверху абатмент и коронка. Кадр 0: всё собрано;
# последний кадр: коронка и абатмент подняты над челюстью, фикстура остаётся в кости.
# Единицы: 1 = 1 мм, z = 0 на уровне платформы фикстуры и гребня кости.
# Запуск: python3 scripts/render/bone_seq.py <папка_кадров> 0 <samples> <w> <h> <число_кадров> [номера,через,запятую] [потоки]
import bpy, bmesh, math, sys, os, time
import numpy as np
from mathutils import Vector, Euler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
args = sys.argv[1:]
OUTDIR = args[0] if len(args) > 0 else "/tmp/bone"
SAMPLES = int(args[2]) if len(args) > 2 else 64
W = int(args[3]) if len(args) > 3 else 1000
H = int(args[4]) if len(args) > 4 else 1200
N = int(args[5]) if len(args) > 5 else 72
ONLY = [int(x) for x in args[6].split(",")] if len(args) > 6 and args[6] else None
THREADS = int(args[7]) if len(args) > 7 else 0

bpy.ops.wm.read_factory_settings(use_empty=True)
import implant_parts as P
scene = bpy.context.scene
ss = P.smoothstep

# ---------- профили челюсти (y: к щеке минус, к языку плюс; z вверх) ----------
X0 = 16.5            # отрезок челюсти по x от -X0 до X0
ZB = -16.0           # нижний срез
NOTCH = 5.6          # вырез в десне и кости над фикстурой: |x| < NOTCH, y < 0
FULLCUT = True       # срез по всей длине отрезка, как на картинке ChatGPT

def side_w(z, buccal, inset=0.0):
    s = ss(-2.5, -12.0, z)
    w = (4.5 + (1.9 if buccal else 1.1) * s) - inset
    return w

def bone_profile(inset=0.0, top=0.0, zb=ZB, n_side=40, n_cap=48):
    """Замкнутый контур сечения кости против часовой: щёчная сторона снизу вверх, гребень, язычная сверху вниз, низ."""
    zc = -2.6
    zt = top - inset * 1.3
    pts = []
    for z in np.linspace(zb, zc, n_side, endpoint=False):
        pts.append((-side_w(z, True, inset), z))
    wb, wl = side_w(zc, True, inset), side_w(zc, False, inset)
    p = 2.8
    for ph in np.linspace(math.pi, 0, n_cap):
        c, s = math.cos(ph), math.sin(ph)
        y = (wb if c < 0 else wl) * math.copysign(abs(c) ** (2 / p), c)
        z = zc + (zt - zc) * abs(s) ** (2 / p)
        pts.append((y, z))
    for z in np.linspace(zc, zb, n_side)[1:]:
        pts.append((side_w(z, False, inset), z))
    # низ: прямой срез обратно к началу
    for y in np.linspace(side_w(zb, False, inset), -side_w(zb, True, inset), 12)[1:-1]:
        pts.append((y, zb))
    return np.array(pts)

def offset_curve(c, t):
    """Сдвиг ломаной наружу (контур против часовой: наружу = вправо от хода)."""
    d = np.gradient(c, axis=0)
    d /= np.linalg.norm(d, axis=1)[:, None]
    nrm = np.stack([d[:, 1], -d[:, 0]], axis=1)
    return c + nrm * t[:, None]

def gum_profile(x):
    """Десна: полоса поверх кости от z = -6.5 по щёчной стороне через плоский широкий верх до z = -6.5 по язычной."""
    full = bone_profile(n_side=60, n_cap=80)
    zlow = -8.0
    idx = [i for i, (y, z) in enumerate(full) if z >= zlow and z > ZB + 1e-6]
    inner = full[idx[0]:idx[-1] + 1]
    # верх десны: у зубов 2.9 мм над гребнем, между зубами сосочки выше
    pap = math.exp(-((abs(x) - 5.45) / 1.4) ** 2) + math.exp(-((abs(x) - 16.4) / 1.4) ** 2)
    ztop = 2.9 + 0.9 * pap
    zc = -3.0
    outer = []
    for z in np.linspace(zlow, zc, 24, endpoint=False):
        outer.append((-(side_w(z, True) + 0.03 + 1.35 * float(ss(zlow, zc, z)) ** 1.6), z))
    wb, wl = side_w(zc, True) + 1.38, side_w(zc, False) + 1.0
    p = 3.6
    for ph in np.linspace(math.pi, 0, 64):
        c, s_ = math.cos(ph), math.sin(ph)
        y = (wb if c < 0 else wl) * math.copysign(abs(c) ** (2 / p), c)
        outer.append((y, zc + (ztop - zc) * abs(s_) ** (2 / p)))
    for z in np.linspace(zc, zlow, 25)[1:]:
        outer.append((side_w(z, False) + 0.03 + 0.97 * float(ss(zlow, zc, z)) ** 1.6, z))
    outer = np.array(outer)
    return np.concatenate([outer, inner[::-1]], axis=0)

def extrude(name, prof_fn, xs):
    """Тело по x из сечений prof_fn(x) -> (M, 2) [y, z], торцы n-угольниками."""
    bm = bmesh.new()
    rings = []
    for x in xs:
        pr = prof_fn(x)
        rings.append([bm.verts.new((x, float(y), float(z))) for y, z in pr])
    M = len(rings[0])
    for a, b in zip(rings[:-1], rings[1:]):
        for i in range(M):
            j = (i + 1) % M
            bm.faces.new((a[i], a[j], b[j], b[i]))
    for f in bm.faces: f.smooth = True
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    return ob

def box(name, x0, x1, y0, y1, z0, z1):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = x0 if v.co.x < 0 else x1; v.co.y = y0 if v.co.y < 0 else y1; v.co.z = z0 if v.co.z < 0 else z1
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    ob.hide_render = True; ob.hide_viewport = True
    return ob

def socket(name, ztop):
    """Ложе фикстуры: по сердцевине фикстуры, резьба уходит в кость; выше гребня шире, под абатмент."""
    zs = np.linspace(-P.L - 0.2, ztop, 120)
    r = []
    for z in zs:
        zz = z + P.L
        core = 1.08 + (1.72 - 1.08) * float(ss(0.9, 10.2, zz)) ** 0.9
        dome = math.sqrt(max(0.0, 1 - ((1.1 - zz) / 1.1) ** 2)) if zz < 1.1 else 1.0
        rr = core * (0.25 + 0.75 * dome) + 0.12
        if z > -0.75: rr = max(rr, 2.2)
        if z > 0.05: rr = 2.5
        r.append(max(rr, 0.3))
    Pm = P.lathe(r, zs, 96)
    ob = P.grid_mesh(name, Pm, cap_bottom=(0, 0, -P.L - 0.25), cap_top=(0, 0, ztop))
    ob.hide_render = True; ob.hide_viewport = True
    return ob

def cut(ob, cutter):
    m = ob.modifiers.new("cut_" + cutter.name, "BOOLEAN")
    m.operation = "DIFFERENCE"; m.object = cutter; m.solver = "EXACT"
    return m

xs = np.linspace(-X0, X0, 133)
bone_outer = extrude("bone", lambda x: bone_profile(), [-X0, X0])
spongy = extrude("spongy", lambda x: bone_profile(inset=1.05, top=0.0), [-X0, X0])
spongy_cutter = extrude("spongy_cutter", lambda x: bone_profile(inset=1.05, top=0.0, zb=ZB - 1.0), [-X0 - 1, X0 + 1])
spongy_cutter.hide_render = True; spongy_cutter.hide_viewport = True
gum = extrude("gum", gum_profile, xs)

nx = X0 + 1 if FULLCUT else NOTCH
notch = box("notch", -nx, nx, -30, 0, -40, 40)
sock = socket("socket", 6.0)
cut(bone_outer, spongy_cutter)
for o in (bone_outer, spongy, gum):
    cut(o, notch); cut(o, sock)

# ---------- материалы кости и десны ----------
def node(nt, kind, **kw):
    n = nt.nodes.new(kind)
    for k, v in kw.items(): n.inputs[k].default_value = v
    return n

def mat_cortical():
    m = bpy.data.materials.new("cortical"); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.55
    b.inputs["Subsurface Weight"].default_value = 0.15
    b.inputs["Subsurface Radius"].default_value = (1.0, 0.7, 0.5)
    b.inputs["Subsurface Scale"].default_value = 0.4
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = node(nt, "ShaderNodeTexNoise", Scale=1.6, Detail=8.0, Roughness=0.6)
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.56, 0.48, 0.37, 1)
    ramp.color_ramp.elements[1].color = (0.71, 0.64, 0.53, 1)
    nt.links.new(nz.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    fine = node(nt, "ShaderNodeTexNoise", Scale=40.0, Detail=6.0)
    nt.links.new(tc.outputs["Object"], fine.inputs["Vector"])
    bp = node(nt, "ShaderNodeBump", Strength=0.12, Distance=0.05)
    nt.links.new(fine.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m

def mat_spongy():
    """Губчатая кость: текстура среза из ChatGPT (tex/bone_spongy.jpg), проекция кубом в координатах объекта."""
    m = bpy.data.materials.new("spongy"); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.72
    b.inputs["Subsurface Weight"].default_value = 0.08
    b.inputs["Subsurface Radius"].default_value = (1.0, 0.6, 0.4)
    b.inputs["Subsurface Scale"].default_value = 0.3
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1 / 22.0, 1 / 22.0, 1 / 22.0)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    tex = nt.nodes.new("ShaderNodeTexImage"); tex.projection = "BOX"; tex.projection_blend = 0.2
    tex.image = bpy.data.images.load(os.path.join(os.path.dirname(os.path.abspath(__file__)), "tex", "bone_spongy.jpg"))
    nt.links.new(mp.outputs["Vector"], tex.inputs["Vector"])
    # чуть темнее и теплее, как губчатая кость в разрезе на картинке ChatGPT
    hsv = nt.nodes.new("ShaderNodeHueSaturation")
    hsv.inputs["Saturation"].default_value = 0.95; hsv.inputs["Value"].default_value = 0.93
    nt.links.new(tex.outputs["Color"], hsv.inputs["Color"])
    nt.links.new(hsv.outputs["Color"], b.inputs["Base Color"])
    bp = node(nt, "ShaderNodeBump", Strength=0.55, Distance=0.2)
    nt.links.new(tex.outputs["Color"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m

def mat_gum():
    m = bpy.data.materials.new("gum"); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.80, 0.17, 0.15, 1)
    b.inputs["Subsurface Weight"].default_value = 0.5
    b.inputs["Subsurface Radius"].default_value = (1.0, 0.35, 0.25)
    b.inputs["Subsurface Scale"].default_value = 0.35
    b.inputs["Roughness"].default_value = 0.42
    b.inputs["Coat Weight"].default_value = 0.12
    b.inputs["Coat Roughness"].default_value = 0.25
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = node(nt, "ShaderNodeTexNoise", Scale=9.0, Detail=8.0, Roughness=0.65)
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    bp = node(nt, "ShaderNodeBump", Strength=0.22, Distance=0.12)
    nt.links.new(nz.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m

def add_fade(m, z0=ZB + 0.5, z1=ZB + 6.5):
    """Низ отрезка челюсти плавно растворяется в фоне, без жёсткого нижнего края."""
    nt = m.node_tree
    out = nt.nodes["Material Output"]; bsdf = nt.nodes["Principled BSDF"]
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(geo.outputs["Position"], sep.inputs["Vector"])
    mr = nt.nodes.new("ShaderNodeMapRange"); mr.interpolation_type = "SMOOTHSTEP"
    mr.inputs["From Min"].default_value = z0; mr.inputs["From Max"].default_value = z1
    nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
    tr = nt.nodes.new("ShaderNodeHoldout")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(mr.outputs["Result"], mix.inputs["Fac"])
    nt.links.new(tr.outputs[0], mix.inputs[1]); nt.links.new(bsdf.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    return m

bone_outer.data.materials.append(add_fade(mat_cortical()))
spongy.data.materials.append(add_fade(mat_spongy()))
gum.data.materials.append(mat_gum())

# ---------- имплант и соседние зубы ----------
ti_sla = P.mat_ti("ti_sla", (0.50, 0.51, 0.52), 0.46, bump=0.35)
ti_pol = P.mat_ti("ti_polished", (0.78, 0.77, 0.75), 0.10)
ti_dark = P.mat_ti("ti_socket", (0.22, 0.22, 0.23), 0.35)
ti_abut = P.mat_ti("ti_abutment", (0.80, 0.79, 0.77), 0.22, aniso=0.35)
zr = P.mat_zirconia()

fx = P.fixture(); fx.data.materials.append(ti_sla); fx.data.materials.append(ti_pol); fx.data.materials.append(ti_dark)
fx.location = (0, 0, -P.L)
ab = P.abutment(); ab.data.materials.append(ti_abut)
cr = P.crown(); cr.data.materials.append(zr)
cr.rotation_euler = Euler((0, 0, math.radians(90)), "XYZ")  # длинная ось коронки вдоль дуги (x)

neigh = []
# шейки соседних зубов срезаны чуть глубже плоскости среза, чтобы не выходить на срез
neck_cut = box("neck_cut", -X0 - 2, X0 + 2, -30, 0.35, -40, 40)
dentin = bpy.data.materials.new("dentin"); dentin.use_nodes = True
_b = dentin.node_tree.nodes["Principled BSDF"]; _b.inputs["Base Color"].default_value = (0.72, 0.60, 0.42, 1); _b.inputs["Roughness"].default_value = 0.5
for sx, rz, sc_ in ((-10.9, 270, 1.0), (10.9, 92, 0.97)):
    me = cr.data.copy()
    o = bpy.data.objects.new("tooth", me); bpy.context.collection.objects.link(o)
    o.location = (sx, 0, 1.55); o.rotation_euler = Euler((0, 0, math.radians(rz)), "XYZ"); o.scale = (sc_, sc_, sc_)
    neigh.append(o)
    # шейка зуба под десной, чтобы снизу коронки не было пустоты
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=64, radius1=3.0, radius2=3.7, depth=6.0)
    for v in bm.verts: v.co.y *= 0.92; v.co.z += -1.2
    nme = bpy.data.meshes.new("neck"); bm.to_mesh(nme); bm.free()
    nk = bpy.data.objects.new("neck", nme); bpy.context.collection.objects.link(nk)
    nk.location = (sx, 0, 0); nk.data.materials.append(dentin)
    cut(nk, neck_cut)

# ---------- свет ----------
world = bpy.data.worlds.new("w"); scene.world = world; world.use_nodes = True
bg = world.node_tree.nodes["Background"]; bg.inputs["Color"].default_value = (0.006, 0.02, 0.01, 1); bg.inputs["Strength"].default_value = 1.0
A, aim = P.area, P.aim
k = A("key", (-110, -170, 130), (0, 0, 0), 110, 1.0e6, (1.0, 0.98, 0.95)); aim(k, (0, 0, 0))
ff = A("front", (50, -200, 60), (0, 0, 0), 80, 2.2e5, (1.0, 0.99, 0.97)); aim(ff, (0, 0, -2))
s1 = A("stripL", (-110, 120, 20), (0, 0, 0), 9, 7.5e5, (0.92, 0.97, 1.0), sy=180); aim(s1, (0, 0, 0))
s2 = A("stripR", (120, 110, 30), (0, 0, 0), 9, 8.0e5, (0.92, 0.97, 1.0), sy=180); aim(s2, (0, 0, 0))
tp = A("top", (20, 10, 160), (0, 0, 0), 60, 8.0e4, (1, 1, 1)); aim(tp, (0, 0, 5))
gb = A("green", (10, 140, -40), (0, 0, 0), 100, 1.2e5, (0.3, 0.9, 0.35)); aim(gb, (0, 0, -5))
card = A("card", (0, -280, 90), (0, 0, 0), 180, 1.4e5, (1.0, 1.0, 1.0)); aim(card, (0, 0, 4))
fill = A("fill", (150, -130, 40), (0, 0, 0), 100, 3.0e4, (0.85, 0.95, 0.9)); aim(fill, (0, 0, 0))

# ---------- поза ----------
cam_d = bpy.data.cameras.new("cam"); cam_d.lens = 120; cam_d.sensor_width = 36
cam = bpy.data.objects.new("cam", cam_d); bpy.context.collection.objects.link(cam)
scene.camera = cam

def ease(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)

def pose(t):
    ec = ease(t / 0.8)            # коронка уходит первой
    ea = ease((t - 0.18) / 0.82)  # абатмент следом
    ab.location = (0, 0, 7.0 * ea)
    cr.location = (0, 0, 1.9 + 7.0 * ea + 8.0 * ec)
    cr.rotation_euler = Euler((math.radians(-8 * ec), 0, math.radians(90 + 14 * ec)), "XYZ")
    az = math.radians(-24 + 12 * ease(t))
    el = math.radians(15 - 4 * ease(t))
    dist = 172
    tz = -1.5 + 5.5 * ec
    cam.location = (dist * math.cos(el) * math.sin(az), -dist * math.cos(el) * math.cos(az), tz + dist * math.sin(el))
    aim(cam, (0, 0, tz))

# ---------- рендер ----------
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = SAMPLES
scene.cycles.use_adaptive_sampling = True
scene.cycles.use_denoising = True
try: scene.cycles.denoiser = "OPENIMAGEDENOISE"
except Exception as ex: print("denoiser", ex)
scene.cycles.max_bounces = 8; scene.cycles.glossy_bounces = 6; scene.cycles.transparent_max_bounces = 16
scene.render.film_transparent = True
scene.render.resolution_x = W; scene.render.resolution_y = H; scene.render.resolution_percentage = 100
scene.view_settings.view_transform = "AgX"
scene.view_settings.exposure = -0.35
try: scene.view_settings.look = "AgX - Medium High Contrast"
except Exception as ex: print("look", ex)
scene.render.image_settings.file_format = "PNG"; scene.render.image_settings.color_mode = "RGBA"
if THREADS:
    scene.render.threads_mode = "FIXED"; scene.render.threads = THREADS

os.makedirs(OUTDIR, exist_ok=True)
for i in range(N):
    if ONLY is not None and i not in ONLY: continue
    t0 = time.time()
    pose(i / (N - 1) if N > 1 else 0.0)
    scene.render.filepath = os.path.join(OUTDIR, "f%03d.png" % i)
    bpy.ops.render.render(write_still=True)
    print("frame", i, round(time.time() - t0, 1), "s", flush=True)
