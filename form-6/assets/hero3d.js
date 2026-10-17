// Первый экран главной: имплант в томографе. Плоскость сканирования ходит вверх и вниз:
// ниже неё имплант виден целиком, выше остаётся рентгеновский контур, а срез светится.
// При загрузке детали съезжаются, за курсором модель поворачивается, при прокрутке разъезжается на детали.
// Геометрия строится кодом, без моделей и картинок. Если WebGL нет, остаётся статичный кадр-постер.
import * as THREE from "./vendor/three.module.min.js";
import { RoomEnvironment } from "./vendor/RoomEnvironment.js";

const box = document.querySelector(".hero__3d");
const canvas = box && box.querySelector("canvas");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const SCAN = new THREE.Color(0x6fe07a);

if (canvas) {
  try { start(); } catch (e) { box.classList.add("is-static"); }
}

function start() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  const phone = matchMedia("(max-width: 760px)").matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, phone ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
  const look = new THREE.Vector3(0, 0.12, 0);

  const key = new THREE.DirectionalLight(0xffffff, 2); key.position.set(-4, 6, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x5fd36a, 3); rim.position.set(5, 2, -4); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xcfe8d2, 0.5); fill.position.set(3, -3, 6); scene.add(fill);

  // срез: ниже плоскости деталь целая, выше только контур
  const below = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const above = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const scan = { value: 0 };

  // у целой детали полоска у среза подсвечена цветом сканера
  const solid = (m) => {
    m.clippingPlanes = [below];
    m.onBeforeCompile = (s) => {
      s.uniforms.uScan = scan;
      s.vertexShader = s.vertexShader.replace("#include <common>", "#include <common>\nvarying float vWY;").replace("#include <project_vertex>", "#include <project_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;");
      s.fragmentShader = s.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uScan;\nvarying float vWY;").replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.44, 0.88, 0.48) * 2.4 * smoothstep(0.08, 0.0, uScan - vWY);");
    };
    return m;
  };
  const titanium = solid(new THREE.MeshStandardMaterial({ color: 0xc9ced3, metalness: 1, roughness: 0.3, envMapIntensity: 1.1 }));
  const gold = solid(new THREE.MeshStandardMaterial({ color: 0xd8b378, metalness: 1, roughness: 0.26, envMapIntensity: 1.05 }));
  const ceramic = solid(new THREE.MeshPhysicalMaterial({ color: 0xf1ece2, metalness: 0, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25, sheen: 0.3, sheenColor: new THREE.Color(0xfff3e0), sheenRoughness: 0.7, envMapIntensity: 0.8 }));

  // сечение: изнанка детали под срезом заливается ровным светом, как срез на томограмме
  const cap = (hex) => new THREE.MeshBasicMaterial({ color: hex, side: THREE.BackSide, clippingPlanes: [below], toneMapped: false });

  // рентгеновский контур выше среза: светятся края, середина почти прозрачная
  const ghost = new THREE.ShaderMaterial({
    uniforms: { uScan: scan, uColor: { value: SCAN }, uAlpha: { value: 1 } },
    vertexShader: `
      #include <common>
      #include <clipping_planes_pars_vertex>
      varying vec3 vN; varying vec3 vV; varying float vWY;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWY = wp.y;
        vec4 mvPosition = viewMatrix * wp;
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
        #include <clipping_planes_vertex>
      }`,
    fragmentShader: `
      #include <clipping_planes_pars_fragment>
      uniform vec3 uColor; uniform float uScan; uniform float uAlpha;
      varying vec3 vN; varying vec3 vV; varying float vWY;
      void main() {
        #include <clipping_planes_fragment>
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float rim = pow(f, 2.4);
        float near = exp(-(vWY - uScan) * 1.6);
        float a = (0.04 + rim * 0.8) * (0.45 + 0.55 * near) * uAlpha;
        a = min(a, 1.0);
        gl_FragColor = vec4(uColor * a, a);
      }`,
    transparent: true, premultipliedAlpha: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    clipping: true, clippingPlanes: [above],
  });

  const model = new THREE.Group();
  scene.add(model);

  // каждая деталь: целая часть, её сечение и рентгеновский контур
  const part = (geo, mat, capHex) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, mat), new THREE.Mesh(geo, cap(capHex)), new THREE.Mesh(geo, ghost));
    model.add(g);
    return g;
  };
  // винт: конусный стержень с винтовой резьбой, острая вершина внизу
  const fixture = part(screwGeometry(), titanium, 0x9fb0b8);
  // абатмент: десневая манжета и конус под коронку
  const abutment = part(lathe([[0.001, 0], [0.34, 0], [0.4, 0.05], [0.42, 0.17], [0.35, 0.25], [0.3, 0.3], [0.27, 0.82], [0.22, 0.98], [0.001, 1.02]], 72), gold, 0xe3c48a);
  // коронка жевательного зуба: чуть квадратная в плане, сверху четыре пологих бугра и борозды
  const crown = part(crownGeometry(), ceramic, 0xbdf2c4);

  // кольцо сканера идёт вместе со срезом
  const ring = new THREE.Group();
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.ShaderMaterial({
    uniforms: { uColor: { value: SCAN }, uAlpha: { value: 1 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `
      uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv;
      void main() {
        float r = length(vUv - 0.5) * 4.0;
        float band = exp(-pow((r - 1.18) / 0.035, 2.0));
        float glow = exp(-pow((r - 1.18) / 0.2, 2.0)) * 0.22;
        float disc = smoothstep(1.2, 0.0, r) * 0.07;
        float a = min(1.0, (band + glow + disc) * uAlpha);
        gl_FragColor = vec4(uColor * a, a);
      }`,
    transparent: true, premultipliedAlpha: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  halo.rotation.x = -Math.PI / 2;
  ring.add(halo);
  scene.add(ring);

  // положения деталей: собранный имплант и разъехавшийся (при прокрутке)
  const parts = [
    { m: crown, y: 0.75, ex: 0.95, rx: 0.22, rz: 0.1, intro: 2.2 },
    { m: abutment, y: 0.5, ex: 0.42, rx: -0.1, rz: -0.12, intro: 1.2 },
    { m: fixture, y: -1.62, ex: -0.4, rx: 0.04, rz: 0.06, intro: -1.2 },
  ];
  parts.forEach((p) => (p.m.position.y = p.y));

  // холст выше блока на пятую часть, чтобы при разлёте коронка не упиралась в край
  const size = () => {
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (!cw || !ch) return;
    renderer.setSize(cw, ch, false);
    camera.aspect = cw / ch;
    // модель всегда целиком в кадре: по высоте или по ширине, что теснее
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const k = ch / Math.max(1, box.clientHeight);
    const dist = Math.max((4.9 * k) / (2 * t), 3.1 / (2 * t * camera.aspect));
    camera.position.set(0, look.y + dist * 0.16, dist);
    camera.lookAt(look);
    camera.updateProjectionMatrix();
  };
  size();
  new ResizeObserver(size).observe(box);

  // сборка при появлении: детали съезжаются, срез поднимается снизу и проявляет имплант
  const intro = { t: reduce ? 1 : 0, s: reduce ? 1 : 0 };
  const G = window.gsap;
  if (G && !reduce) {
    G.to(intro, { t: 1, duration: 2.2, ease: "expo.out", delay: 0.3 });
    G.to(intro, { s: 1, duration: 3.2, ease: "power2.inOut", delay: 0.2 });
  } else { intro.t = 1; intro.s = 1; }

  // курсор и прокрутка
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!phone) addEventListener("pointermove", (e) => { pointer.tx = e.clientX / innerWidth - 0.5; pointer.ty = e.clientY / innerHeight - 0.5; }, { passive: true });
  const hero = box.closest(".hero");
  const scrollP = () => {
    if (!hero) return 0;
    const r = hero.getBoundingClientRect();
    return Math.min(1, Math.max(0, -r.top / (r.height * 0.8)));
  };

  let visible = true, raf = 0;
  const t0 = performance.now();
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible && !raf) loop(); }, { rootMargin: "80px" }).observe(box);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && visible && !raf) loop(); });

  const ease = (x) => 1 - Math.pow(1 - x, 3);
  function frame(now) {
    const time = (now - t0) / 1000;
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    const sp = ease(scrollP());
    const it = intro.t;
    parts.forEach((p) => {
      p.m.position.y = p.y + (1 - it) * p.intro + sp * p.ex;
      p.m.rotation.x = p.rx * (sp + (1 - it));
      p.m.rotation.z = p.rz * (sp + (1 - it));
    });
    // срез медленно ходит от винта до коронки; при сборке поднимается снизу
    const idle = reduce ? 1.25 : 0.45 + 1.2 * Math.sin(time * 0.42 - 0.4);
    const y = -2.6 + (idle + 2.6) * intro.s;
    scan.value = y;
    below.constant = y;
    above.constant = -y;
    ring.position.y = y;
    const spin = reduce ? 0 : time * 0.2;
    model.rotation.y = -0.6 + spin + pointer.x * 0.7 + sp * 1.1;
    model.rotation.x = 0.06 + pointer.y * 0.3;
    model.position.y = reduce ? 0 : Math.sin(time * 0.9) * 0.04;
    renderer.render(scene, camera);
  }
  function loop() {
    raf = 0;
    if (!visible || document.hidden) return;
    frame(performance.now());
    raf = requestAnimationFrame(loop);
  }
  loop();
  box.classList.add("is-live");
}

