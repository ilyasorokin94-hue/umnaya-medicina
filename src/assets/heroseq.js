// Первый экран главной: картинка, которая собирается при загрузке и разбирается при прокрутке.
// Три источника, их выбирают data-атрибуты у .hero__3d:
// - data-seq: кадры, заранее отрисованные в Blender (Cycles). Кадр 0: всё собрано, последний: разобрано.
//   Кадры обрезаны по общей рамке объекта (data-crop: полный кадр и рамка), чтобы меньше весить в памяти.
//   Пока кадры грузятся, показывается ближайший уже готовый.
// - data-layers: слои одной картинки (например, из ChatGPT), которые едут по вертикали между положениями.
// - data-reveal: две совмещённые картинки, верхняя открывается сверху вниз по мере прокрутки.
// data-intro="fade": при загрузке картинка только проявляется, без сборки.
const box = document.querySelector(".hero__3d");
const canvas = box && box.querySelector("canvas");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

if (canvas && (box.dataset.seq || box.dataset.layers || box.dataset.reveal)) start();

const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const span = (t, a = 0, b = 1) => ease((t - a) / (b - a));

function loadImg(src) {
  const im = new Image();
  im.src = src;
  return im.decode().then(() => im);
}

// кадры из Blender
function frames(phone, changed) {
  const set = phone ? box.dataset.seqS : box.dataset.seq;
  const N = +(phone ? box.dataset.framesS : box.dataset.frames);
  const [FW, FH, CX, CY, CW, CH] = (phone ? box.dataset.cropS : box.dataset.crop).split(",").map(Number);
  // разобранный имплант выше собранного, поэтому к концу разбора кадр чуть уменьшается
  const shrink = box.dataset.shrink != null ? +box.dataset.shrink : 0.14;
  const imgs = new Array(N);
  const ok = new Uint8Array(N);
  const url = (i) => `${set}f${String(i).padStart(3, "0")}.webp`;
  // порядок загрузки: собранный и разобранный кадры, потом всё более частая сетка
  const order = [0, N - 1];
  for (let step = 16; step >= 1; step >>= 1) for (let i = 0; i < N; i += step) if (!order.includes(i)) order.push(i);
  let queued = 0, inflight = 0;
  const pump = () => {
    while (inflight < 6 && queued < order.length) {
      const i = order[queued++]; inflight++;
      // кадр считается готовым после декодирования, чтобы не тормозить прокрутку
      loadImg(url(i)).then((im) => { imgs[i] = im; ok[i] = 1; changed(); }, () => {})
        .finally(() => { inflight--; pump(); });
    }
  };
  // ближайший готовый кадр к нужному
  const nearest = (f) => {
    const i0 = Math.max(0, Math.min(N - 1, Math.round(f)));
    for (let d = 0; d < N; d++) {
      if (i0 - d >= 0 && ok[i0 - d]) return i0 - d;
      if (i0 + d < N && ok[i0 + d]) return i0 + d;
    }
    return -1;
  };
  return {
    load: pump,
    has0: () => ok[0] === 1,
    // для сборки при загрузке нужны кадры через один из четырёх
    coarse: () => { for (let i = 0; i < N; i += 4) if (!ok[i]) return false; return ok[N - 1] === 1; },
    key: (t) => nearest(t * (N - 1)),
    draw(ctx, t, W, H) {
      const i = nearest(t * (N - 1));
      if (i < 0) return;
      const k = Math.min(W / FW, H / FH) * (1 - shrink * (i / (N - 1)));
      const ox = (W - FW * k) / 2 + CX * k, oy = (H - FH * k) / 2 + CY * k;
      ctx.drawImage(imgs[i], ox, oy, CW * k, CH * k);
    },
  };
}

// слои одной картинки: {fw, fh, items: [{src, x, y, w, h, da, from, to, clip: [y0, y1]}]}
// x, y: положение в разобранном виде; da: сдвиг вниз до собранного положения; from/to: когда слой едет (доли t)
function layers(spec, changed) {
  const S = JSON.parse(spec);
  const imgs = [];
  let ready = false;
  return {
    load: () => Promise.all(S.items.map((it) => loadImg(it.src))).then((a) => { imgs.push(...a); ready = true; changed(); }, () => {}),
    has0: () => ready,
    coarse: () => ready,
    key: (t) => (ready ? Math.round(t * 400) : -1),
    draw(ctx, t, W, H) {
      if (!ready) return;
      const k = Math.min(W / S.fw, H / S.fh);
      const ox = (W - S.fw * k) / 2, oy = (H - S.fh * k) / 2;
      S.items.forEach((it, n) => {
        const y = it.y + (it.da || 0) * (1 - span(t, it.from, it.to));
        if (it.clip) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, oy + it.clip[0] * k, W, (it.clip[1] - it.clip[0]) * k);
          ctx.clip();
        }
        ctx.drawImage(imgs[n], ox + it.x * k, oy + y * k, it.w * k, it.h * k);
        if (it.clip) ctx.restore();
      });
    },
  };
}

