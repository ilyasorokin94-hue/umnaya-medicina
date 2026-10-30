// Поведение и анимации макета. GSAP + ScrollTrigger + Lenis лежат в assets/vendor.
// Без скриптов и при «уменьшить движение» весь контент виден сразу.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  // ссылка меню с data-dir="uslugi implantaciya": текущая, если адрес страницы лежит в одном из этих разделов
  const inDir = (d) => !!d && d.split(" ").some((x) => location.pathname.includes(`/${x}/`));
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(pointer: fine)").matches;
  const phoneMQ = matchMedia("(max-width: 760px)");
  const G = window.gsap, ST = window.ScrollTrigger;
  const anim = !!(G && ST) && !reduce;
  window.__umReady = true;
  // страховка: если первый экран так и не запустился (или скрипт ниже упал), шапка компьютера всё равно появляется
  setTimeout(() => $(".header")?.classList.add("is-loaded"), 6000);
  if (!anim) { root.classList.remove("js-anim", "js-intro"); root.classList.add("no-anim"); }
  // то, что не нужно для первого кадра, откладываем, чтобы первый экран начал появляться раньше (на телефоне)
  const later = [];
  const runLater = () => { removeEventListener("scroll", runLater); later.splice(0).forEach((fn) => fn()); };

  // ---------- разбивка текста для анимаций ----------
  const splitWords = (el, cls = "sw") => {
    const words = el.textContent.trim().split(/[ \t\r\n]+/);
    // текст целиком для чтения с экрана: aria-label на простом span не разрешён (Lighthouse aria-prohibited-attr)
    const full = el.textContent.trim().replace(/&/g, "&amp;").replace(/</g, "&lt;");
    if (el.hasAttribute("data-split")) el.setAttribute("data-split", "on"); // стили показывают заголовок, когда он разбит
    el.innerHTML = `<span class="sr">${full}</span>` + words.map((w) => (cls === "sw" ? `<span class="sw" aria-hidden="true"><span>${w}</span></span>` : `<span class="${cls}" aria-hidden="true">${w}</span>`)).join(" ");
    return $$(cls === "sw" ? ".sw > span" : "." + cls, el);
  };

  // ---------- плавная прокрутка ----------
  let lenis = null;
  if (anim && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 1 });
    lenis.on("scroll", ST.update);
    G.ticker.add((t) => lenis.raf(t * 1000));
    // после долгой задачи (загрузка скриптов на слабом телефоне) анимации продолжаются с того же места, а не перескакивают:
    // с lagSmoothing(0) первый экран появлялся уже на середине выезда, будто залипал (Ilya 22.10)
    G.ticker.lagSmoothing(250, 33);
  }
  const headerH = () => (parseFloat(getComputedStyle(root).getPropertyValue("--header-h")) || 70) + 20;
  const scrollToEl = (el) => {
    // тур на телефоне встаёт ровно туда, где лента закрепилась, как при обычной прокрутке
    const pinned = el.id === "clinic" && $(".ptour", el)?.offsetParent;
    if (lenis) lenis.scrollTo(el, { offset: pinned ? 0 : -headerH(), duration: 1.4 });
    else el.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  };
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href*="#"]');
    if (!a) return;
    const url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || !url.hash) return;
    const t = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!t) return;
    e.preventDefault();
    closeMenu();
    scrollToEl(t);
    history.replaceState(null, "", url.hash);
  });

  // ---------- меню ----------
  const menu = $("#menu");
  const burger = $(".burger");
  function closeMenu() {
    if (!menu?.classList.contains("is-open")) return;
    menu.classList.remove("is-open");
    root.classList.remove("menu-open");
    burger?.setAttribute("aria-expanded", "false");
    lenis?.start();
  }
  // меню телефона как у Лава Дент: тёмный с точкой текущий раздел; на главной тот, что сейчас на экране
  // (выше всех разделов первый), на других страницах сама страница или её раздел (услуги, врачи)
  const markMenu = () => {
    const links = $$(".mnav__list a", menu);
    if (!links.length) return;
    const secs = links.map((a) => [a, a.hash && a.pathname === location.pathname && document.getElementById(decodeURIComponent(a.hash.slice(1)))]).filter(([, el]) => el);
    let cur = null;
    if (secs.length) {
      const tops = secs.map(([a, el]) => [a, el.getBoundingClientRect().top]);
      const above = tops.filter(([, y]) => y <= innerHeight / 2);
      cur = (above.length ? above.reduce((m, t) => (t[1] > m[1] ? t : m)) : tops.reduce((m, t) => (t[1] < m[1] ? t : m)))[0];
    } else {
      cur = links.find((a) => !a.hash && a.pathname === location.pathname) || links.find((a) => inDir(a.dataset.dir));
    }
    links.forEach((a) => {
      a.classList.toggle("is-current", a === cur);
      if (a === cur) a.setAttribute("aria-current", a.hash ? "location" : "page"); else a.removeAttribute("aria-current");
    });
  };
  burger?.addEventListener("click", () => {
    const r = burger.getBoundingClientRect();
    menu.style.setProperty("--mo", `${r.left + r.width / 2}px ${r.top + r.height / 2}px`);
    markMenu();
    menu.scrollTop = 0;
    menu.classList.add("is-open");
    root.classList.add("menu-open");
    if (anim && !phoneMQ.matches) G.fromTo($$(".menu nav > a, .menu__svc > summary, .menu__foot > *", menu), { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.05, delay: 0.15, ease: "expo.out", overwrite: true });
    burger.setAttribute("aria-expanded", "true");
    lenis?.stop();
    $(".menu__close", menu)?.focus();
  });
  $(".menu__close")?.addEventListener("click", () => { closeMenu(); burger?.focus(); });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !menu?.classList.contains("is-open")) return;
    const inside = menu.contains(document.activeElement);
    closeMenu();
    if (inside) burger?.focus();
  });

  // ---------- шапка: всегда на месте, уезжает вверх ровно вместе с демо-полосой ----------
  const header = $(".header");
  // настоящая высота шапки (Ilya 30.10): по ней встают закреплённые колонки и якоря, чтобы не уезжать под полупрозрачную шапку
  if (header) {
    let hh = 0;
    const setHdr = () => { const h = header.offsetHeight; if (h && h !== hh) { hh = h; root.style.setProperty("--hdr-stick", h + "px"); } };
    setHdr();
    if ("ResizeObserver" in window) new ResizeObserver(setHdr).observe(header); else addEventListener("resize", setHdr);
  }
  const demo = $(".demo-bar");
  let demoH = 0;
  const setDemo = () => { demoH = demo ? demo.offsetHeight : 0; root.style.setProperty("--demo-h", demoH + "px"); hdrTop = null; onScrollHeader(); };
  // переменную на корне пишем, только когда она меняется: иначе каждый кадр прокрутки Safari пересчитывает стили всей страницы
  let hdrTop = null;
  const onScrollHeader = () => {
    const y = lenis ? lenis.scroll : scrollY;
    const t = Math.max(0, demoH - y);
    if (t !== hdrTop) { hdrTop = t; root.style.setProperty("--hdr-top", t + "px"); }
    header?.classList.toggle("is-scrolled", y > demoH + 10);
  };
  if (lenis) lenis.on("scroll", onScrollHeader); else addEventListener("scroll", onScrollHeader, { passive: true });
  addEventListener("resize", setDemo);
  setDemo();

  // разделы в шапке компьютера как у Лава Дент: светлый тот, что сейчас посередине экрана (между разделами ни один);
  // на других страницах светлый сама страница или её раздел (услуги, врачи), и его отрезок линии заполнен
  const navItems = $$(".nav__item");
  const navSecs = navItems.map((li) => { const a = $("a", li); return [li, a.hash && a.pathname === location.pathname && document.getElementById(decodeURIComponent(a.hash.slice(1)))]; }).filter(([, s]) => s);
  if (navSecs.length && "IntersectionObserver" in window) {
    const seen = new Set();
    const io = new IntersectionObserver((ents) => {
      ents.forEach((en) => (en.isIntersecting ? seen.add(en.target) : seen.delete(en.target)));
      // светлый один раздел: на стыке двух берём нижний
      const on = navSecs.filter(([, s]) => seen.has(s)).pop();
      navSecs.forEach(([li]) => li.classList.toggle("is-active", li === on?.[0]));
    }, { rootMargin: "-45% 0px -50% 0px" });
    navSecs.forEach(([, s]) => io.observe(s));
  } else if (!navSecs.length) {
    const cur = navItems.find((li) => { const a = $("a", li); return !a.hash && a.pathname === location.pathname; })
      || navItems.find((li) => inDir($("a", li).dataset.dir));
    cur?.classList.add("is-current");
  }

  // ---------- вкладки (команда, прайс, FAQ) ----------
  const fadeIn = (els) => { if (anim && els.length) G.fromTo(els, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.05, ease: "expo.out", clearProps: "transform" }); };
  $$("[data-tabs]").forEach((group) => {
    const kind = group.dataset.tabs;
    const btns = $$("[data-tab]", group);
    const edge = () => group.classList.toggle("is-end", group.scrollLeft + group.clientWidth >= group.scrollWidth - 4);
    group.addEventListener("scroll", edge, { passive: true });
    edge();
    btns.forEach((b) => b.addEventListener("click", () => {
      if (group.scrollWidth > group.clientWidth + 2) {
        const gr = group.getBoundingClientRect(), br = b.getBoundingClientRect();
        group.scrollBy({ left: br.left - gr.left - (gr.width - br.width) / 2, behavior: reduce ? "auto" : "smooth" });
      }
      btns.forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      const val = b.dataset.tab;
      if (kind === "team") {
        const shown = [];
        $$(".team__grid .doc").forEach((d) => { const ok = !val || d.dataset.tags.split(" ").includes(val); d.hidden = !ok; if (ok) shown.push(d); });
        shown.filter((d) => d.dataset.col).forEach((d, i) => { d.dataset.col = i % 2 ? "r" : "l"; });
        fadeIn(shown);
        requestAnimationFrame(lavaTeam);
        const tg = $(".team__grid");
        if (tg && tg.scrollWidth > tg.clientWidth) tg.scrollTo({ left: 0, behavior: reduce ? "auto" : "smooth" });
        requestAnimationFrame(teamDeck);
      } else if (kind === "works") {
        const shown = [];
        $$(".works__grid .case").forEach((c) => { const ok = !val || c.dataset.cat === val; c.hidden = !ok || (c.dataset.extra === "1" && !worksOpen); if (!c.hidden) shown.push(c); });
        fadeIn(shown);
      } else {
        $$(`[data-panel="${kind}"]`).forEach((p) => { p.hidden = p.dataset.key !== val; if (!p.hidden) fadeIn($$(".dir__card, li, .qa", p)); });
      }
      ST?.refresh();
    }));
  });

  // услуги на телефоне: первыми имплантация, протезирование и удаление (порядок задаёт CSS), с имплантации и открываемся.
  // Края ленты направлений гаснут с той стороны, где есть ещё вкладки. Панель с ценами листается пальцем вбок
  // к соседнему направлению, лента идёт следом
  const dirTabs = $('[data-tabs="dir"]');
  const dirSeq = () => $$("[data-tab]", dirTabs).sort((a, b) => (parseFloat(getComputedStyle(a).order) || 0) - (parseFloat(getComputedStyle(b).order) || 0));
  let dirRollStop = () => {};
  if (dirTabs) {
    if (phoneMQ.matches) {
      const b = dirSeq()[0];
      $$("[data-tab]", dirTabs).forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      $$('[data-panel="dir"]').forEach((p) => { p.hidden = p.dataset.key !== b.dataset.tab; });
    }
    const start = () => dirTabs.classList.toggle("is-start", dirTabs.scrollLeft <= 4);
    dirTabs.addEventListener("scroll", start, { passive: true });
    start();
    let sx = 0, sy = 0, lock = 0, cur = null;
    $$('[data-panel="dir"]').forEach((p) => {
      p.addEventListener("touchstart", (e) => { if (!phoneMQ.matches || e.touches.length > 1) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; lock = 0; cur = p; }, { passive: true });
      p.addEventListener("touchmove", (e) => {
        if (cur !== p) return;
        const dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
        // вбок только явный горизонтальный жест: иначе прокрутка пальцем с наклоном тянула панель и переключала вкладку
        if (!lock && Math.hypot(dx, dy) > 18) lock = Math.abs(dx) > Math.abs(dy) * 2 ? 1 : -1;
        if (lock === 1 && Math.abs(dy) > Math.abs(dx)) { lock = -1; if (anim) G.to(p, { x: 0, duration: 0.4, ease: "expo.out" }); }
        if (lock === 1 && anim) G.set(p, { x: dx * 0.35 });
      }, { passive: true });
      const end = (e) => {
        if (cur !== p) return;
        cur = null;
        if (lock !== 1) return;
        const t = e.changedTouches[0], dx = (t?.clientX ?? sx) - sx, dy = (t?.clientY ?? sy) - sy, seq = dirSeq(), i = seq.findIndex((b) => b.dataset.tab === p.dataset.key);
        const next = Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 2 ? seq[i + (dx < 0 ? 1 : -1)] : null;
        if (next) { dirRollStop(); next.click(); } else if (anim) G.to(p, { x: 0, duration: 0.4, ease: "expo.out" });
      };
      p.addEventListener("touchend", end, { passive: true });
      // жест отдали прокрутке страницы: вкладку не переключаем, панель возвращаем на место
      p.addEventListener("touchcancel", () => { if (cur !== p) return; cur = null; if (lock === 1 && anim) G.to(p, { x: 0, duration: 0.4, ease: "expo.out" }); }, { passive: true });
    });
  }

  // услуги на компьютере как у Лава Дент: карточки и строки появляются, когда сетка дошла до нижней четверти экрана, один раз
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-shown"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -25% 0px" });
    $$("[data-svl]").forEach((el) => io.observe(el));
  } else $$("[data-svl]").forEach((el) => el.classList.add("is-shown"));

  // «Показать ещё» в работах
  let worksOpen = false;
  $("[data-works-more]")?.addEventListener("click", (e) => {
    worksOpen = true;
    const cur = $('[data-tabs="works"] [aria-selected="true"]')?.dataset.tab || "";
    const shown = $$('.works__grid .case[data-extra="1"]').filter((c) => !cur || c.dataset.cat === cur);
    shown.forEach((c) => (c.hidden = false));
    fadeIn(shown);
    e.currentTarget.hidden = true;
    ST?.refresh();
  });

  // слайдер «до/после»
  $$(".ba").forEach((ba) => {
    const r = $("input", ba);
    r?.addEventListener("input", () => ba.style.setProperty("--pos", r.value + "%"));
  });

  // FAQ: плавное раскрытие
  $$(".qa").forEach((d) => {
    const s = $("summary", d), a = $(".qa__a", d);
    s.addEventListener("click", (e) => {
      if (!anim) return;
      e.preventDefault();
      if (d.open) {
        G.to(a, { height: 0, duration: 0.45, ease: "power3.inOut", onComplete: () => { d.open = false; a.style.height = ""; ST.refresh(); } });
      } else {
        d.open = true;
        G.fromTo(a, { height: 0 }, { height: a.scrollHeight, duration: 0.55, ease: "expo.out", onComplete: () => { a.style.height = ""; ST.refresh(); } });
      }
    });
  });

  // вопросы главной по принципу Lava Dental: тема раскрывается плюсом, внутри свои вопросы со своим плюсом.
  // Как у них: пункты открываются независимо, по умолчанию открыты первая тема и её первый вопрос, раскрытие 0,5 с.
  // Все ответы лежат в разметке, без скриптов работают обычные <details>.
  $$(".faqt, .faqq").forEach((d) => {
    const a = $(":scope > .faqt__body, :scope > .faqq__a", d);
    $(":scope > summary", d).addEventListener("click", (e) => {
      if (!anim) return;
      e.preventDefault();
      G.killTweensOf(a);
      if (d.open && !d.classList.contains("is-off")) {
        d.classList.add("is-off");
        G.fromTo(a, { height: a.offsetHeight }, { height: 0, duration: 0.5, ease: "power4.out", onComplete: () => { d.open = false; d.classList.remove("is-off"); a.style.height = ""; ST.refresh(); } });
        return;
      }
      const from = d.open ? a.offsetHeight : 0;
      d.classList.remove("is-off");
      d.open = true;
      G.fromTo(a, { height: from }, { height: a.scrollHeight, duration: 0.5, ease: "power4.out", onComplete: () => { a.style.height = ""; ST.refresh(); } });
      if (d.classList.contains("faqt")) G.fromTo($$(".faqq", a), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, delay: 0.05, ease: "power4.out", clearProps: "opacity,transform" });
    });
  });

  // «магнитные» кнопки
  if (anim && fine) {
    $$("[data-magnet]").forEach((b) => {
      const xTo = G.quickTo(b, "x", { duration: 0.6, ease: "elastic.out(1, .4)" });
      const yTo = G.quickTo(b, "y", { duration: 0.6, ease: "elastic.out(1, .4)" });
      b.addEventListener("pointermove", (e) => { const r = b.getBoundingClientRect(); xTo((e.clientX - r.left - r.width / 2) * 0.3); yTo((e.clientY - r.top - r.height / 2) * 0.4); });
      b.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
    });
  }

  // карта: включаем взаимодействие по клику, выключаем, когда курсор ушёл
  $$(".place__map").forEach((m) => {
    const fr = $("iframe", m);
    const load = () => { if (fr && !fr.getAttribute("src") && fr.dataset.src) fr.src = fr.dataset.src; };
    if (!phoneMQ.matches) load();
    else phoneMQ.addEventListener?.("change", (e) => { if (!e.matches) load(); });
    $(".place__show", m)?.addEventListener("click", (e) => { e.stopPropagation(); load(); m.classList.add("is-live"); ST?.refresh(); });
    m.addEventListener("click", (e) => { if (!phoneMQ.matches || m.classList.contains("is-live")) { if (!e.target.closest(".place__go")) m.classList.add("is-active"); } });
    m.addEventListener("mouseleave", () => m.classList.remove("is-active"));
  });

  // телефон: нижняя панель не дублирует кнопку первого экрана и форму в подвале, прячется при наборе текста
  // кнопка первого экрана: на главной блок кнопок, на страницах услуг и врачей «Записаться на консультацию»
  const heroCta = $(".hero .hero__actions") || $(".page-hero .btn");
  if ("IntersectionObserver" in window) {
    if (heroCta) {
      // на телефоне первый экран стоит на месте, а шторка слогана наезжает на него: кнопка закрыта, панель нужна
      const curtain = $(".opening .slogan");
      let ctaIn = true, mq = 0;
      const mb = () => root.classList.toggle("mb-off", ctaIn && !(curtain && phoneMQ.matches && curtain.getBoundingClientRect().top < heroCta.getBoundingClientRect().bottom));
      root.classList.add("mb-off");
      // кнопка ниже экрана (маленький телефон) тоже считается своей: панель не закрывает её, пока до неё не долистали
      new IntersectionObserver(([en]) => { ctaIn = en.isIntersecting || en.boundingClientRect.top >= innerHeight; mb(); root.classList.add("mb-ready"); }, { rootMargin: "-90px 0px 0px 0px" }).observe(heroCta);
      // пока кнопка первого экрана не видна, панель нужна при любом положении шторки: размеры не читаем
      if (curtain) addEventListener("scroll", () => { if (ctaIn && !mq) mq = requestAnimationFrame(() => { mq = 0; mb(); }); }, { passive: true });
    }
    const fcta = $(".footer__cta");
    if (fcta) new IntersectionObserver(([en]) => root.classList.toggle("bar-off", en.isIntersecting), { rootMargin: "0px 0px -30% 0px" }).observe(fcta);
  }
  // без кнопки первого экрана решать нечего: панель видна сразу
  if (!heroCta || !("IntersectionObserver" in window)) root.classList.add("mb-ready");
  document.addEventListener("focusin", (e) => { if (e.target.matches?.("input, textarea, select")) root.classList.add("bar-kb"); });
  document.addEventListener("focusout", () => root.classList.remove("bar-kb"));

  // телефон: врач в центре ленты крупнее, соседние чуть меньше и тише, портрет слегка сдвигается внутри рамки
  const tgrid = $(".team__grid:not(.team__grid--lava):not(.dl-grid)");
  function teamDeck() {
    if (!tgrid || reduce) return;
    if (!phoneMQ.matches) { $$(".doc", tgrid).forEach((c) => { c.style.removeProperty("--p"); c.style.removeProperty("--a"); }); return; }
    const x0 = tgrid.getBoundingClientRect().left + parseFloat(getComputedStyle(tgrid).paddingLeft);
    $$(".doc:not([hidden])", tgrid).forEach((c) => {
      const r = c.getBoundingClientRect();
      const k = Math.max(-1, Math.min(1, (r.left - x0) / (r.width + 14)));
      c.style.setProperty("--p", k.toFixed(3));
      c.style.setProperty("--a", Math.abs(k).toFixed(3));
    });
  }
  let tdr = 0;
  tgrid?.addEventListener("scroll", () => { cancelAnimationFrame(tdr); tdr = requestAnimationFrame(teamDeck); }, { passive: true });
  addEventListener("resize", teamDeck);
  teamDeck();

  // акции «Стопка» на телефоне: если карточка не влезла в экран даже с низкой картинкой (styles.css), стопку выключаем,
  // иначе кнопка застрявшей карточки так и остаётся под следующей карточкой или под нижней панелью
  const pr4 = $(".pr4");
  const pr4Fit = () => {
    if (!pr4) return;
    pr4.classList.remove("pr4--flat");
    pr4.classList.toggle("pr4--flat", $$(".pr4-card", pr4).some((c) => c.scrollHeight > c.clientHeight + 1));
  };
  if (pr4) { addEventListener("resize", pr4Fit); document.fonts?.ready.then(pr4Fit); pr4Fit(); }

  // нажатый заголовок раскрытия остаётся под пальцем (правило стабильности, 18.10): пока пункт выше сворачивается,
  // страница каждый кадр прокручивается ровно на столько, на сколько заголовок ушёл с места на экране. Вызывать до смены классов.
  // Держим место на экране, а не на странице: если браузер уже сам поправил прокрутку (привязка прокрутки в Chrome,
  // когда пункт выше ушёл за край экрана), сдвига нет и мы ничего не добавляем. Тронул экран или колесо — отпускаем.
  const holdUnderFinger = (el, ms = 900) => {
    const y0 = el.getBoundingClientRect().top;
    let stop = false;
    const off = () => { stop = true; };
    addEventListener("touchstart", off, { passive: true });
    addEventListener("wheel", off, { passive: true });
    const t0 = performance.now();
    const step = () => {
      const d = stop ? 0 : el.getBoundingClientRect().top - y0;
      if (Math.abs(d) >= 0.5) { if (lenis) lenis.scrollTo(scrollY + d, { immediate: true, force: true }); else scrollBy({ top: d, behavior: "instant" }); }  // instant: у html стоит scroll-behavior: smooth, без него при «уменьшить движение» заголовок прыгал и съезжал обратно
      if (!stop && performance.now() - t0 < ms) requestAnimationFrame(step);
      else { removeEventListener("touchstart", off); removeEventListener("wheel", off); }
    };
    requestAnimationFrame(step);
  };

  // «Выгодно всегда» на телефоне раскрывается: видны названия, описание по нажатию, открыто одно (styles.css, .pr-al--acc)
  const alAcc = $(".pr-al--acc");
  if (alAcc) {
    const items = $$(".pr-al__list li", alAcc);
    const sync = () => items.forEach((li) => {
      const b = $("b", li);
      if (phoneMQ.matches) { b.setAttribute("role", "button"); b.tabIndex = 0; b.setAttribute("aria-expanded", li.classList.contains("is-on")); }
      else { b.removeAttribute("role"); b.removeAttribute("tabindex"); b.removeAttribute("aria-expanded"); }
    });
    items[0]?.classList.add("is-on");
    alAcc.classList.add("is-js"); sync(); phoneMQ.addEventListener("change", sync);
    alAcc.addEventListener("click", (e) => {
      const b = e.target.closest(".pr-al__list b");
      if (!b || !phoneMQ.matches) return;
      const on = !b.parentElement.classList.contains("is-on");
      // пункт выше сворачивается и тянул нажатый заголовок вверх на 30–50 px
      holdUnderFinger(b);
      items.forEach((li) => li.classList.toggle("is-on", li === b.parentElement && on));
      sync();
      // высота блока поменялась: пересчитываем места анимаций ниже по странице, иначе они срабатывают не там и страницу дёргает
      clearTimeout(alAcc.t); alAcc.t = setTimeout(() => ST?.refresh?.(), 560);
    });
    alAcc.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.matches("b[role=button]")) { e.preventDefault(); e.target.click(); } });
  }

  // врачи как у Лава Дент: от 961px левая колонка едет от +20vmin к −20vmin, пока карточка проходит экран
  // снизу вверх, правая стоит, фото плывёт внутри рамки от +10% к −10%. Прогресс --k от 1 до −1.
  const lavaDocs = $$(".team__grid--lava .doc");
  const lavaMQ = matchMedia("(min-width: 961px)");
  let lavaOff = false;
  function lavaTeam() {
    if (!lavaDocs.length || !anim) return;
    if (!lavaMQ.matches) { if (!lavaOff) { lavaOff = true; lavaDocs.forEach((c) => { c.__k = null; c.style.removeProperty("--k"); }); } return; }
    lavaOff = false;
    const vh = innerHeight;
    // сначала все замеры, потом все записи: иначе каждая карточка заставляет браузер заново считать раскладку
    const ks = lavaDocs.map((c) => {
      if (c.hidden) return null;
      const r = c.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
      return (1 - 2 * t).toFixed(4);
    });
    lavaDocs.forEach((c, i) => { if (ks[i] !== null && c.__k !== ks[i]) { c.__k = ks[i]; c.style.setProperty("--k", ks[i]); } });
  }
  if (lavaDocs.length && anim) {
    if (lenis) lenis.on("scroll", lavaTeam); else addEventListener("scroll", lavaTeam, { passive: true });
    addEventListener("resize", lavaTeam);
    lavaMQ.addEventListener?.("change", lavaTeam);
    lavaTeam();
  }

  // кнопка «наверх»
  $$("[data-totop]").forEach((b) => b.addEventListener("click", () => (lenis ? lenis.scrollTo(0, { duration: 1.6 }) : scrollTo({ top: 0, behavior: "smooth" }))));

  // прайс-страница: поиск по услугам. Разделы с найденным раскрываются, после очистки поиска
  // раскрыты те же разделы, что до начала поиска
  const search = $("#p-search");
  if (search) {
    const tables = $$(".ptables .ptable");
    const empty = $(".pempty");
    let wasOpen = null;
    search.addEventListener("input", () => {
      const q = search.value.trim().replace(/\s+/g, " ").toLowerCase();
      if (q && !wasOpen) wasOpen = new Map(tables.map((t) => [t, t.open]));
      let any = false;
      tables.forEach((t) => {
        let n = 0;
        $$("li", t).forEach((li) => { const ok = !q || li.textContent.replace(/\u00a0/g, " ").toLowerCase().includes(q); li.hidden = !ok; if (ok) n++; });
        t.hidden = n === 0;
        t.open = q ? n > 0 : wasOpen ? wasOpen.get(t) : t.open;
        if (n) any = true;
      });
      if (!q) wasOpen = null;
      empty.hidden = any;
      ST?.refresh();
    });
  }

  // ---------- окна: запись, перезвон, снимок, расчёт, мессенджеры ----------
  const docs = (() => { try { return JSON.parse($("#um-docs")?.textContent || "{}"); } catch (e) { return {}; } })();

  // ---------- онлайн-запись (после docs: форма сразу подставляет врача из ссылки) ----------
  const bk = $("#booking");
  if (bk) booking(bk);

  // ---------- отправка заявок ----------
  // На рабочем сайте формы ведут на lead.php: заявка уходит fetch'ем, а без скриптов форма отправится сама и вернётся на «Спасибо».
  // В демо формы ведут на spasibo/, здесь только пауза, как будто отправили.
  // Откуда пришёл человек (страница входа, сайт-источник, метки) запоминает cookie.js, заявка берёт это из window.umSource
  const t0 = Date.now(), FILE_MB = 20;
  const isLive = (f) => /lead\.php$/.test(f.getAttribute("action") || "");
  // ловушка для ботов: поле, которого человек не видит
  $$("form").forEach((f) => { if (isLive(f)) f.insertAdjacentHTML("beforeend", '<input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">'); });
  const sendLead = async (form, kind, extra = {}) => {
    if (!isLive(form)) return new Promise((r) => setTimeout(r, 700));
    const fd = new FormData(form);
    const file = fd.get("file");
    if (file && file.size > FILE_MB * 1048576) throw new Error(`Файл больше ${FILE_MB} МБ. Пришлите снимок в Telegram или MAX.`);
    if (file && !file.size) fd.delete("file");
    fd.set("form", kind); fd.set("page", location.pathname); fd.set("title", document.title); fd.set("t", String(Date.now() - t0));
    Object.entries({ ...(window.umSource?.() || {}), ...extra }).forEach(([k, v]) => { if (v) fd.set(k, v); });
    const doc = fd.get("doctor");
    if (doc && docs[doc]) fd.set("doctor", docs[doc]);
    // номер посетителя в Метрике, только если её разрешили в уведомлении о cookie (без согласия её cookie нет)
    const ym = document.cookie.match(/(?:^|; )_ym_uid=(\d+)/);
    if (ym) fd.set("ym_uid", ym[1]);
    // визит Roistat (он подключён к amoCRM клиники), если его счётчик стоит на сайте
    const rs = document.cookie.match(/(?:^|; )roistat_visit=([^;]+)/);
    if (rs) fd.set("roistat", decodeURIComponent(rs[1]).slice(0, 64));
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 45000);
    try {
      const r = await fetch(form.action, { method: "POST", body: fd, headers: { Accept: "application/json" }, signal: ctl.signal, credentials: "same-origin" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || "");
      return j;
    } catch (err) {
      throw new Error(err.name === "AbortError" || !err.message ? "" : err.message);
    } finally { clearTimeout(tm); }
  };
  // ошибка под формой: что случилось и номер клиники, чтобы заявка не потерялась
  // (у окна «Три врача» поле и кнопка в одной капсуле, там строка встаёт под формой)
  const leadError = (form, msg) => {
    let p = form._err;
    if (!p) {
      p = form._err = document.createElement("p"); p.className = "form__err"; p.setAttribute("role", "alert");
      const b = form.querySelector("button:not([type=button])");
      if (b && !form.matches(".invite__form")) b.before(p); else form.after(p);
    }
    p.hidden = false;
    const tel = $('a[href^="tel:"]')?.getAttribute("href") || "tel:+74951503615";
    p.innerHTML = `${msg || "Не получилось отправить заявку."} Попробуйте ещё раз или позвоните: <a href="${tel}">${tel.replace(/^tel:\+7(\d{3})(\d{3})(\d{2})(\d{2})$/, "+7 $1 $2-$3-$4")}</a>`;
  };
  // кнопка на время отправки: «Отправляем…» и без повторных нажатий
  const busy = (form, on) => {
    const b = form.querySelector("button:not([type=button])") || $(`button[form="${form.id}"]`);
    if (!b) return;
    if (on) { b.dataset.label = b.textContent; b.textContent = "Отправляем…"; b.disabled = true; }
    else { b.textContent = b.dataset.label || b.textContent; b.disabled = false; }
  };
  let openM = null, lastFocus = null, anyModal = false;
  const showModal = (id, from) => {
    const m = $("#m-" + id);
    if (!m) return false;
    if (openM && openM !== m) hideModal(true);
    lastFocus = from || document.activeElement;
    if (id === "book") {
      const doc = from?.dataset.doctor, reason = from?.dataset.reason, info = $(".modal__doc", m);
      $('input[name="doctor"]', m).value = doc || "";
      info.hidden = !doc;
      info.textContent = doc ? "Врач: " + (docs[doc] || doc) : "";
      // повод от кнопки («Сказали удалить» и т. п.) уходит в заявку скрытым полем, выбирать его в окне не нужно (Ilya 22.10)
      $('input[name="reason"]', m).value = reason || "";
    }
    // акция из блока «Акции»: показываем строкой в окне и отправляем вместе с заявкой
    const pl = $(".modal__promo", m);
    if (pl) {
      const promo = from?.dataset.promo || "";
      pl.hidden = !promo;
      pl.textContent = promo ? "Акция: " + promo : "";
      $('input[name="promo"]', m).value = promo;
      // заголовок «бесплатная консультация» не подходит к платной акции (Air-Flow): по акции свой заголовок
      const h = id === "book" && $("h2", m);
      if (h) { h.dataset.title ??= h.textContent; h.textContent = promo ? "Запишитесь по акции" : h.dataset.title; }
    }
    m.hidden = false;
    openM = m; if (id !== "offer") anyModal = true;
    if (id !== "done") document.dispatchEvent(new CustomEvent("um:goal", { detail: "open_" + id })); // цель Метрики (cookie.js)
    root.classList.add("has-modal");
    lenis?.stop();
    if (anim) {
      G.fromTo(m, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power1.out" });
      G.fromTo($(".modal__box", m), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "expo.out", clearProps: "transform,opacity" });
    }
    // окно, которое всплыло само, не забирает фокус в поле: человек его не звал
    ((fine && id !== "offer" && $("input:not([type=hidden]):not([type=radio])", m)) || $("h2", m))?.focus({ preventScroll: true });
    return true;
  };
  function hideModal(instant) {
    const m = openM;
    if (!m) return;
    openM = null;
    const done = () => { if (openM === m) return; m.hidden = true; m.style.opacity = ""; if (!openM) { root.classList.remove("has-modal"); lenis?.start(); } };
    if (anim && !instant) G.to(m, { opacity: 0, duration: 0.25, ease: "power1.in", onComplete: done });
    else done();
    if (!instant) lastFocus?.focus?.({ preventScroll: true });
  }
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-modal]");
    if (t && showModal(t.dataset.modal, t)) { e.preventDefault(); closeMenu(); return; }
    if (e.target.closest("[data-close]") || e.target.classList.contains("modal")) hideModal();
  });
  // на телефоне окно снизу закрывается свайпом вниз, если оно прокручено к началу
  let sw = null;
  document.addEventListener("touchstart", (e) => {
    const b = openM && e.target.closest(".modal__box");
    sw = b && b.scrollTop <= 0 && !e.target.closest("input, textarea, select") ? { b, y: e.touches[0].clientY, dy: 0 } : null;
  }, { passive: true });
  document.addEventListener("touchmove", (e) => {
    if (!sw) return;
    sw.dy = e.touches[0].clientY - sw.y;
    sw.b.style.transform = sw.dy > 0 ? `translateY(${sw.dy}px)` : "";
  }, { passive: true });
  document.addEventListener("touchend", () => {
    if (!sw) return;
    const { b, dy } = sw;
    sw = null;
    if (dy > 90) { hideModal(); setTimeout(() => (b.style.transform = ""), 320); return; }
    b.style.transition = "transform .25s"; b.style.transform = "";
    setTimeout(() => (b.style.transition = ""), 260);
  });
  document.addEventListener("keydown", (e) => {
    if (!openM) return;
    if (e.key === "Escape") return hideModal();
    if (e.key === "Tab") {
      const f = $$("a[href], button:not([disabled]), input:not([type=hidden]), textarea", openM).filter((x) => x.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  // имя выбранного файла на кнопке
  $$(".file input").forEach((i) => i.addEventListener("change", () => { const s = i.nextElementSibling; if (s) s.textContent = i.files[0]?.name || "Выбрать файл"; }));

  // отправка любой формы заявки: заявка уходит в lead.php (amoCRM, Telegram, таблица), потом «спасибо»
  const doneText = {
    xray: ["Снимок у врача", "Врач посмотрит и ответит в течение рабочего дня. Если зуб можно спасти, скажем, как и сколько это стоит."],
    allon: ["Спасибо!", "Администратор перезвонит за 5 минут и запишет к имплантологу на консультацию с КТ. Расчёт бесплатный."],
  };
  const defDone = $("#m-done [data-done-text]")?.textContent;
  $$("form[data-lead]").forEach((f) => {
    if (f.hasAttribute("data-quiz") || f.classList.contains("cb")) return;
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (f.dataset.sending) return;
      const kind = f.dataset.lead, d = doneText[kind];
      f.dataset.sending = "1"; busy(f, true); if (f._err) f._err.hidden = true;
      try { await sendLead(f, kind); }
      catch (err) { leadError(f, err.message); return; }
      finally { delete f.dataset.sending; busy(f, false); }
      const dm = $("#m-done");
      if (dm) { $("h2", dm).textContent = d ? d[0] : "Спасибо!"; $("[data-done-text]", dm).textContent = d ? d[1] : defDone; }
      f.reset();
      $$(".file input", f).forEach((i) => i.dispatchEvent(new Event("change")));
      document.dispatchEvent(new CustomEvent("um:lead", { detail: { form: kind } })); // цель Метрики (cookie.js), без имени и телефона
      showModal("done");
    });
  });

  // окно с предложением по центру (Ilya 19.10: только тем, кто пробыл на сайте больше минуты). Считаем активные секунды:
  // вкладка на экране, счёт общий для всех страниц визита (sessionStorage), поэтому переход на другую страницу его не сбрасывает.
  // После 60 секунд показываем, когда на текущей странице пролистан первый экран; на компьютере ещё и когда курсор уходит
  // к вкладкам, но не раньше 20 секунд. Один раз за визит, после показа молчит 3 дня. Не всплывает поверх других окон и меню,
  // во время ввода, пока на экране контакты, и у тех, кто уже открывал запись. Закрывается крестиком, Esc и кликом мимо.
  // Пришедшим из рекламы Яндекс Бизнеса (utm_source=yandex_business) весь визит не показываем: модерация запрещает всплывающие окна.
  const offer = $("#m-offer");
  if (offer) {
    try { if (/[?&]utm_source=yandex_business(&|$)/.test(location.search)) sessionStorage.setItem("um2-yb", "1"); } catch (err) {}
    const quiet = () => { try { return !!sessionStorage.getItem("um2-exit") || !!sessionStorage.getItem("um2-yb") || Date.now() - (+localStorage.getItem("um2-offer") || 0) < 3 * 864e5; } catch (err) { return true; } };
    // пролистан ли первый экран: проверяем раз в кадр и снимаем слушатель, как только да (чтение размеров окна на каждом событии прокрутки заставляет браузер пересчитывать раскладку)
    let deep = false, dq = 0;
    const onDeep = () => { if (dq) return; dq = requestAnimationFrame(() => { dq = 0; if (scrollY > innerHeight * 0.7) { deep = true; removeEventListener("scroll", onDeep); } }); };
    addEventListener("scroll", onDeep, { passive: true });
    // контакты на экране: человек уже смотрит адрес и телефон, рамка ему не нужна
    let atContacts = false;
    const ct = $("#contacts");
    if (ct && "IntersectionObserver" in window) new IntersectionObserver(([en]) => { atContacts = en.isIntersecting; }).observe(ct);
    let seen = 0;
    try { seen = +sessionStorage.getItem("um2-active") || 0; } catch (err) {}
    const tryShow = () => {
      if (quiet() || anyModal) return clearInterval(tick);
      if (openM || atContacts || menu?.classList.contains("is-open") || document.activeElement?.matches?.("input, textarea, select")) return;
      try { sessionStorage.setItem("um2-exit", "1"); localStorage.setItem("um2-offer", String(Date.now())); } catch (err) {}
      clearInterval(tick);
      showModal("offer");
    };
    const tick = setInterval(() => {
      if (document.hidden) return;
      seen++;
      try { sessionStorage.setItem("um2-active", String(seen)); } catch (err) {}
      if (seen >= 60 && deep) tryShow();
    }, 1000);
    if (fine) document.addEventListener("mouseout", (e) => { if (!e.relatedTarget && e.clientY <= 8 && seen >= 20) tryShow(); });
  }

  // квиз: вопрос за вопросом, без номеров, полоска прогресса
  $$("[data-quiz]").forEach((form) => {
    const wrap = form.closest(".quiz"), steps = $$(".quiz__step", form), bar = $(".quiz__bar i", wrap);
    let cur = 0;
    const go = (n) => {
      const from = steps[cur], to = steps[n];
      cur = n;
      if (bar) bar.style.transform = `scaleX(${(n + 1) / (steps.length + 1)})`;
      const show = () => { steps.forEach((s) => (s.hidden = s !== to)); if (anim) G.fromTo(to, { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.5, ease: "expo.out", clearProps: "transform" }); };
      if (anim && from !== to) G.to(from, { opacity: 0, x: -30, duration: 0.2, ease: "power2.in", onComplete: show }); else show();
    };
    // по клику, а не по change: после «Назад» тот же ответ уже выбран, и change не придёт
    form.addEventListener("click", (e) => {
      if (e.target.closest("[data-qback]")) return go(Math.max(0, cur - 1));
      const r = e.target.closest('input[type="radio"]');
      if (r && /^q\d/.test(r.name)) { const at = cur; setTimeout(() => { if (cur === at) go(Math.min(at + 1, steps.length - 1)); }, 220); }
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const ph = $("[data-req]", form);
      if (ph && !ph.value.trim()) { ph.setCustomValidity("Укажите телефон"); ph.reportValidity(); ph.setCustomValidity(""); return; }
      const first = $('input[name="q0"]:checked', form);
      const done = $(".quiz__done", wrap);
      $("[data-qprice]", done).textContent = first?.dataset.price || "Консультация и план лечения 0 ₽, если остаётесь на лечение";
      if (bar) bar.style.transform = "scaleX(1)";
      form.hidden = true; done.hidden = false;
      if (anim) G.from(done.children, { opacity: 0, y: 20, stagger: 0.08, duration: 0.6 });
      ST?.refresh();
    });
  });

  // ---------- контакты: адрес, часы, маршрут, Яндекс Карта ----------
  // открыто ли сейчас: время Москвы, ежедневно с 9:00 до 21:00
  const nowMsk = () => {
    const pt = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    return +pt.find((x) => x.type === "hour").value * 60 + +pt.find((x) => x.type === "minute").value;
  };
  const isOpen = () => { const t = nowMsk(); return t >= 540 && t < 1260; };
  const openSt = $("[data-open-status]");
  // часовой пояс в первый раз считается долго, а блок внизу страницы
  if (openSt) later.push(() => {
    if (isOpen()) { openSt.textContent = "Сейчас открыто, до 21:00"; openSt.classList.add("is-open"); }
    else openSt.textContent = nowMsk() < 540 ? "Сейчас закрыто, откроемся в 9:00" : "Сейчас закрыто, откроемся завтра в 9:00";
  });
  // карта двигается только после нажатия, иначе колесо и палец застревают на ней при прокрутке страницы
  $$(".ctmap").forEach((m) => {
    m.addEventListener("click", () => m.classList.add("is-active"));
    m.addEventListener("mouseleave", () => m.classList.remove("is-active"));
  });
  document.addEventListener("pointerdown", (e) => { $$(".ctmap.is-active").forEach((m) => { if (!m.contains(e.target)) m.classList.remove("is-active"); }); });
  // карта Яндекса тяжёлая: если она грузится, пока человек листает к ней, прокрутка дёргается. Грузим её в паузе,
  // когда до неё 4 экрана, или сразу, когда до неё экран. На телефоне метка по центру карты, на компьютере справа от карточки
  const maps = $$(".ctmap iframe[data-src]");
  if (maps.length) {
    const url = (f) => (matchMedia("(max-width: 1024px)").matches && f.dataset.srcPhone) || f.dataset.src;
    const load = (f) => { if (!f.getAttribute("src")) f.src = url(f); };
    let near = false, quiet = 0;
    const idle = () => { clearTimeout(quiet); if (near) quiet = setTimeout(() => (window.requestIdleCallback || setTimeout)(() => maps.forEach(load)), 700); };
    const io = (margin, fn) => { const o = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { o.unobserve(e.target); fn(e.target); } }), { rootMargin: margin }); maps.forEach((f) => o.observe(f)); };
    io("400% 0px", () => { near = true; idle(); });
    io("100% 0px", load);
    addEventListener("scroll", idle, { passive: true });
  }
  // отправить адрес себе или тому, кто повезёт
  const shareBtn = $("[data-share]");
  shareBtn?.addEventListener("click", async () => {
    const data = { title: "Умная Медицина. Стоматология", text: shareBtn.dataset.shareText, url: shareBtn.dataset.shareUrl };
    try {
      if (navigator.share) { await navigator.share(data); return; }
      await navigator.clipboard.writeText(data.title + ". " + data.text + " " + data.url);
      const t = shareBtn.textContent; shareBtn.textContent = "Адрес скопирован"; setTimeout(() => (shareBtn.textContent = t), 2500);
    } catch (err) { /* отмена или нет доступа к буферу */ }
  });

  // ---------- заявка в подвале: один большой номер, ответ на месте ----------
  // Введённые цифры встают поверх серой маски «+7 000 000-00-00», кнопка загорается на десятой цифре.
  const cb = $(".cb"), cbIn = $("#cb-phone"), cbDone = $(".cb__done"), cbHint = $(".cb__hint");
  if (cb && cbIn && cbDone && cbHint) {
    const hint0 = cbHint.textContent, btn = $(".big__btn", cb), typed = $("[data-typed]", cb), rest = $("[data-rest]", cb);
    const M = rest.textContent;
    const digits = (v) => { let d = v.replace(/\D/g, ""); if (d[0] === "8") d = "7" + d.slice(1); if (d && d[0] !== "7") d = "7" + d; return d.slice(0, 11); };
    const fmt = (d) => { const r = d.slice(1); let t = "+7"; if (r.length) t += " " + r.slice(0, 3); if (r.length > 3) t += " " + r.slice(3, 6); if (r.length > 6) t += "-" + r.slice(6, 8); if (r.length > 8) t += "-" + r.slice(8, 10); return t; };
    const clearErr = () => { cb.classList.remove("is-error"); cbIn.removeAttribute("aria-invalid"); $(".consent", cb)?.classList.remove("is-error"); cbHint.textContent = hint0; };
    const draw = () => {
      typed.textContent = cbIn.value; rest.textContent = M.slice(cbIn.value.length);
      const full = digits(cbIn.value).length === 11;
      if (full === btn.classList.contains("is-ready")) return;
      btn.classList.toggle("is-ready", full);
      if (full) { clearErr(); if (anim) G.fromTo(btn, { scale: 0.92 }, { scale: 1, duration: 0.6, ease: "back.out(2.5)" }); }
    };
    $("input[type=checkbox][name=consent]", cb)?.addEventListener("change", (e) => { if (e.target.checked && digits(cbIn.value).length === 11) clearErr(); });
    cbIn.addEventListener("focus", () => { if (!cbIn.value) { cbIn.value = "+7 "; draw(); } });
    cbIn.addEventListener("blur", () => { if (digits(cbIn.value).length <= 1) { cbIn.value = ""; draw(); } });
    // привычная 8 сразу после «+7» не становится первой цифрой номера
    cbIn.addEventListener("input", () => { let d = digits(cbIn.value); if (d === "78") d = "7"; cbIn.value = d.length <= 1 ? "+7 " : fmt(d); draw(); });
    cb.addEventListener("submit", (e) => {
      e.preventDefault();
      if (btn.disabled) return;
      const d = digits(cbIn.value), agree = $("input[type=checkbox][name=consent]", cb);
      if (d.length === 11 && agree && !agree.checked) {
        // галочка согласия: форма с novalidate, поэтому проверяем сами
        cb.classList.add("is-error"); agree.closest(".consent").classList.add("is-error");
        cbHint.textContent = "Отметьте согласие на обработку персональных данных";
        agree.focus();
        return;
      }
      if (d.length !== 11) {
        cb.classList.add("is-error"); cbIn.setAttribute("aria-invalid", "true");
        cbHint.textContent = d.length <= 1 ? "Введите номер, и мы перезвоним" : "Не хватает цифр: после +7 нужно 10";
        cbIn.focus();
        if (anim) G.fromTo($(".big__field", cb), { x: -8 }, { x: 0, duration: 0.5, ease: "elastic.out(1, .35)" });
        return;
      }
      btn.disabled = true; btn.textContent = "Отправляем";
      sendLead(cb, "final").then(() => {
        $("[data-done-s]", cbDone).textContent = isOpen()
          ? "Администратор перезвонит за 5 минут."
          : "Сейчас клиника закрыта. Перезвоним утром, после 9:00.";
        const h0 = cb.offsetHeight;
        cb.hidden = true; cbDone.hidden = false; cbDone.focus({ preventScroll: true });
        document.dispatchEvent(new CustomEvent("um:lead", { detail: { form: "final" } }));
        if (anim) { G.from(cbDone, { height: h0, duration: 0.6, ease: "power3.out", clearProps: "height" }); G.from(cbDone.children, { y: 16, autoAlpha: 0, duration: 0.6, stagger: 0.06, ease: "power3.out" }); }
        btn.disabled = false; btn.textContent = "Жду звонка"; cbIn.value = ""; draw(); clearErr();
      }, (err) => {
        btn.disabled = false; btn.textContent = "Жду звонка";
        cb.classList.add("is-error");
        cbHint.textContent = (err.message || "Не получилось отправить.") + " Позвоните: +7 495 150-36-15";
      });
    });
    $("[data-again]", cbDone)?.addEventListener("click", () => { cbDone.hidden = true; cb.hidden = false; cbIn.focus(); });
  }

  // ---------- тур на телефоне свайпом: счётчик фото ----------
  const ptw = $(".ptw__strip");
  if (ptw && "IntersectionObserver" in window) {
    const num = $(".ptw__count b"), items = [...ptw.children];
    const io = new IntersectionObserver((ens) => ens.forEach((en) => { if (en.isIntersecting && num) num.textContent = String(items.indexOf(en.target) + 1); }), { root: ptw, threshold: 0.6 });
    items.forEach((it) => io.observe(it));
  }

  // ---------- тур на телефоне как вторая секция Лава Дент ----------
  const pt = $(".ptour");
  if (pt) {
    // фото ленты стоят за краем экрана и обрезаны лентой, сами они загрузились бы, только въехав в кадр: грузим заранее
    // Chrome без синхронного декодирования оставляет пустыми карточки, которые довозит прокрутка; Safari наоборот
    // декодирует крупные фото в фоне, а синхронное декодирование там тормозит ленту, поэтому sync только для Chromium.
    // Заранее декодируем все фото, чтобы к ленте они были готовы
    const near = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      $$("img", pt).forEach((im) => { if (window.chrome) im.decoding = "sync"; im.loading = "eager"; if (im.decode && im.closest(".ptour__items")) im.decode().catch(() => {}); });
      near.disconnect();
    }, { rootMargin: "150% 0px" });
    near.observe(pt);
    // заголовок над раскрытым кабинетом проявляется по словам, когда снизу подходят фото, и гаснет, когда они ушли (как у Лава Дент)
    const grid = $(".ptour__grid", pt);
    if (grid) new IntersectionObserver(([en]) => pt.classList.toggle("is-on", en.isIntersecting), { rootMargin: "0px 0px 25% 0px" }).observe(grid);
  }

  // ---------- анимации ----------
  // Правило: прокрутку сглаживает только Lenis, поэтому все scrub = true (без второго сглаживания),
  // одно свойство одного элемента ведёт одна анимация, CSS-переходы на этих свойствах выключены.
  // ---------- первый экран: фразы пояснения сменяют друг друга ----------
  // Слова уходят вверх и приходят снизу (CSS), пока экран на виду и вкладка открыта; наведение на фразу ставит смену на паузу
  const rot = $(".hv__rot");
  const rotStart = (() => {
    if (!rot) return () => {};
    const ph = $$(":scope > [aria-hidden]", rot);
    let k = 0, seen = true, hold = false, timer = 0;
    // после паузы отсчёт идёт заново, иначе фраза сменится сразу, как только убрали курсор или вернулись на вкладку
    const rearm = () => { if (timer) { clearInterval(timer); timer = setInterval(next, 3600); } };
    new IntersectionObserver(([en]) => { seen = en.isIntersecting; if (seen) rearm(); }).observe(rot);
    rot.addEventListener("pointerenter", () => (hold = true));
    rot.addEventListener("pointerleave", () => { hold = false; rearm(); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) rearm(); });
    const next = () => {
      if (document.hidden || !seen || hold) return;
      const was = ph[k];
      was.classList.replace("is-on", "is-out");
      setTimeout(() => was.classList.remove("is-out"), 1100);
      k = (k + 1) % ph.length;
      ph[k].classList.add("is-on");
    };
    // до запуска первая фраза стоит на месте за счёт CSS, дальше её ведут классы
    return () => {
      if (timer) return;
      rot.classList.add("is-live");
      ph[0].classList.add("is-on");
      timer = setInterval(next, 3600);
    };
  })();
  // с анимацией первая фраза приходит после заголовка (запасной запуск, если заставка не доиграла), без неё всё сразу на месте
  if (rot && anim) setTimeout(rotStart, 6000);
  else rotStart();

  if (!anim) { runLater(); return; }
  G.registerPlugin(ST);
  G.defaults({ ease: "power3.out" });
  ST.config({ ignoreMobileResize: true });

  const heroIn = ({ bar = true } = {}) => {
    // шапка компьютера въезжает сверху и проявляется, линия под разделами убегает влево, как у Лава Дент (CSS);
    // класс ставим через кадр, чтобы браузер успел нарисовать начальное положение
    requestAnimationFrame(() => requestAnimationFrame(() => header?.classList.add("is-loaded")));
    const h = $(".hero, .page-hero");
    if (!h) return;
    // главная на компьютере: «Один план лечения.» собирается из разлетевшихся букв, остальные слова поднимаются из-под строки
    const conv = !phoneMQ.matches && h.classList.contains("hero--v1") && $(".hv__l2", h);
    const page = h.classList.contains("page-hero");
    const words = page ? [] : $$("[data-split] .sw > span", h).filter((w) => !conv || !conv.contains(w));
    const tl = G.timeline();
    const media = h.classList.contains("hero") ? $(".hero__media", h) : $(".sp-hero__media", h);
    const small = phoneMQ.matches;
    if (media) tl.fromTo(media, { clipPath: small ? "inset(0% 0% 100% 0%)" : "inset(10% 6% 10% 6%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: small ? 1.4 : 1.6, ease: "power3.inOut" }, small ? 0.35 : 0);
    const mimg = $(".hero__media img, .sp-hero__media img", h);
    if (mimg) tl.from(mimg, { scale: 1.18, duration: 2.4, ease: "power2.out" }, 0);
    if (words.length) tl.from(words, { yPercent: 110, duration: 1.2, stagger: 0.06, ease: "power4.out" }, 0.1);
    const rise = $$(".kicker, .label, .crumbs, .page-hero__lead, .hero__facts > *, .hero__actions > *, .page-hero__aside > *, .doc-hero__facts > *, .doc-hero__cta > *, .sp-hero__act > *, .sp-facts > *, .sp-nav", h).filter((el) => !conv || !el.closest(".hero__actions"));
    if (rise.length && !page) tl.fromTo(rise, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 1, stagger: 0.07 }, 0.4);
    if (bar && !matchMedia("(min-width: 1025px)").matches) tl.from(".header__bar", { autoAlpha: 0, duration: 0.9 }, 0.2);
    if (conv) {
      // буквы съезжаются сдвигом, а не letter-spacing: тот же рисунок (разрядка 0.5em → −0.055em), но раскладка
      // не меняется и заголовок не даёт сдвига макета (CLS главной на компьютере был 0,14). После сборки слова как были
      const wordEls = $$(".sw > span", conv), step = 0.555 * parseFloat(getComputedStyle(conv).fontSize);
      const saved = wordEls.map((w) => w.textContent);
      let at = 0;
      const chars = wordEls.flatMap((w) => {
        w.parentElement.style.overflow = "visible";
        const cs = [...w.textContent].map((c) => { const s = document.createElement("span"); s.style.display = "inline-block"; s.textContent = c; s.dataset.i = at++; return s; });
        at++; // пробел между словами тоже получал разрядку
        w.replaceChildren(...cs);
        return cs;
      });
      const unsplit = () => wordEls.forEach((w, i) => { w.textContent = saved[i]; w.parentElement.style.overflow = ""; });
      tl.fromTo(conv, { autoAlpha: 0, filter: "blur(6px)" }, { autoAlpha: 1, filter: "blur(0px)", duration: 2, ease: "expo.out", clearProps: "filter" }, 0.45);
      tl.fromTo(chars, { x: (i, el) => el.dataset.i * step }, { x: 0, duration: 2, ease: "expo.out", onComplete: unsplit }, 0.45);
      // кнопка приходит вместе с первой фразой, когда заголовок уже собрался
      tl.fromTo($$(".hero__actions > *", h), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 1 }, 1.35);
    }
    // на телефоне первая фраза приходит вслед за заголовком, на компьютере вместе с кнопкой, когда буквы собрались
    if (rot && h.contains(rot)) tl.call(rotStart, null, conv ? 0.85 : 0.45);
    const trio = $(".slogan__more .hero__trio") || $(".hero__trio", h);
    if (trio && small) {
      const st = { trigger: trio, start: "top 92%", once: true };
      G.from($$(".hero__face", trio), { scale: 0.6, autoAlpha: 0, duration: 1.1, stagger: 0.12, ease: "back.out(1.7)", scrollTrigger: st });
      G.from($$("b, a > span:last-child", trio), { y: 16, autoAlpha: 0, duration: 0.8, stagger: 0.05, delay: 0.25, scrollTrigger: st });
    }
  };

  // разбиваем заголовки до первого кадра
  $$("[data-split]").forEach((el) => splitWords(el));

  const intro = $(".intro");
  const introOn = !!intro && root.classList.contains("js-intro");
  if (introOn) {
    lenis?.stop();
    try { sessionStorage.setItem("um2-intro", "1"); } catch (e) { /* приватный режим */ }
    // логотип проявляется и перелетает на своё место в шапке; шапку ставим на место заранее, под заставкой,
    // первый экран начинает появляться до того, как растает фон, чтобы его текст не мелькнул готовым
    const mk = $(".intro__mark", intro), logo = $(".header .logo"), dst = $(".logo__img", logo || document);
    const tl = G.timeline({ onComplete: () => { intro.remove(); lenis?.start(); root.classList.remove("js-intro"); } });
    header?.classList.add("is-loaded");
    if (logo) logo.style.visibility = "hidden";
    const fly = () => {
      const a = mk.getBoundingClientRect(), b = dst?.getBoundingClientRect();
      return b && b.width && a.width ? { x: b.left - a.left, y: b.top - a.top, scale: b.width / a.width } : { autoAlpha: 0 };
    };
    tl.fromTo(mk, { y: 14 }, { clipPath: "inset(0 0% 0 0)", y: 0, duration: 1.1, ease: "power3.inOut" })
      .add(() => { tl.to(mk, { ...fly(), duration: 1, ease: "power3.inOut" }, 1.45); }, 1.44)
      .add(() => heroIn({ bar: false }), 1.4)
      .to(".intro__bg", { autoAlpha: 0, duration: 0.9, ease: "power2.inOut" }, 1.6)
      .add(() => { if (logo) logo.style.visibility = ""; }, 2.45)
      .from(".header .logo__unit", { autoAlpha: 0, duration: 0.5 }, 2.45)
      .to(mk, { autoAlpha: 0, duration: 0.25 }, 2.45);
  } else {
    intro?.remove();
    heroIn();
  }

  // остальные анимации страницы настраиваем, когда первый экран выехал или человек начал листать: на телефоне эта
  // настройка шла одной долгой задачей до первого кадра и задерживала появление текста первого экрана (Ilya 22.10)
  later.push(() => {
    // первый экран главной: фото чуть сдвигается внутри рамки, текст не тает (его ещё читают)
    // на внутренних страницах текст первого экрана спокойно тает, на телефоне нет
    const mm = G.matchMedia();
    const hero = $(".hero");
    if (hero && $(".hero__media img", hero)) G.fromTo(".hero__media img", { yPercent: 0 }, { yPercent: -6, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
    mm.add("(min-width: 761px)", () => {
      const ph = $(".page-hero"), pt = ph && $(".page-hero__in, .doc-hero__text", ph);
      if (pt) G.to(pt, { y: -60, autoAlpha: 0.2, ease: "none", scrollTrigger: { trigger: ph, start: "30% top", end: "bottom top", scrub: true } });
    });

    // заголовки разделов: слова поднимаются из-под строки
    $$("[data-split]").forEach((el) => {
      if (el.closest(".hero, .page-hero, .tour__title")) return;
      G.from($$(".sw > span", el), { yPercent: 110, duration: 1.1, stagger: 0.04, ease: "power4.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } });
    });

    // появление блоков: по порядку, без наездов друг на друга.
    // После появления снимаем data-reveal, иначе стиль из CSS (сдвиг на 24px) возвращается и блок съезжает вниз.
    // То, что уже проскочили быстрой прокруткой, показываем сразу; лесенка не дольше 0,35 с, чтобы видимое не ждало.
    const revealed = (el) => { el.removeAttribute("data-reveal"); G.set(el, { clearProps: "opacity,transform" }); };
    ST.batch("[data-reveal]", {
      start: "top 92%", once: true, interval: 0.1,
      onEnter: (els) => {
        const live = els.filter((el) => el.getBoundingClientRect().bottom > 0);
        els.filter((el) => !live.includes(el)).forEach(revealed);
        if (live.length) G.to(live, { opacity: 1, y: 0, scale: 1, duration: 0.9, stagger: Math.min(0.07, 0.35 / live.length), overwrite: true, onComplete: () => live.forEach(revealed) });
      },
    });

    // акции «Стопка»: карточка уходит чуть вглубь, когда на неё наплывает следующая (на низком экране стопки нет, см. styles.css)
    mm.add("(min-height: 601px)", () => {
      const pr4 = $$(".pr4-card");
      pr4.slice(0, -1).forEach((c, i) => G.to(c, { scale: 0.94, ease: "none", scrollTrigger: { trigger: pr4[i + 1], start: "top bottom", end: "top 30%", scrub: true } }));
    });

    // картинки раскрываются шторкой
    $$("[data-clip]").forEach((el) => {
      const im = $("img", el);
      const st = { trigger: el, start: "top 90%", once: true };
      G.to(el, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.4, ease: "power3.inOut", scrollTrigger: st });
      if (im) G.from(im, { scale: 1.15, duration: 1.8, ease: "power2.out", scrollTrigger: st });
    });

    // параллакс: картинка внутри рамки
    $$("[data-parallax]").forEach((fig) => {
      const im = $("img", fig);
      if (im) G.fromTo(im, { yPercent: -10 }, { yPercent: 0, ease: "none", scrollTrigger: { trigger: fig, start: "top bottom", end: "bottom top", scrub: true } });
    });
    // параллакс: элементы коллажа плывут с разной скоростью (небольшой разброс, чтобы не наезжали)
    $$("[data-speed]").forEach((el) => {
      const k = parseFloat(el.dataset.speed) || 0;
      const amp = () => k * innerHeight * (innerWidth <= 760 ? 0.05 : 0.12);
      G.fromTo(el, { y: () => amp() }, { y: () => -amp(), ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true } });
    });

    // «О нас»: текст проявляется по словам при прокрутке
    const st = $(".about__statement");
    if (st) {
      const ws = splitWords(st, "w");
      G.to(ws, { opacity: 1, stagger: 0.1, ease: "none", scrollTrigger: { trigger: st, start: "top 75%", end: "bottom 45%", scrub: true } });
    }

    // счётчики
    $$("[data-count]").forEach((el) => {
      const raw = el.dataset.count, grp = /\s/.test(raw);
      const target = parseFloat(raw.replace(/\s/g, "").replace(",", "."));
      const dec = (raw.split(/[.,]/)[1] || "").length;
      const fmt = (v) => (grp ? Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") : v.toFixed(dec).replace(".", ","));
      const o = { v: 0 };
      G.to(o, { v: target, duration: 1.8, ease: "power2.out", scrollTrigger: { trigger: el, start: "top 92%", once: true }, onUpdate: () => (el.textContent = fmt(o.v)) });
    });

    const ring = $(".rt-seal__fill");
    if (ring) {
      mm.add("(max-width: 760px)", () => { G.fromTo(ring, { strokeDashoffset: 100 }, { strokeDashoffset: 2, ease: "none", scrollTrigger: { trigger: ".rt-seal", start: "top 85%", end: "center 50%", scrub: true } }); });
      mm.add("(min-width: 761px)", () => { G.fromTo(ring, { strokeDashoffset: 100 }, { strokeDashoffset: 2, duration: 1.8, ease: "power2.out", scrollTrigger: { trigger: ".rt-seal", start: "top 92%", once: true } }); });
    }
    if ($(".rt-avg .rt-stars svg")) G.from(".rt-avg .rt-stars svg", { scale: 0, transformOrigin: "50% 50%", stagger: 0.07, duration: 0.6, ease: "back.out(2.2)", scrollTrigger: { trigger: ".rt-avg", start: "top 85%", once: true } });
    if ($(".rt-seal__stars svg")) G.from(".rt-seal__stars svg", { scale: 0, transformOrigin: "50% 50%", stagger: 0.07, duration: 0.6, ease: "back.out(2.2)", scrollTrigger: { trigger: ".rt-seal", start: "top 80%", once: true } });

    // преимущества: горизонтальная лента с закреплением, карточки едут ровно
    mm.add("(min-width: 761px)", () => {
      const pin = $(".feat__pin"), track = $(".feat__track");
      if (!pin || !track) return;
      const dist = () => Math.max(0, track.scrollWidth - innerWidth);
      const tl = G.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: pin, start: "center center", end: () => "+=" + dist(), pin: true, scrub: true, invalidateOnRefresh: true, refreshPriority: 1 } });
      tl.to(track, { x: () => -dist(), duration: 1 }, 0);
      // вступительный текст начинает с полной яркости и слегка уходит, когда наезжают карточки
      const introCard = $(".fcard--intro", track);
      if (introCard) tl.fromTo(introCard, { autoAlpha: 1 }, { autoAlpha: 0.25, duration: 0.35 }, 0.05);
      // абзацы карточек одной высоты, чтобы заголовки стояли на одной линии
      const ps = $$(".fcard:not(.fcard--intro) p", track);
      const eq = () => { ps.forEach((x) => (x.style.minHeight = "")); const m = Math.max(...ps.map((x) => x.offsetHeight)); ps.forEach((x) => (x.style.minHeight = m + "px")); };
      eq(); ST.addEventListener("refreshInit", eq);
      return () => { ST.removeEventListener("refreshInit", eq); ps.forEach((x) => (x.style.minHeight = "")); };
    });

    // клиника изнутри: кадр раскрывается из карточки на весь экран, затем проявляется заголовок
    const tour = $(".tour__pin");
    if (tour) mm.add("(min-width: 761px)", () => {
      const frame = $(".tour__frame", tour), fim = $(".tour__frame img", tour), tt = $(".tour__title", tour);
      // на телефоне кадр стартует широкой карточкой, как фото в лентах, и закрепление короче
      const narrow = () => innerWidth <= 760;
      const tl = G.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: tour, start: "top top", end: () => (narrow() ? "+=85%" : "+=110%"), pin: true, scrub: true, invalidateOnRefresh: true, refreshPriority: 2 } });
      tl.fromTo(frame, { clipPath: () => (narrow() ? "inset(14% 4% 24% 4%)" : "inset(16% 22% 16% 22%)") }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1 }, 0)
        .fromTo(fim, { scale: () => (narrow() ? 1.1 : 1.25) }, { scale: 1, duration: 1 }, 0)
        .fromTo(tt, { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out" }, 0.7)
        .fromTo($$(".sw > span", tt), { yPercent: 110 }, { yPercent: 0, duration: 0.3, stagger: 0.04, ease: "power3.out" }, 0.72)
        .to({}, { duration: 0.25 });
    });
    // телефон: экран не закрепляем (на iPhone закрепление дёргается). Кадр раскрывается из карточки, пока поднимается
    // снизу, двигаем только transform. Где браузер умеет анимации от прокрутки (animation-timeline), это делает CSS
    // без JS, как у Лава Дент, и кадр идёт ровно вместе с пальцем; ниже запасной вариант для остальных браузеров
    if (tour && !(window.CSS && CSS.supports("animation-timeline: view()"))) mm.add("(max-width: 760px)", () => {
      const st = { trigger: tour, start: "top 95%", end: "top 5%", scrub: true };
      G.fromTo($(".tour__frame", tour), { scale: 0.86 }, { scale: 1, ease: "none", scrollTrigger: st });
      G.fromTo($(".tour__frame img", tour), { scale: 1.14 }, { scale: 1, ease: "none", scrollTrigger: st });
      G.fromTo($(".tour__title", tour), { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, ease: "none", scrollTrigger: { trigger: tour, start: "top 30%", end: "top top", scrub: true } });
    });
    // тур на телефоне как у Лава Дент: всё делает CSS от прокрутки (animation-timeline), ниже то же самое для браузеров без неё
    if (pt && !(window.CSS && CSS.supports("animation-timeline: view()") && CSS.supports("timeline-scope: --a"))) mm.add("(max-width: 760px)", () => {
      const items = $(".ptour__items", pt), spacer = $(".ptour__spacer", pt), after = $(".ptour__after", pt);
      const img = $(".ptour__item--main .ptour__img", pt), shade = $(".ptour__item--main .ptour__shade", pt);
      const sides = [[$(".ptour__item--left", pt), -0.2], [$(".ptour__item--right", pt), 0.2]];
      const pars = $$(".ptour__fig[data-par]", pt);
      // карточка как в CSS: окно 80% видимой высоты (--pt-s) от её 10%
      const card = () => {
        const pr = document.createElement("div");
        pr.style.cssText = "position:absolute;top:0;left:0;width:0;visibility:hidden;height:var(--pt-s)";
        pt.append(pr);
        const s = pr.offsetHeight; pr.style.height = "calc(var(--vh, 1vh) * 100)"; const l = pr.offsetHeight; pr.remove();
        const k = (s || l) / l;
        // в процентах от кадра, как в CSS: при смене высоты окна без пересчёта ScrollTrigger окно не устаревает
        return `inset(${10 * k}% 0% ${100 - 90 * k}% 0%)`;
      };
      G.fromTo(items, { x: 0 }, { x: () => -2.25 * innerWidth, ease: "none", scrollTrigger: { trigger: spacer, start: "top top", end: "bottom bottom", scrub: true, invalidateOnRefresh: true } });
      // на телефоне ScrollTrigger не пересчитывается при смене высоты окна; шаг ленты 400vh, поэтому пересчитываем сами, когда он меняется
      let spH = spacer.offsetHeight;
      const ro = new ResizeObserver(() => { if (spacer.offsetHeight !== spH) { spH = spacer.offsetHeight; ST.refresh(); } });
      ro.observe(spacer);
      const zoom = G.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: after, start: "top bottom", end: () => "+=" + innerHeight * 0.5, scrub: true, invalidateOnRefresh: true } });
      zoom.fromTo(img, { clipPath: card, scale: 0.725 }, { clipPath: "inset(0% 0% 0% 0%)", scale: 1.1 }, 0)
        .fromTo(shade, { opacity: 0 }, { opacity: 1, ease: "power1.inOut" }, 0);
      sides.forEach(([el, k]) => el && zoom.fromTo(el, { x: 0 }, { x: () => k * innerWidth }, 0));
      pars.forEach((f) => G.fromTo(f, { y: () => innerHeight * 0.25 }, { y: () => -innerHeight * 0.25, ease: "none", scrollTrigger: { trigger: f, start: "top bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true } }));
      return () => { ro.disconnect(); G.set([items, img, shade, ...sides.map(([el]) => el).filter(Boolean), ...pars], { clearProps: "transform,clipPath,opacity" }); };
    });
    // то же для старых браузеров: окно ведёт по широким фото ленты (вход, ресепшен, врачи) в тех же отрезках прокрутки, что в CSS
    if (pt && !(window.CSS && CSS.supports("animation-timeline: view()") && CSS.supports("timeline-scope: --a"))) mm.add("(max-width: 760px) and (max-aspect-ratio: 4 / 5)", () => {
      const spacer = $(".ptour__spacer", pt);
      const at = (k) => () => `top+=${k * (spacer.offsetHeight - innerHeight)} top`;
      const ranges = [[() => `top bottom-=${0.85 * innerHeight}`, at(0.25)], [at(0.11), at(0.56)], [at(0.44), at(0.89)]];
      const rails = $$(".ptour__items > .ptour__item", pt).slice(1, 4).map((it) => $(".ptour__rail", it));
      rails.forEach((r, i) => r && G.fromTo(r, { xPercent: 0 }, { xPercent: -100, ease: "none", scrollTrigger: { trigger: spacer, start: ranges[i][0], end: ranges[i][1], scrub: true, invalidateOnRefresh: true } }));
      return () => G.set(rails.filter(Boolean), { clearProps: "transform" });
    });
    mm.add("(max-width: 760px)", () => {
      const track = $(".feat__track");
      if (!track) return;
      const cards = $$(".fcard:not(.fcard--intro)", track);
      const upd = () => {
        // сначала замеры всех карточек, потом записи (иначе раскладка пересчитывается на каждой карточке)
        const rs = cards.map((c) => c.getBoundingClientRect());
        for (let i = 0; i < cards.length - 1; i++) {
          const c = rs[i], n = rs[i + 1];
          const k = Math.min(1, Math.max(0, (c.bottom - n.top) / c.height));
          cards[i].style.transform = k ? `scale(${1 - 0.07 * k})` : "";
          cards[i].firstElementChild.style.opacity = String(1 - 0.6 * k);
        }
      };
      const t = ST.create({ trigger: track, start: "top bottom", end: "bottom top", onUpdate: upd, onRefresh: upd });
      return () => { t.kill(); cards.forEach((c) => { c.style.transform = ""; c.firstElementChild.style.opacity = ""; }); };
    });

    // телефон: подвал раскрывается из карточки на всю ширину, как кадр «Здесь вас ждут»
    mm.add("(max-width: 760px)", () => {
      const f = $(".footer");
      if (f) G.fromTo(f, { clipPath: "inset(0% 4% 0% 4% round 28px)" }, { clipPath: "inset(0% 0% 0% 0% round 0px)", ease: "none", scrollTrigger: { trigger: f, start: "top bottom", end: "top 30%", scrub: true } });
    });

    // ленты фото и отзывов едут навстречу друг другу и быстрее прокрутки: пока лента проходит экран,
    // она сдвигается на 1,2 этого пути, поэтому за оборот колеса проезжает больше фото и отзывов.
    // Ленту дополняем копиями (для чтения с экрана скрыты), чтобы её хватило на весь сдвиг.
    const ribbon = (row) => {
      const d = parseFloat(row.dataset.dir) || -1;
      const base = [...row.children];
      const setW = () => base[base.length / 2].offsetLeft - base[0].offsetLeft;
      const dist = () => Math.max((innerHeight + row.offsetHeight) * 1.2, row.classList.contains("rv__row") ? setW() - innerWidth : 0);
      const fill = () => {
        for (let n = 0; n < 8 && row.scrollWidth < dist() + innerWidth + 40; n++) base.forEach((c) => { const k = c.cloneNode(true); k.setAttribute("aria-hidden", "true"); row.appendChild(k); });
      };
      fill();
      ST.addEventListener("refreshInit", fill);
      G.fromTo(row, { x: () => (d < 0 ? 0 : -dist()) }, { x: () => (d < 0 ? -dist() : 0), ease: "none", scrollTrigger: { trigger: row, start: "top bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true } });
      // уход на ширину телефона: снять дозаполнение и копии, иначе скрытая лента копится и потом летит в сотни раз быстрее
      return () => { ST.removeEventListener("refreshInit", fill); while (row.children.length > base.length) row.lastElementChild.remove(); };
    };
    // на телефоне вместо лент свой блок отзывов (assets/rvm.js)
    const ribbons = (sel) => () => { const off = $$(sel).map(ribbon); return () => off.forEach((f) => f()); };
    mm.add("(min-width: 761px)", ribbons(".rv__row"));
    mm.add("(min-width: 761px)", ribbons(".tour__row"));

    // телефон: фото клиники двумя лентами. Ленты сами медленно плывут навстречу друг другу по времени, а не от прокрутки,
    // поэтому при прокрутке страницы не дрожат. Любую ленту можно листать пальцем вбок, вторая при этом крутится
    // в обратную сторону; отпустили — ленты докатываются по инерции. Когда ленты впервые доходят до экрана,
    // они сами проезжают немного быстрее, чтобы было видно, что их листают
    mm.add("(max-width: 760px)", () => {
      const box = $(".tour__rows");
      if (!box || !box.offsetParent) return;   // на телефоне вместо лент тур как у Лава Дент (.ptour)
      const rows = $$(".tour__row", box).map((r) => ({ r, k: $$(":scope > figure:not([aria-hidden])", r).length, dir: parseFloat(r.dataset.dir) || -1, w: 0, set: G.quickSetter(r, "x", "px") }));
      const st = { pos: 0 };
      const wrap = (v, w) => ((v % w) + w) % w;
      const render = () => rows.forEach((o) => { if (o.w) o.set(o.dir < 0 ? -wrap(st.pos, o.w) : wrap(st.pos, o.w) - o.w); });
      const measure = () => { rows.forEach((o) => { const c = o.r.children; o.w = c[o.k] ? c[o.k].offsetLeft - c[0].offsetLeft : 0; }); render(); };
      measure();
      let on = false, drag = false, glide = null;
      const vis = ST.create({ trigger: box, start: "top bottom", end: "bottom top", onToggle: (self) => { on = self.isActive; } });
      const hint = ST.create({ trigger: box, start: "top 80%", once: true, onEnter: () => { if (!drag) glide = G.to(st, { pos: st.pos + Math.min(innerWidth * 0.5, 220), duration: 1.6, ease: "power2.inOut", onUpdate: render }); } });
      const tick = (time, dt) => { if (!on || drag || glide?.isActive()) return; st.pos += 0.024 * Math.min(dt, 50); render(); };
      G.ticker.add(tick);
      let sx = 0, sy = 0, lock = 0, p0 = 0, lx = 0, lt = 0, vel = 0, sign = 1;
      const down = (o) => (e) => {
        if (e.touches.length > 1) return;
        const t = e.touches[0];
        sx = lx = t.clientX; sy = t.clientY; lt = e.timeStamp; lock = 0; vel = 0; p0 = st.pos; sign = o.dir < 0 ? -1 : 1;
      };
      const move = (e) => {
        const t = e.touches[0], dx = t.clientX - sx, dy = t.clientY - sy;
        if (!lock && Math.hypot(dx, dy) > 12) { lock = Math.abs(dx) > Math.abs(dy) * 1.6 ? 1 : -1; if (lock === 1) { drag = true; glide?.kill(); p0 = st.pos - sign * dx; } }
        if (lock !== 1) return;
        const dt = Math.max(1, e.timeStamp - lt);
        vel = Math.max(-2.5, Math.min(2.5, 0.7 * ((t.clientX - lx) / dt) + 0.3 * vel)); lx = t.clientX; lt = e.timeStamp;
        st.pos = p0 + sign * dx; render();
      };
      const up = (e) => {
        if (!drag) { lock = 0; return; }
        drag = false; lock = 0;
        if (e.timeStamp - lt > 90) vel = 0;   // палец остановился перед тем, как отпустить: без инерции
        if (Math.abs(vel) > 0.05) glide = G.to(st, { pos: st.pos + sign * vel * 340, duration: Math.min(1.8, 0.6 + Math.abs(vel) * 0.5), ease: "power3.out", onUpdate: render });
      };
      const offs = rows.map((o) => {
        const d = down(o);
        o.r.addEventListener("touchstart", d, { passive: true });
        o.r.addEventListener("touchmove", move, { passive: true });
        o.r.addEventListener("touchend", up, { passive: true });
        o.r.addEventListener("touchcancel", up, { passive: true });
        return () => { o.r.removeEventListener("touchstart", d); o.r.removeEventListener("touchmove", move); o.r.removeEventListener("touchend", up); o.r.removeEventListener("touchcancel", up); };
      });
      ST.addEventListener("refresh", measure);
      $$("img", box).forEach((im) => { if (!im.complete) im.addEventListener("load", measure, { once: true }); });
      return () => { G.ticker.remove(tick); vis.kill(); hint.kill(); glide?.kill(); ST.removeEventListener("refresh", measure); offs.forEach((f) => f()); rows.forEach((o) => G.set(o.r, { x: 0 })); };
    });

    // бегущая строка: скорость плавно следует за скоростью прокрутки, направление — за её направлением
    $$(".marquee__track").forEach((tr) => {
      const setX = G.quickSetter(tr, "xPercent");
      let x = 0, dir = 1, cur = 1, target = 1;
      ST.create({ trigger: tr, start: "top bottom", end: "bottom top", onUpdate: (self) => { dir = self.direction; target = dir * (1 + Math.min(Math.abs(self.getVelocity()) / 400, 4)); } });
      G.ticker.add((time, dt) => { if (phoneMQ.matches) return; target += (dir - target) * 0.04; cur += (target - cur) * 0.12; x = (x - (cur * dt) / 600) % 50; if (x > 0) x -= 50; setX(x); });
    });

    // телефон: первый экран уходит под шторку слогана, как у Лава Дент (стили и сама механика в styles.css).
    // Строки слогана загораются по очереди, когда верх шторки прошёл середину экрана, один раз.
    // Где нет CSS scroll-driven animations, то же самое по прокрутке делает GSAP
    const opening = $(".opening");
    const sHead = opening && $(".slogan__head", opening);
    if (sHead) {
      const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { sHead.classList.add("is-visible"); io.disconnect(); } }, { threshold: 0, rootMargin: "0px 0px -50% 0px" });
      io.observe(sHead);
    }
    // шторке нужны именованные шкалы прокрутки соседних блоков (timeline-scope); без них слоган ведёт GSAP
    if (sHead && !(window.CSS && CSS.supports("animation-timeline: view()") && CSS.supports("timeline-scope: --a"))) mm.add("(max-width: 760px)", () => {
      const sl = $(".slogan", opening), more = $(".slogan__more", opening);
      const tl = [
        G.fromTo($(".slogan__title", sHead), { y: () => -innerHeight, autoAlpha: 0 }, { y: 0, autoAlpha: 1, ease: "none", immediateRender: true,
          scrollTrigger: { trigger: sl, start: "top bottom", end: "top top", scrub: true, invalidateOnRefresh: true } }),
        G.to(sHead, { autoAlpha: 0, ease: "power1.in", scrollTrigger: { trigger: more, start: "top bottom", end: () => "+=" + innerHeight * 0.5, scrub: true, invalidateOnRefresh: true } }),
      ];
      return () => tl.forEach((t) => { t.scrollTrigger?.kill(); t.kill(); });
    });

    // услуги на телефоне: лента направлений сама показывает, что она листается. Пока блок поднимается снизу,
    // лента прокатывается справа налево к первой вкладке; тронули её пальцем, дальше листает только человек.
    // Тёмная подложка выбранной вкладки переезжает к новой, новая панель въезжает с той стороны, куда листали
    if (dirTabs) mm.add("(max-width: 760px)", () => {
      const glider = document.createElement("span");
      glider.className = "dirs__glider"; glider.setAttribute("aria-hidden", "true");
      dirTabs.appendChild(glider); dirTabs.classList.add("has-glider", "is-rolling");
      const sel = () => $('[aria-selected="true"]', dirTabs);
      const glide = (now) => { const b = sel(); if (!b) return; const v = { x: b.offsetLeft, y: b.offsetTop, width: b.offsetWidth, height: b.offsetHeight }; if (now) G.set(glider, v); else G.to(glider, { ...v, duration: 0.5, ease: "expo.out", overwrite: true }); };
      glide(true);
      const roll = { v: 0 };
      const far = () => Math.max(0, Math.min(dirTabs.scrollWidth - dirTabs.clientWidth, dirTabs.clientWidth * 0.7));
      const tw = G.fromTo(roll, { v: far }, { v: 0, ease: "none", onUpdate: () => { dirTabs.scrollLeft = roll.v; }, scrollTrigger: { trigger: dirTabs, start: "top bottom", end: "top 55%", scrub: 0.5, invalidateOnRefresh: true } });
      dirTabs.scrollLeft = roll.v;
      const stop = () => { if (!tw.scrollTrigger) return; tw.scrollTrigger.kill(); tw.kill(); dirTabs.classList.remove("is-rolling"); };
      dirRollStop = stop;
      dirTabs.addEventListener("pointerdown", stop);
      dirTabs.addEventListener("touchstart", stop, { passive: true });
      let last = dirSeq().indexOf(sel());
      const onPick = (e) => {
        const b = e.currentTarget, seq = dirSeq(), i = seq.indexOf(b), p = $(`[data-panel="dir"][data-key="${b.dataset.tab}"]`);
        stop(); glide(false);
        if (p && i !== last) {
          const kids = $$(".dir__card, li", p);
          G.killTweensOf(kids); G.set(kids, { clearProps: "opacity,transform" });
          G.fromTo(p, { x: i > last ? 70 : -70, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: "expo.out", clearProps: "transform,opacity" });
        }
        last = i;
      };
      const btns = $$("[data-tab]", dirTabs);
      btns.forEach((b) => b.addEventListener("click", onPick));
      const reglide = () => requestAnimationFrame(() => { if (!G.isTweening(glider)) glide(true); });
      ST.addEventListener("refresh", reglide);
      return () => {
        stop(); btns.forEach((b) => b.removeEventListener("click", onPick));
        dirTabs.removeEventListener("pointerdown", stop); dirTabs.removeEventListener("touchstart", stop);
        ST.removeEventListener("refresh", reglide);
        glider.remove(); dirTabs.classList.remove("has-glider"); dirRollStop = () => {};
      };
    });

    // подвал, как у Лава Дент. Пока форма над подвалом уезжает вверх, логотип стоит на месте и открывается из-под неё.
    // На компьютере он сначала во всю ширину (масштаб 1,74), в конце отрезка уменьшается до левой колонки и дальше
    // липнет под шапкой, а справа проезжают контакты. Движение целиком в CSS (на компьютере view-timeline, на телефоне
    // sticky); только в браузерах без view-timeline на компьютере его повторяет GSAP
    const fst = $(".fstage");
    if (fst) {
      const logo = $(".fstage__logo", fst);
      const cssTL = !!window.CSS?.supports?.("animation-timeline: scroll()") && CSS.supports("animation-range: 0% 100%");
      const vmin = () => Math.min(innerWidth, innerHeight);
      // компьютер без view-timeline (Firefox): прокрутку там ведёт Lenis, поэтому GSAP успевает за ней
      if (!cssTL) mm.add("(min-width: 1025px)", () => {
        const tl = G.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: fst, start: "top bottom", end: () => "+=" + Math.round(vmin() * 1.5), scrub: true, invalidateOnRefresh: true } })
          .fromTo(logo, { y: () => -Math.round(vmin() * 1.5) }, { y: 0, duration: 1 }, 0)
          .fromTo(logo, { scale: 1.74 }, { scale: 1, duration: 0.25, immediateRender: true }, 0.75);
        return () => { tl.scrollTrigger?.kill(); tl.kill(); G.set(logo, { clearProps: "transform" }); };
      });
    }

    // пересчитываем позиции, когда догрузились шрифты и картинки (до того, как пользователь доскроллил)
    const refresh = () => ST.refresh();
    document.fonts?.ready.then(refresh);
    addEventListener("load", refresh);
    let rt = 0;
    // фото тура (лента, кадр, телефон) стоят в рамках с размерами из CSS и раскладку не меняют: пересчёт на их догрузку
    // только дёргал прокрутку на компьютере посреди ленты
    $$(".feat img, .apic img").forEach((im) => { if (!im.complete) im.addEventListener("load", () => { if (!im.getClientRects().length) return; clearTimeout(rt); rt = setTimeout(refresh, 200); }, { once: true }); });
  });
  if (introOn || location.hash || scrollY > 0) runLater();
  else { setTimeout(runLater, 2200); addEventListener("scroll", runLater, { passive: true }); }

  // ---------- запись: одна форма ----------
  // в форме только имя и телефон (Ilya 29.10); услуга и врач из ссылки (zapis.html?service=implantaciya&doctor=hludnevskiy) уходят в заявку скрыто
  function booking(box) {
    const bf = $("#b-form", box), steps = $$(".bstep", box), params = new URLSearchParams(location.search);
    const ps = params.get("service"), pd = params.get("doctor");
    const svcs = (() => { try { return JSON.parse($("#um-svc")?.textContent || "{}"); } catch (e) { return {}; } })();
    if (ps && svcs[ps]) $("[name=service]", bf).value = svcs[ps];
    if (pd && docs[pd]) { $("[name=doctor]", bf).value = pd; const n = $("[data-doc]", box); n.textContent = "Врач: " + docs[pd]; n.hidden = false; }
    bf.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (bf.dataset.sending) return;
      bf.dataset.sending = "1"; busy(bf, true); if (bf._err) bf._err.hidden = true;
      try { await sendLead(bf, "zapis"); }
      catch (err) { leadError(bf, err.message); return; }
      finally { delete bf.dataset.sending; busy(bf, false); }
      document.dispatchEvent(new CustomEvent("um:lead", { detail: { form: "zapis" } }));
      steps.forEach((s, i) => (s.hidden = i !== 1));
      scrollTo({ top: 0, behavior: anim ? "smooth" : "auto" }); $("h2", steps[1])?.focus({ preventScroll: true });
    });
  }
})();