// тело вращения по профилю [радиус, высота]
function lathe(profile, seg = 64) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  g.computeVertexNormals();
  return g;
}

// винтовая резьба: радиус зависит от высоты и угла, поэтому витки идут по спирали
function screwGeometry() {
  const U = 120, V = 380, len = 2.2, pitch = 0.15;
  const pos = [], idx = [];
  for (let j = 0; j <= V; j++) {
    const v = j / V, y = v * len;
    // сердцевина сужается к низу, резьба гаснет у шейки и у вершины
    const core = 0.29 - 0.1 * Math.pow(1 - v, 1.6);
    const tip = Math.min(1, v / 0.07);
    const collar = v > 0.9 ? Math.max(0, 1 - (v - 0.9) / 0.04) : 1;
    const amp = 0.07 * tip * collar;
    for (let i = 0; i <= U; i++) {
      const a = (i / U) * Math.PI * 2;
      const ph = (y / pitch - a / (Math.PI * 2)) % 1;
      const f = ph < 0 ? ph + 1 : ph;
      const tooth = f < 0.5 ? f / 0.5 : (1 - f) / 0.5;
      let r = (core + amp * Math.pow(tooth, 0.7)) * Math.max(0.12, tip);
      if (v > 0.93) r = 0.35 + (v - 0.93) * 0.3;
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
    }
  }
  for (let j = 0; j < V; j++) for (let i = 0; i < U; i++) {
    const a = j * (U + 1) + i, b = a + U + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  // донышко и верхняя площадка
  const top = new THREE.CircleGeometry(0.37, 48); top.rotateX(-Math.PI / 2); top.translate(0, len + 0.021, 0);
  const merged = mergeGeometries([g, top]);
  merged.computeVertexNormals();
  return merged;
}

// коронка: профиль жевательного зуба, план чуть квадратный, сверху четыре пологих бугра, ямка и борозды
function crownGeometry() {
  const prof = [[0.001, 0.02], [0.3, 0], [0.37, 0.02], [0.47, 0.12], [0.6, 0.32], [0.68, 0.52], [0.7, 0.68], [0.67, 0.82], [0.6, 0.92], [0.5, 0.98], [0.38, 1.0], [0.2, 0.99], [0.001, 0.98]];
  const pts = [];
  for (let i = 0; i < prof.length - 1; i++) for (let k = 0; k < 6; k++) { const t = k / 6; pts.push(new THREE.Vector2(prof[i][0] + (prof[i + 1][0] - prof[i][0]) * t, prof[i][1] + (prof[i + 1][1] - prof[i][1]) * t)); }
  pts.push(new THREE.Vector2(...prof[prof.length - 1]));
  const g = new THREE.LatheGeometry(pts, 128).toNonIndexed();
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const cusps = [0, 1, 2, 3].map((k) => { const a = Math.PI / 4 + (k * Math.PI) / 2; return [Math.cos(a) * 0.36, Math.sin(a) * 0.36]; });
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x), r = Math.hypot(v.x, v.z);
    const sq = 1 + 0.04 * Math.cos(4 * a);
    const x = Math.cos(a) * r * sq * 1.04, z = Math.sin(a) * r * sq;
    let y = v.y;
    const w = sm(0.72, 0.97, y);
    if (w > 0) {
      let bump = 0;
      cusps.forEach(([cx, cz]) => { bump += Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / 0.07); });
      const inner = sm(0.56, 0.18, r);
      const fossa = Math.exp(-(r * r) / 0.025);
      const groove = (Math.exp(-(z * z) / 0.003) + 0.8 * Math.exp(-(x * x) / 0.003)) * inner;
      y += w * (0.12 * Math.min(1, bump) - 0.05 * fossa - 0.03 * Math.min(1, groove));
    }
    p.setXYZ(i, x, y, z);
  }
  const m = mergeVertices(g);
  m.computeVertexNormals();
  return m;
}

// склейка геометрий и вершин без дополнительных модулей
function mergeGeometries(list) {
  const pos = [], idx = [];
  let off = 0;
  list.forEach((g) => {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i));
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off);
    else for (let i = 0; i < p.count; i++) idx.push(i + off);
    off += p.count;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setIndex(idx);
  return out;
}
function mergeVertices(g, tol = 1e-4) {
  const p = g.attributes.position, map = new Map(), pos = [], idx = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = `${Math.round(x / tol)}_${Math.round(y / tol)}_${Math.round(z / tol)}`;
    let n = map.get(k);
    if (n === undefined) { n = pos.length / 3; map.set(k, n); pos.push(x, y, z); }
    idx.push(n);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setIndex(idx);
  return out;
}
