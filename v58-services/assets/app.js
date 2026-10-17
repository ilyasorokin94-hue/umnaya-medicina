// Поведение и анимации макета. GSAP + ScrollTrigger + Lenis лежат в assets/vendor.
// Без скриптов и при «уменьшить движение» весь контент виден сразу.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(pointer: fine)").matches;
  const phoneMQ = matchMedia("(max-width: 760px)");
  const G = window.gsap, ST = window.ScrollTrigger;
  const anim = !!(G && ST) && !reduce;
  window.__umReady = true;
  if (!anim) { root.classList.remove("js-anim", "js-intro"); root.classList.add("no-anim"); }

  // ---------- разбивка текста для анимаций ----------
  const splitWords = (el, cls = "sw") => {
    const words = el.textContent.trim().split(/[ \t\r\n]+/);
    el.setAttribute("aria-label", el.textContent.trim());
    el.innerHTML = words.map((w) => (cls === "sw" ? `<span class="sw" aria-hidden="true"><span>${w}</span></span>` : `<span class="${cls}" aria-hidden="true">${w}</span>`)).join(" ");
    return $$(cls === "sw" ? ".sw > span" : "." + cls, el);
  };

  // ---------- плавная прокрутка ----------
  let lenis = null;
  if (anim && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 1 });
    lenis.on("scroll", ST.update);
    G.ticker.add((t) => lenis.raf(t * 1000));
    G.ticker.lagSmoothing(0);
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
      cur = links.find((a) => !a.hash && a.pathname === location.pathname) || links.find((a) => a.dataset.dir && location.pathname.includes(`/${a.dataset.dir}/`));
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
  // страховка: если первый экран так и не запустился, шапка компьютера всё равно появляется
  setTimeout(() => header?.classList.add("is-loaded"), 6000);
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
      navSecs.forEach(([li, s]) => li.classList.toggle("is-active", seen.has(s)));
    }, { rootMargin: "-45% 0px -50% 0px" });
    navSecs.forEach(([, s]) => io.observe(s));
  } else if (!navSecs.length) {
    const cur = navItems.find((li) => { const a = $("a", li); return !a.hash && a.pathname === location.pathname; })
      || navItems.find((li) => { const d = $("a", li).dataset.dir; return d && location.pathname.includes(`/${d}/`); });
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
        if (!lock && Math.hypot(dx, dy) > 8) lock = Math.abs(dx) > Math.abs(dy) * 1.2 ? 1 : -1;
        if (lock === 1 && anim) G.set(p, { x: dx * 0.35 });
      }, { passive: true });
      const end = (e) => {
        if (cur !== p) return;
        cur = null;
        if (lock !== 1) return;
        const dx = (e.changedTouches[0]?.clientX ?? sx) - sx, seq = dirSeq(), i = seq.findIndex((b) => b.dataset.tab === p.dataset.key);
        const next = Math.abs(dx) > 50 ? seq[i + (dx < 0 ? 1 : -1)] : null;
        if (next) { dirRollStop(); next.click(); } else if (anim) G.to(p, { x: 0, duration: 0.4, ease: "expo.out" });
      };
      p.addEventListener("touchend", end, { passive: true });
      p.addEventListener("touchcancel", end, { passive: true });
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
  const heroCta = $(".hero .hero__actions");
  if ("IntersectionObserver" in window) {
    if (heroCta) {
      // на телефоне первый экран стоит на месте, а шторка слогана наезжает на него: кнопка закрыта, панель нужна
      const curtain = $(".opening .slogan");
      let ctaIn = true;
      const mb = () => root.classList.toggle("mb-off", ctaIn && !(curtain && phoneMQ.matches && curtain.getBoundingClientRect().top < heroCta.getBoundingClientRect().bottom));
      root.classList.add("mb-off");
      new IntersectionObserver(([en]) => { ctaIn = en.isIntersecting; mb(); }, { rootMargin: "-90px 0px 0px 0px" }).observe(heroCta);
      if (curtain) addEventListener("scroll", mb, { passive: true });
    }
    const fcta = $(".footer__cta");
    if (fcta) new IntersectionObserver(([en]) => root.classList.toggle("bar-off", en.isIntersecting), { rootMargin: "0px 0px -30% 0px" }).observe(fcta);
  }
  document.addEventListener("focusin", (e) => { if (e.target.matches?.("input, textarea, select")) root.classList.add("bar-kb"); });
  document.addEventListener("focusout", () => root.classList.remove("bar-kb"));

  // телефон: врач в центре ленты крупнее, соседние чуть меньше и тише, портрет слегка сдвигается внутри рамки
  const tgrid = $(".team__grid:not(.team__grid--lava)");
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

  // врачи как у Лава Дент: от 961px левая колонка едет от +20vmin к −20vmin, пока карточка проходит экран
  // снизу вверх, правая стоит, фото плывёт внутри рамки от +10% к −10%. Прогресс --k от 1 до −1.
  const lavaDocs = $$(".team__grid--lava .doc");
  const lavaMQ = matchMedia("(min-width: 961px)");
  let lavaOff = false;
  function lavaTeam() {
    if (!lavaDocs.length || !anim) return;
    if (!lavaMQ.matches) { if (!lavaOff) { lavaOff = true; lavaDocs.forEach((c) => c.style.removeProperty("--k")); } return; }
    lavaOff = false;
    const vh = innerHeight;
    lavaDocs.forEach((c) => {
      if (c.hidden) return;
      const r = c.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
      c.style.setProperty("--k", (1 - 2 * t).toFixed(4));
    });
  }
  if (lavaDocs.length && anim) {
    if (lenis) lenis.on("scroll", lavaTeam); else addEventListener("scroll", lavaTeam, { passive: true });
    addEventListener("resize", lavaTeam);
    lavaMQ.addEventListener?.("change", lavaTeam);
    lavaTeam();
  }

  // кнопка «наверх»
  $$("[data-totop]").forEach((b) => b.addEventListener("click", () => (lenis ? lenis.scrollTo(0, { duration: 1.6 }) : scrollTo({ top: 0, behavior: "smooth" }))));

  // прайс-страница: поиск и разделы
  const search = $("#p-search");
  if (search) {
    let cat = "";
    const tables = $$(".ptables .ptable");
    const empty = $(".pempty");
    const apply = () => {
      const q = search.value.trim().replace(/\s+/g, " ").toLowerCase();
      let any = false;
      tables.forEach((t) => {
        const inCat = !cat || t.dataset.cat === cat;
        let n = 0;
        $$("li", t).forEach((li) => { const ok = inCat && (!q || li.textContent.replace(/\u00a0/g, " ").toLowerCase().includes(q)); li.hidden = !ok; if (ok) n++; });
        t.hidden = n === 0;
        if (n) any = true;
      });
      empty.hidden = any;
      ST?.refresh();
    };
    search.addEventListener("input", apply);
    $$("[data-filter]").forEach((c) => c.addEventListener("click", () => {
      cat = c.dataset.filter;
      $$("[data-filter]").forEach((x) => x.classList.toggle("is-on", x === c));
      apply();
    }));
  }

  // ---------- онлайн-запись ----------
  const bk = $("#booking");
  if (bk) booking(bk);

  // ---------- окна: запись, перезвон, снимок, расчёт, мессенджеры ----------
  const docs = (() => { try { return JSON.parse($("#um-docs")?.textContent || "{}"); } catch (e) { return {}; } })();
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
      $$('input[name="reason"]', m).forEach((r) => (r.checked = !!reason && r.value === reason));
    }
    m.hidden = false;
    openM = m; if (id !== "offer") anyModal = true;
    root.classList.add("has-modal");
    lenis?.stop();
    // окно услуги выезжает справа, как у Лава Дент (переход в CSS)
    if (m.classList.contains("modal--svc")) { $(".svm", m).scrollTop = 0; m.offsetWidth; m.classList.add("is-in"); }
    else if (anim) {
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
    if (m.classList.contains("modal--svc")) { m.classList.remove("is-in"); if (instant || reduce) done(); else setTimeout(done, 1000); }
    else if (anim && !instant) G.to(m, { opacity: 0, duration: 0.25, ease: "power1.in", onComplete: done });
    else done();
    if (!instant) lastFocus?.focus?.({ preventScroll: true });
  }
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-modal]");
    if (t && showModal(t.dataset.modal, t)) { e.preventDefault(); closeMenu(); return; }
    if (e.target.closest("[data-close]") || e.target.classList.contains("modal")) hideModal();
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

  // отправка любой формы заявки: в демо только «спасибо»; на рабочем сайте здесь уходит заявка в amoCRM
  const doneText = {
    xray: ["Снимок у врача", "Врач посмотрит и ответит в течение рабочего дня. Если зуб можно спасти, скажем, как и сколько это стоит."],
    allon: ["Спасибо!", "Администратор перезвонит за 5 минут и запишет к имплантологу на консультацию с КТ. Расчёт бесплатный."],
  };
  const defDone = $("#m-done [data-done-text]")?.textContent;
  $$("form[data-lead]").forEach((f) => {
    if (f.hasAttribute("data-quiz") || f.classList.contains("cb")) return;
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const kind = f.dataset.lead, d = doneText[kind];
      const dm = $("#m-done");
      if (dm) { $("h2", dm).textContent = d ? d[0] : "Спасибо!"; $("[data-done-text]", dm).textContent = d ? d[1] : defDone; }
      f.reset();
      showModal("done");
    });
  });

  // окно с предложением по центру: через 35 секунд на сайте, если вкладка открыта и человек уже пролистал первый экран,
  // или когда курсор уходит к вкладкам (не раньше 15 секунд). Один раз за визит, после показа молчит 3 дня.
  // Не всплывает поверх других окон и меню, во время ввода и у тех, кто уже открывал запись. Закрывается крестиком, Esc и кликом мимо.
  const offer = $("#m-offer");
  if (offer) {
    const quiet = () => { try { return !!sessionStorage.getItem("um2-exit") || Date.now() - (+localStorage.getItem("um2-offer") || 0) < 3 * 864e5; } catch (err) { return true; } };
    let seen = 0, deep = false;
    addEventListener("scroll", () => { if (scrollY > innerHeight * 0.7) deep = true; }, { passive: true });
    const tryShow = () => {
      if (quiet() || anyModal) return clearInterval(tick);
      if (openM || menu?.classList.contains("is-open") || document.activeElement?.matches?.("input, textarea, select")) return;
      try { sessionStorage.setItem("um2-exit", "1"); localStorage.setItem("um2-offer", String(Date.now())); } catch (err) {}
      clearInterval(tick);
      showModal("offer");
    };
    const tick = setInterval(() => { if (!document.hidden && ++seen >= 35 && deep) tryShow(); }, 1000);
    if (fine) document.addEventListener("mouseout", (e) => { if (!e.relatedTarget && e.clientY <= 8 && seen >= 15) tryShow(); });
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
      $("[data-qprice]", done).textContent = first?.dataset.price || "Консультация и план лечения бесплатно";
      if (bar) bar.style.transform = "scaleX(1)";
      form.hidden = true; done.hidden = false;
      if (anim) G.from(done.children, { opacity: 0, y: 20, stagger: 0.08, duration: 0.6 });
      ST?.refresh();
    });
  });

  // ---------- контакты «дорога до двери» ----------
  // открыто ли сейчас: время Москвы, ежедневно с 9:00 до 21:00
  const nowMsk = () => {
    const pt = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    return +pt.find((x) => x.type === "hour").value * 60 + +pt.find((x) => x.type === "minute").value;
  };
  const isOpen = () => { const t = nowMsk(); return t >= 540 && t < 1260; };
  const openSt = $("[data-open-status]");
  if (openSt) {
    if (isOpen()) { openSt.textContent = "Сейчас открыто, до 21:00"; openSt.classList.add("is-open"); }
    else openSt.textContent = nowMsk() < 540 ? "Сейчас закрыто, откроемся в 9:00" : "Сейчас закрыто, откроемся завтра в 9:00";
  }
  // точки пути: без закрепления (телефон, низкий экран, «уменьшить движение») фото меняются по нажатию на точку
  const wayShots = $$(".way__shot"), wayChips = $$(".way__stops .chip"), wayText = $(".way__text");
  let wayCur = -1, wayTrig = null;
  const wayActive = (i) => {
    if (i === wayCur || !wayShots[i]) return;
    wayCur = i;
    wayChips.forEach((c, k) => { c.classList.toggle("is-on", k === i); c.setAttribute("aria-pressed", String(k === i)); });
    wayShots.forEach((x, k) => x.classList.toggle("is-on", k === i));
    if (wayText) wayText.textContent = $("figcaption span", wayShots[i])?.textContent || "";
  };
  wayActive(0);
  wayChips.forEach((c, i) => c.addEventListener("click", () => {
    if (!wayTrig) return wayActive(i);
    const y = wayTrig.start + ((wayTrig.end - wayTrig.start) * i) / (wayShots.length - 1);
    lenis ? lenis.scrollTo(y, { duration: 0.9 }) : scrollTo(0, y);
  }));
  // карта по кнопке: грузится только при первом открытии
  const mapBtn = $("[data-map-toggle]"), mapWrap = $("#way-map");
  mapBtn?.addEventListener("click", () => {
    const open = mapWrap.hidden, fr = $("iframe", mapWrap);
    if (open && fr && !fr.src) fr.src = fr.dataset.src;
    mapBtn.setAttribute("aria-expanded", String(open));
    mapBtn.textContent = open ? "Скрыть карту" : "Показать карту";
    if (open) {
      mapWrap.hidden = false;
      if (anim) G.from(mapWrap, { height: 0, duration: 0.8, ease: "power3.inOut", clearProps: "height", onComplete: () => ST.refresh() });
      else ST?.refresh();
    } else {
      const fin = () => { mapWrap.hidden = true; if (G) G.set(mapWrap, { clearProps: "height" }); ST?.refresh(); };
      if (anim) G.to(mapWrap, { height: 0, duration: 0.5, ease: "power2.in", onComplete: fin }); else fin();
    }
  });
  $(".way__map")?.addEventListener("click", (e) => e.currentTarget.classList.add("is-active"));
  $(".way__map")?.addEventListener("mouseleave", (e) => e.currentTarget.classList.remove("is-active"));
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

  // ---------- заявка в подвале: одно поле, ответ на месте ----------
  const cb = $(".cb"), cbIn = $("#cb-phone"), cbDone = $(".cb__done"), cbHint = $(".cb__hint");
  if (cb && cbIn && cbDone && cbHint) {
    const hint0 = cbHint.textContent;
    const digits = (v) => { let d = v.replace(/\D/g, ""); if (d[0] === "8") d = "7" + d.slice(1); if (d && d[0] !== "7") d = "7" + d; return d.slice(0, 11); };
    const fmt = (d) => { const r = d.slice(1); let t = "+7"; if (r.length) t += " " + r.slice(0, 3); if (r.length > 3) t += " " + r.slice(3, 6); if (r.length > 6) t += "-" + r.slice(6, 8); if (r.length > 8) t += "-" + r.slice(8, 10); return t; };
    const clearErr = () => { cb.classList.remove("is-error"); cbIn.removeAttribute("aria-invalid"); cbHint.textContent = hint0; };
    cbIn.addEventListener("focus", () => { if (!cbIn.value) cbIn.value = "+7 "; });
    cbIn.addEventListener("blur", () => { if (digits(cbIn.value).length <= 1) cbIn.value = ""; });
    cbIn.addEventListener("input", () => { const d = digits(cbIn.value); cbIn.value = d.length <= 1 ? "+7 " : fmt(d); if (cb.classList.contains("is-error") && d.length === 11) clearErr(); });
    cb.addEventListener("submit", (e) => {
      e.preventDefault();
      const d = digits(cbIn.value);
      if (d.length !== 11) {
        cb.classList.add("is-error"); cbIn.setAttribute("aria-invalid", "true");
        cbHint.textContent = d.length <= 1 ? "Введите номер, и мы перезвоним" : "Не хватает цифр: после +7 нужно 10";
        cbIn.focus();
        if (anim) G.fromTo($(".cb__field", cb), { x: -6 }, { x: 0, duration: 0.5, ease: "elastic.out(1, .35)" });
        return;
      }
      const btn = $(".cb__btn", cb); btn.disabled = true; btn.textContent = "Отправляем";
      // демо: на рабочем сайте здесь заявка уходит в amoCRM с формой «подвал», страницей и UTM-метками
      setTimeout(() => {
        $("[data-done-s]", cbDone).textContent = isOpen()
          ? "Администратор перезвонит за 5 минут с номера +7\u00a0495\u00a0150-36-15."
          : "Сейчас клиника закрыта. Перезвоним утром, после 9:00, с номера +7\u00a0495\u00a0150-36-15.";
        const h0 = cb.offsetHeight;
        cb.hidden = true; cbDone.hidden = false; cbDone.focus({ preventScroll: true });
        if (anim) { G.from(cbDone, { height: h0, duration: 0.6, ease: "power3.out", clearProps: "height" }); G.from(cbDone.children, { y: 16, autoAlpha: 0, duration: 0.6, stagger: 0.06, ease: "power3.out" }); }
        btn.disabled = false; btn.textContent = "Жду звонка"; cbIn.value = ""; clearErr();
      }, 700);
    });
    $("[data-again]", cbDone)?.addEventListener("click", () => { cbDone.hidden = true; cb.hidden = false; cbIn.focus(); });
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
  if (!anim) return;
  G.registerPlugin(ST);
  G.defaults({ ease: "power3.out" });
  ST.config({ ignoreMobileResize: true });

  const heroIn = () => {
    // сигнал первому экрану с имплантом: шторка ушла, можно собирать
    window.__umHeroIn = true;
    document.dispatchEvent(new Event("um:hero-in"));
    // шапка компьютера въезжает сверху и проявляется, линия под разделами убегает влево, как у Лава Дент (CSS);
    // класс ставим через кадр, чтобы браузер успел нарисовать начальное положение
    requestAnimationFrame(() => requestAnimationFrame(() => header?.classList.add("is-loaded")));
    const h = $(".hero, .page-hero");
    if (!h) return;
    const words = $$("[data-split] .sw > span", h);
    const tl = G.timeline();
    const media = h.classList.contains("hero") && $(".hero__media", h);
    const small = phoneMQ.matches;
    if (media) tl.fromTo(media, { clipPath: small ? "inset(0% 0% 100% 0%)" : "inset(10% 6% 10% 6%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: small ? 1.4 : 1.6, ease: "power3.inOut" }, small ? 0.35 : 0);
    const mimg = $(".hero__media img", h);
    if (mimg) tl.from(mimg, { scale: 1.18, duration: 2.4, ease: "power2.out" }, 0);
    tl.from(words, { yPercent: 110, duration: 1.2, stagger: 0.06, ease: "power4.out" }, 0.1)
      .fromTo($$(".kicker, .label, .crumbs, .hero__sub, .page-hero__lead, .hero__facts > *, .hero__promo, .hero__actions > *, .hero__note, .page-hero__aside > *, .doc-hero__facts > *, .doc-hero__cta > *", h), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 1, stagger: 0.07 }, 0.4);
    if (!matchMedia("(min-width: 1025px)").matches) tl.from(".header__bar", { autoAlpha: 0, duration: 0.9 }, 0.2);
    const pb = $(".hero__promo b", h), ps = $(".hero__promo s", h);
    if (small && pb && ps) {
      const orig = pb.textContent, to = +orig.replace(/\D/g, ""), o = { v: +ps.textContent.replace(/\D/g, "") };
      if (to && o.v > to) pb.textContent = ps.textContent.trim();
      if (to && o.v > to) tl.to(o, { v: to, duration: 1.4, ease: "power3.out", onUpdate: () => (pb.textContent = (Math.round(o.v / 100) * 100).toLocaleString("ru-RU").replace(/\s/g, "\u00a0") + "\u00a0₽"), onComplete: () => (pb.textContent = orig) }, 0.9);
    }
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
  if (intro && root.classList.contains("js-intro")) {
    lenis?.stop();
    try { sessionStorage.setItem("um2-intro", "1"); } catch (e) { /* приватный режим */ }
    G.timeline({ onComplete: () => { intro.remove(); lenis?.start(); root.classList.remove("js-intro"); } })
      .from(".intro__logo", { autoAlpha: 0, y: 16, duration: 0.8 })
      .from(".intro__word", { autoAlpha: 0, duration: 0.8 }, 0.15)
      .to(".intro__bar i", { scaleX: 1, duration: 0.9, ease: "power2.inOut" }, 0.15)
      .to(".intro__in", { autoAlpha: 0, y: -20, duration: 0.4, ease: "power2.in" }, "+=0.05")
      .to(intro, { yPercent: -100, duration: 1, ease: "power4.inOut" }, "-=0.1")
      .add(heroIn, "-=0.7");
  } else {
    intro?.remove();
    heroIn();
  }

  // первый экран главной: фото чуть сдвигается внутри рамки, текст не тает (его ещё читают)
  // на внутренних страницах текст первого экрана спокойно тает, на телефоне нет
  const mm = G.matchMedia();
  const hero = $(".hero");
  if (hero && $(".hero__media img", hero)) G.fromTo(".hero__media img", { yPercent: 0 }, { yPercent: -6, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
  mm.add("(min-width: 761px)", () => {
    const ph = $(".page-hero");
    if (ph) G.to($(".page-hero__in, .doc-hero__text", ph), { y: -60, autoAlpha: 0.2, ease: "none", scrollTrigger: { trigger: ph, start: "30% top", end: "bottom top", scrub: true } });
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
      const s = pr.offsetHeight; pr.style.height = "100vh"; const l = pr.offsetHeight; pr.remove();
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
  mm.add("(max-width: 760px)", () => {
    const track = $(".feat__track");
    if (!track) return;
    const cards = $$(".fcard:not(.fcard--intro)", track);
    const upd = () => {
      for (let i = 0; i < cards.length - 1; i++) {
        const c = cards[i].getBoundingClientRect(), n = cards[i + 1].getBoundingClientRect();
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
  };
  $$(".rv__row").forEach(ribbon);
  mm.add("(min-width: 761px)", () => $$(".tour__row").forEach(ribbon));

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
      if (!lock && Math.hypot(dx, dy) > 6) { lock = Math.abs(dx) > Math.abs(dy) ? 1 : -1; if (lock === 1) { drag = true; glide?.kill(); p0 = st.pos - sign * dx; } }
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
  // шторке нужны именованные шкалы прокрутки соседних блоков (timeline-scope); без них имплант и слоган ведёт GSAP
  if (sHead && !(window.CSS && CSS.supports("animation-timeline: view()") && CSS.supports("timeline-scope: --a"))) mm.add("(max-width: 760px)", () => {
    const sl = $(".slogan", opening), more = $(".slogan__more", opening), d3 = $(".hero__3d", opening);
    const tl = [
      G.fromTo($(".slogan__title", sHead), { y: () => -innerHeight, autoAlpha: 0 }, { y: 0, autoAlpha: 1, ease: "none", immediateRender: true,
        scrollTrigger: { trigger: sl, start: "top bottom", end: "top top", scrub: true, invalidateOnRefresh: true } }),
      G.to(sHead, { autoAlpha: 0, ease: "power1.in", scrollTrigger: { trigger: more, start: "top bottom", end: () => "+=" + innerHeight * 0.5, scrub: true, invalidateOnRefresh: true } }),
    ];
    if (d3) tl.push(G.fromTo(d3, { clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)" }, { clipPath: "polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)", ease: "power1.in",
      scrollTrigger: { trigger: sl, start: "top bottom", end: () => "+=" + innerHeight * 0.75, scrub: true, invalidateOnRefresh: true } }));
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

  // контакты: сцена закрепляется, прокрутка ведёт от улицы к двери, каждое фото поднимается шторкой.
  // Создаётся после ленты «путь», поэтому её отступ учтён; refreshPriority как у неё
  if (wayShots.length > 1) mm.add("(min-width: 1025px) and (min-height: 780px)", () => {
    const n = wayShots.length, imgs = wayShots.map((x) => $("img", x)), way = $(".way");
    way.classList.add("is-pinned");
    const tl = G.timeline({ defaults: { ease: "none" }, scrollTrigger: {
      trigger: ".way__stage", start: "top top", end: () => "+=" + Math.round((n - 1) * innerHeight * 0.55), pin: true, scrub: true, invalidateOnRefresh: true, refreshPriority: 1,
      onUpdate: (self) => wayActive(Math.round(self.progress * (n - 1))),
    } });
    wayTrig = tl.scrollTrigger;
    for (let i = 1; i < n; i++) {
      tl.fromTo(wayShots[i], { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1 }, i - 1)
        .fromTo(imgs[i], { scale: 1.18, yPercent: 4 }, { scale: 1, yPercent: 0, duration: 1 }, i - 1)
        .to(imgs[i - 1], { scale: 1.1, yPercent: -3, duration: 1 }, i - 1);
    }
    return () => { wayTrig = null; way.classList.remove("is-pinned"); G.set(wayShots, { clearProps: "clipPath" }); G.set(imgs, { clearProps: "transform" }); };
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
  // фото тура на телефоне раскладку не меняют, а скрытые копии не видны: для них пересчёт только дёргает прокрутку
  $$(".tour img:not(.ptour img), .feat img, .apic img").forEach((im) => { if (!im.complete) im.addEventListener("load", () => { if (!im.getClientRects().length) return; clearTimeout(rt); rt = setTimeout(refresh, 200); }, { once: true }); });

  // ---------- запись: шаги ----------
  function booking(box) {
    const data = JSON.parse($("#bdata").textContent);
    const state = { service: null, doctor: null, date: null, time: null };
    const steps = $$(".bstep", box);
    const bars = $$(".bsteps span", box);
    const sum = Object.fromEntries($$("[data-sum]").map((d) => [d.dataset.sum, d]));
    const params = new URLSearchParams(location.search);
    const fmtDay = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });
    const fmtDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", weekday: "long" });
    let cur = 0;

    const setSum = (k, v) => { const d = sum[k]; if (!d) return; d.textContent = v || "не выбрано"; d.classList.toggle("is-empty", !v); };
    const go = (n) => {
      const from = steps[cur], to = steps[n];
      cur = n;
      bars.forEach((b, i) => b.classList.toggle("is-done", i < n));
      const show = () => { steps.forEach((s) => (s.hidden = s !== to)); if (anim) G.fromTo(to, { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.7, ease: "expo.out", clearProps: "transform" }); scrollTo({ top: 0, behavior: anim ? "smooth" : "auto" }); $("h1, h2", to)?.focus({ preventScroll: true }); };
      if (anim && from && from !== to) G.to(from, { opacity: 0, x: -40, duration: 0.3, ease: "power2.in", onComplete: show });
      else show();
    };

    // шаг 1: услуга
    const svcBox = $("#b-services", box);
    svcBox.innerHTML = data.services.map((s) => `<button type="button" class="opt" data-v="${s.slug}" aria-pressed="false"><b>${s.title}</b><small>${s.short} · ${s.from}</small></button>`).join("") +
      `<button type="button" class="opt" data-v="consult" aria-pressed="false"><b>Не знаю, нужна консультация</b><small>Врач осмотрит и составит план</small></button>`;
    // шаг 2: врач
    const renderDocs = () => {
      const list = data.doctors.filter((d) => !state.service || state.service === "consult" || d.tags.includes(state.service));
      $("#b-doctors", box).innerHTML = `<button type="button" class="opt opt--doc" data-v="any" aria-pressed="false"><span class="opt__ph">✦</span><b>Любой врач</b><small>Ближайшее свободное время</small></button>` +
        list.map((d) => `<button type="button" class="opt opt--doc" data-v="${d.id}" aria-pressed="false"><span class="opt__ph">${d.photo ? `<img src="${d.photo}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}${d.initials}</span><b>${d.short}</b><small>${d.role}</small></button>`).join("");
    };
    // шаг 3: дата и время (пример расписания)
    const days = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) { const d = new Date(today); d.setDate(today.getDate() + i); days.push(d); }
    $("#b-days", box).innerHTML = days.map((d, i) => `<button type="button" class="day" data-i="${i}" aria-pressed="false"><small>${i === 0 ? "сегодня" : fmtDay.format(d)}</small><b>${d.getDate()}</b></button>`).join("");
    const times = []; for (let h = 9; h < 21; h++) for (const m of ["00", "30"]) times.push(`${h}:${m}`);
    const renderSlots = () => {
      const seed = (state.date?.getDate() || 1) * 7 + (state.doctor ? state.doctor.length : 3);
      const now = new Date();
      $("#b-slots", box).innerHTML = times.map((t, i) => {
        const [h, m] = t.split(":").map(Number);
        const past = state.date && state.date.toDateString() === now.toDateString() && (h < now.getHours() + 1 || (h === now.getHours() + 1 && m < now.getMinutes()));
        const busy = past || (i * 13 + seed * 5) % 7 < 3;
        return `<button type="button" class="slot" data-v="${t}" aria-pressed="false"${busy ? " disabled" : ""}>${t}</button>`;
      }).join("");
    };

    const pick = (wrap, btn) => { $$("[aria-pressed]", wrap).forEach((b) => b.setAttribute("aria-pressed", String(b === btn))); };
    box.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.matches("[data-start]")) return go(1);
      if (b.matches("[data-back]")) return go(Math.max(0, cur - 1));
      if (b.closest("#b-services")) {
        pick(svcBox, b); state.service = b.dataset.v; state.doctor = null;
        setSum("service", $("b", b).textContent); setSum("doctor", ""); renderDocs(); setTimeout(() => go(2), 250); return;
      }
      if (b.closest("#b-doctors")) {
        pick($("#b-doctors", box), b); state.doctor = b.dataset.v;
        setSum("doctor", $("b", b).textContent); renderSlots(); setTimeout(() => go(3), 250); return;
      }
      if (b.closest("#b-days")) {
        pick($("#b-days", box), b); state.date = days[+b.dataset.i]; state.time = null;
        setSum("date", fmtDate.format(state.date)); renderSlots(); $("[data-next-time]", box).disabled = true;
        if (anim) G.from("#b-slots .slot", { opacity: 0, y: 12, stagger: 0.012, duration: 0.4 });
        return;
      }
      if (b.closest("#b-slots")) {
        pick($("#b-slots", box), b); state.time = b.dataset.v;
        setSum("date", fmtDate.format(state.date) + ", " + state.time); $("[data-next-time]", box).disabled = false; return;
      }
      if (b.matches("[data-next-time]")) return go(4);
    });
    $("#b-form", box).addEventListener("submit", (e) => { e.preventDefault(); go(5); });

    // предвыбор из ссылки: zapis.html?service=implantaciya&doctor=hludnevskiy
    renderDocs();
    const ps = params.get("service"), pd = params.get("doctor");
    if (ps) { const b = $(`#b-services [data-v="${ps}"]`, box); if (b) { pick(svcBox, b); state.service = ps; setSum("service", $("b", b).textContent); renderDocs(); } }
    if (pd) { const b = $(`#b-doctors [data-v="${pd}"]`, box); if (b) { pick($("#b-doctors", box), b); state.doctor = pd; setSum("doctor", $("b", b).textContent); } }
    // выбираем первый день, где есть окна
    const d0 = $("#b-days .day", box); if (d0) { pick($("#b-days", box), d0); state.date = days[0]; setSum("date", fmtDate.format(days[0])); renderSlots(); }
    if (ps || pd) go(pd ? 3 : 2);
  }
})();
