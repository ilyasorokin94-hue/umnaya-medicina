// Первый экран главной: имплант из кадров, заранее отрисованных в Blender (Cycles).
// Кадр 0: имплант собран; последний кадр: коронка, абатмент и фикстура разведены и повернуты.
// При загрузке детали съезжаются (кадры идут от последнего к первому), при прокрутке имплант снова разбирается.
// Кадры обрезаны по общей рамке объекта (data-crop: полный кадр и рамка), чтобы меньше весить в памяти.
// Пока кадры грузятся, показывается ближайший уже готовый.
const box = document.querySelector(".hero__3d");
const canvas = box && box.querySelector("canvas");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

if (canvas && box.dataset.seq) start();

function start() {
  const phone = matchMedia("(max-width: 760px)").matches;
  const set = phone ? box.dataset.seqS : box.dataset.seq;
  const N = +(phone ? box.dataset.framesS : box.dataset.frames);
  const [FW, FH, CX, CY, CW, CH] = (phone ? box.dataset.cropS : box.dataset.crop).split(",").map(Number);
  const ctx = canvas.getContext("2d");
  const imgs = new Array(N);
  const ok = new Uint8Array(N);
  const url = (i) => `${set}f${String(i).padStart(3, "0")}.webp`;
  let dirty = true;

  // порядок загрузки: собранный и разобранный кадры, потом всё более частая сетка
  const order = [0, N - 1];
  for (let step = 16; step >= 1; step >>= 1) for (let i = 0; i < N; i += step) if (!order.includes(i)) order.push(i);
  let queued = 0, inflight = 0;
  const pump = () => {
    while (inflight < 6 && queued < order.length) {
      const i = order[queued++]; inflight++;
      const im = new Image();
      im.src = url(i);
      // кадр считается готовым после декодирования, чтобы не тормозить прокрутку
      im.decode().then(() => { imgs[i] = im; ok[i] = 1; dirty = true; onLoaded(); }, () => {})
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

  let W = 0, H = 0;
  const size = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = Math.round(canvas.clientWidth * dpr); H = Math.round(canvas.clientHeight * dpr);
    canvas.width = W; canvas.height = H; dirty = true;
  };
  size();
  new ResizeObserver(size).observe(box);

  // сборка при загрузке: после заставки сайта (app.js шлёт um:hero-in) и когда готовы кадры через один из четырёх
  const G = window.gsap;
  const intro = { t: reduce ? 0 : 1 };
  let introStarted = reduce;
  const coarseReady = () => { for (let i = 0; i < N; i += 4) if (!ok[i]) return false; return ok[N - 1] === 1; };
  const runIntro = () => {
    if (introStarted) return;
    introStarted = true;
    box.classList.add("is-live");
    if (G) G.to(intro, { t: 0, duration: 2.6, ease: "power3.inOut", delay: 0.1 });
    else intro.t = 0;
  };
  const anim = document.documentElement.classList.contains("js-anim");
  let heroIn = !anim || !G || window.__umHeroIn === true;
  let wait = 0;
  const tryIntro = () => {
    if (introStarted || !heroIn) return;
    if (coarseReady()) return runIntro();
    // медленная сеть: не ждём дольше 2,2 с, сразу показываем собранный имплант
    if (!wait) wait = setTimeout(() => { if (!introStarted) { intro.t = 0; runIntro(); } }, 2200);
  };
  document.addEventListener("um:hero-in", () => { heroIn = true; tryIntro(); });
  function onLoaded() {
    if (reduce && ok[0]) box.classList.add("is-live");
    tryIntro();
  }
  tryIntro();

  // прокрутка: имплант разбирается за первую треть высоты первого экрана, пока он ещё на виду
  const hero = box.closest(".hero");
  let lag = 0;
  const scrollP = () => {
    if (!hero) return 0;
    const r = hero.getBoundingClientRect();
    // на компьютере имплант отстаёт от прокрутки, чтобы разобранные детали оставались на виду, пока уходит текст
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
    const i = nearest(t * (N - 1));
    if (i >= 0 && (i !== shown || dirty)) {
      // разобранный имплант выше собранного, поэтому к концу разбора кадр чуть уменьшается
      const k = Math.min(W / FW, H / FH) * (1 - 0.14 * (i / (N - 1)));
      const ox = (W - FW * k) / 2 + CX * k, oy = (H - FH * k) / 2 + CY * k;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(imgs[i], ox, oy, CW * k, CH * k);
      shown = i; dirty = false;
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
  pump();
  loop();
}