// две совмещённые картинки: {fw, fh, base, top, y0, y1, soft}; верхняя открывается от y0 до y1
function reveal(spec, changed) {
  const S = JSON.parse(spec);
  let a = null, b = null, tmp = null;
  return {
    load: () => Promise.all([loadImg(S.base), loadImg(S.top)]).then(([x, y]) => { a = x; b = y; changed(); }, () => {}),
    has0: () => !!a,
    coarse: () => !!(a && b),
    key: (t) => (a && b ? Math.round(t * 400) : -1),
    draw(ctx, t, W, H) {
      if (!a || !b) return;
      const k = Math.min(W / S.fw, H / S.fh);
      const ox = (W - S.fw * k) / 2, oy = (H - S.fh * k) / 2;
      const w = S.fw * k, h = S.fh * k;
      const yb = oy + (S.y0 + (S.y1 - S.y0) * ease(t)) * k;
      const soft = (S.soft || 8) * k;
      // нижняя часть: исходная картинка, верхняя: вторая, граница мягкая, без линии
      if (!tmp) tmp = document.createElement("canvas");
      tmp.width = W; tmp.height = H;
      const c = tmp.getContext("2d");
      c.clearRect(0, 0, W, H);
      c.drawImage(b, ox, oy, w, h);
      const g = c.createLinearGradient(0, yb - soft, 0, yb + soft);
      g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
      c.globalCompositeOperation = "destination-in";
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = "source-over";
      ctx.drawImage(a, ox, oy, w, h);
      // под открытой частью исходную картинку стираем, чтобы края не двоились
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      const g2 = ctx.createLinearGradient(0, yb - soft, 0, yb + soft);
      g2.addColorStop(0, "rgba(0,0,0,1)"); g2.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
      ctx.restore();
      ctx.drawImage(tmp, 0, 0);
    },
  };
}

function start() {
  const phone = matchMedia("(max-width: 760px)").matches;
  const ctx = canvas.getContext("2d");
  let dirty = true;
  const src = box.dataset.layers ? layers(box.dataset.layers, () => { dirty = true; onLoaded(); })
    : box.dataset.reveal ? reveal(box.dataset.reveal, () => { dirty = true; onLoaded(); })
    : frames(phone, () => { dirty = true; onLoaded(); });

  let W = 0, H = 0;
  const size = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = Math.round(canvas.clientWidth * dpr); H = Math.round(canvas.clientHeight * dpr);
    canvas.width = W; canvas.height = H; dirty = true;
  };
  size();
  new ResizeObserver(size).observe(box);

  // сборка при загрузке: после заставки сайта (app.js шлёт um:hero-in) и когда готовы нужные картинки
  const G = window.gsap;
  const fadeOnly = box.dataset.intro === "fade";
  const intro = { t: reduce || fadeOnly ? 0 : 1 };
  let introStarted = false;
  const runIntro = () => {
    if (introStarted) return;
    introStarted = true;
    box.classList.add("is-live");
    if (intro.t === 0) return;
    if (G) G.to(intro, { t: 0, duration: 2.6, ease: "power3.inOut", delay: 0.1 });
    else intro.t = 0;
  };
  const anim = document.documentElement.classList.contains("js-anim");
  let heroIn = !anim || !G || window.__umHeroIn === true;
  let wait = 0;
  const tryIntro = () => {
    if (introStarted || !heroIn) return;
    if (intro.t === 0 ? src.has0() : src.coarse()) return runIntro();
    // медленная сеть: не ждём дольше 2,2 с, сразу показываем собранный вид
    if (!wait) wait = setTimeout(() => { if (!introStarted) { intro.t = 0; runIntro(); } }, 2200);
  };
  document.addEventListener("um:hero-in", () => { heroIn = true; tryIntro(); });
  function onLoaded() {
    if (reduce && src.has0()) box.classList.add("is-live");
    tryIntro();
  }
  tryIntro();

  // прокрутка: картинка разбирается за первую треть высоты первого экрана, пока она ещё на виду
  const hero = box.closest(".hero");
  let lag = 0;
  const scrollP = () => {
    if (!hero) return 0;
    const r = hero.getBoundingClientRect();
    // на компьютере картинка отстаёт от прокрутки, чтобы разобранные детали оставались на виду, пока уходит текст
    lag = phone ? 0 : Math.min(Math.max(0, -r.top), r.height) * 0.62;
    return Math.min(1, Math.max(0, -r.top / (r.height * 0.32)));
  };
  // курсор чуть сдвигает картинку целиком, без поворота; на телефоне и при «уменьшить движение» нет
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!phone && !reduce) addEventListener("pointermove", (e) => { pointer.tx = e.clientX / innerWidth - 0.5; pointer.ty = e.clientY / innerHeight - 0.5; }, { passive: true });

  let visible = true, raf = 0, shown = -1, lastTf = "";
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible && !raf) loop(); }, { rootMargin: "80px" }).observe(box);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && visible && !raf) loop(); });

  function frame() {
    pointer.x += (pointer.tx - pointer.x) * 0.07;
    pointer.y += (pointer.ty - pointer.y) * 0.07;
    const t = Math.max(intro.t, scrollP());
    const key = src.key(t);
    if (key >= 0 && (key !== shown || dirty)) {
      ctx.clearRect(0, 0, W, H);
      src.draw(ctx, t, W, H);
      shown = key; dirty = false;
    }
    const tf = `translate3d(${(pointer.x * 16).toFixed(1)}px, ${(pointer.y * 10 + lag).toFixed(1)}px, 0)`;
    if (tf !== lastTf) { canvas.style.transform = tf; lastTf = tf; }
  }
  function loop() {
    raf = 0;
    if (!visible || document.hidden) return;
    frame();
    raf = requestAnimationFrame(loop);
  }
  src.load();
  loop();
}
