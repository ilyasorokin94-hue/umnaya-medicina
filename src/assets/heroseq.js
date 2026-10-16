// Первый экран главной: имплант из кадров, заранее отрисованных в Blender (Cycles).
// Кадр 0: имплант собран; последний кадр: коронка, абатмент и фикстура разведены и повернуты.
// При загрузке детали съезжаются (кадры идут от последнего к первому), при прокрутке имплант снова разбирается.
// Курсор чуть сдвигает картинку. Пока кадры грузятся, показывается ближайший загруженный.
const box = document.querySelector(".hero__3d");
const canvas = box && box.querySelector("canvas");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

if (canvas && box.dataset.seq) start();

function start() {
  const phone = matchMedia("(max-width: 760px)").matches;
  const set = phone ? box.dataset.seqS : box.dataset.seq;
  const N = +(phone ? box.dataset.framesS : box.dataset.frames);
  const ctx = canvas.getContext("2d");
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
      const im = new Image();
      im.decoding = "async";
      im.onload = () => { imgs[i] = im; ok[i] = 1; inflight--; dirty = true; onLoaded(); pump(); };
      im.onerror = () => { inflight--; pump(); };
      im.src = url(i);
    }
  };

  // ближайший загруженный кадр к нужному
  const nearest = (f) => {
    const i0 = Math.max(0, Math.min(N - 1, Math.round(f)));
    for (let d = 0; d < N; d++) {
      if (i0 - d >= 0 && ok[i0 - d]) return i0 - d;
      if (i0 + d < N && ok[i0 + d]) return i0 + d;
    }
    return -1;
  };

  let W = 0, H = 0, dirty = true;
  const size = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = Math.round(box.clientWidth * dpr); H = Math.round(box.clientHeight * 1.2 * dpr);
    canvas.width = W; canvas.height = H; dirty = true;
  };
  size();
  new ResizeObserver(size).observe(box);

  // сборка при загрузке: ждём кадры с шагом 4 (или 2,5 с), затем проигрываем от разобранного к собранному
  const intro = { t: reduce ? 0 : 1 };
  let introStarted = reduce;
  const G = window.gsap;
  const coarseReady = () => { for (let i = 0; i < N; i += 4) if (!ok[i]) return false; return ok[N - 1] === 1; };
  const runIntro = () => {
    if (introStarted) return;
    introStarted = true;
    box.classList.add("is-live");
    if (G) G.to(intro, { t: 0, duration: 2.4, ease: "power3.inOut", delay: 0.15, onUpdate: () => (dirty = true) });
    else intro.t = 0;
  };
  // ждём, пока уйдёт заставка сайта (app.js шлёт um:hero-in); без анимаций не ждём
  const anim = document.documentElement.classList.contains("js-anim");
  let heroIn = !anim || !G || window.__umHeroIn === true;
  let t0Ready = 0;
  const tryIntro = () => {
    if (introStarted || !heroIn) return;
    if (coarseReady()) return runIntro();
    if (!t0Ready) t0Ready = setTimeout(() => { if (!introStarted) { intro.t = 0; runIntro(); } }, 2200);
  };
  document.addEventListener("um:hero-in", () => { heroIn = true; tryIntro(); });
  function onLoaded() {
    if (reduce && ok[0]) box.classList.add("is-live");
    tryIntro();
  }
  tryIntro();

  // прокрутка: за 80% высоты первого экрана имплант разбирается
  const hero = box.closest(".hero");
  const scrollP = () => {
    if (!hero) return 0;
    const r = hero.getBoundingClientRect();
    return Math.min(1, Math.max(0, -r.top / (r.height * 0.8)));
  };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!phone && !reduce) addEventListener("pointermove", (e) => { pointer.tx = e.clientX / innerWidth - 0.5; pointer.ty = e.clientY / innerHeight - 0.5; }, { passive: true });

  let visible = true, raf = 0, shown = -1;
  const t0 = performance.now();
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible && !raf) loop(); }, { rootMargin: "80px" }).observe(box);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && visible && !raf) loop(); });

  function frame(now) {
    const time = (now - t0) / 1000;
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    const t = Math.max(intro.t, scrollP());
    const i = nearest(t * (N - 1));
    if (i >= 0 && (i !== shown || dirty)) {
      const im = imgs[i];
      const k = Math.min(W / im.naturalWidth, H / im.naturalHeight);
      const w = im.naturalWidth * k, h = im.naturalHeight * k;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
      shown = i; dirty = false;
    }
    // лёгкое парение и сдвиг за курсором: картинка остаётся плоской, двигается целиком
    const fy = reduce ? 0 : Math.sin(time * 0.8) * 6;
    canvas.style.transform = `translate3d(${(pointer.x * 14).toFixed(2)}px, ${(fy + pointer.y * 10).toFixed(2)}px, 0)`;
  }
  function loop() {
    raf = 0;
    if (!visible || document.hidden) return;
    frame(performance.now());
    raf = requestAnimationFrame(loop);
  }
  pump();
  loop();
}
