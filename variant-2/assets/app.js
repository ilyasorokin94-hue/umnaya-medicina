// Поведение и анимации макета. GSAP + ScrollTrigger + Lenis лежат в assets/vendor.
// Без скриптов и при «уменьшить движение» весь контент виден сразу.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(pointer: fine)").matches;
  const G = window.gsap, ST = window.ScrollTrigger;
  const anim = !!(G && ST) && !reduce;
  window.__umReady = true;
  if (!anim) { root.classList.remove("js-anim", "js-intro"); root.classList.add("no-anim"); }

  // ---------- разбивка текста для анимаций ----------
  const splitWords = (el, cls = "sw") => {
    const words = el.textContent.trim().split(/\s+/);
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
    if (lenis) lenis.scrollTo(el, { offset: -headerH(), duration: 1.4 });
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
    burger?.setAttribute("aria-expanded", "false");
    lenis?.start();
  }
  burger?.addEventListener("click", () => {
    menu.classList.add("is-open");
    burger.setAttribute("aria-expanded", "true");
    lenis?.stop();
    $(".menu__close", menu)?.focus();
  });
  $(".menu__close")?.addEventListener("click", () => { closeMenu(); burger?.focus(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

  // ---------- шапка: всегда на месте, уезжает вверх ровно вместе с демо-полосой ----------
  const header = $(".header");
  const demo = $(".demo-bar");
  let demoH = 0;
  const setDemo = () => { demoH = demo ? demo.offsetHeight : 0; onScrollHeader(); };
  const onScrollHeader = () => {
    const y = lenis ? lenis.scroll : scrollY;
    root.style.setProperty("--hdr-top", Math.max(0, demoH - y) + "px");
    header?.classList.toggle("is-scrolled", y > demoH + 10);
  };
  if (lenis) lenis.on("scroll", onScrollHeader); else addEventListener("scroll", onScrollHeader, { passive: true });
  addEventListener("resize", setDemo);
  setDemo();

  // подсветка пункта меню текущего раздела
  const navLinks = $$('.nav a[href^="#"]');
  if (navLinks.length && "IntersectionObserver" in window) {
    const map = new Map(navLinks.map((a) => [a.hash.slice(1), a]));
    const io = new IntersectionObserver((ents) => ents.forEach((en) => {
      if (en.isIntersecting) navLinks.forEach((a) => a.classList.toggle("is-active", a === map.get(en.target.id)));
    }), { rootMargin: "-45% 0px -50% 0px" });
    map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }

  // ---------- слайды в карточке героя ----------
  const slides = $$(".hero__slides img");
  if (slides.length > 1) {
    let i = 0;
    setInterval(() => { slides[i].classList.remove("is-on"); i = (i + 1) % slides.length; slides[i].classList.add("is-on"); }, 3600);
  }

  // ---------- вкладки (команда, прайс, FAQ) ----------
  const fadeIn = (els) => { if (anim && els.length) G.fromTo(els, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.05, ease: "expo.out", clearProps: "transform" }); };
  $$("[data-tabs]").forEach((group) => {
    const kind = group.dataset.tabs;
    const btns = $$("[data-tab]", group);
    btns.forEach((b) => b.addEventListener("click", () => {
      btns.forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      const val = b.dataset.tab;
      if (kind === "team") {
        const shown = [];
        $$(".team__grid .doc").forEach((d) => { const ok = !val || d.dataset.tags.split(" ").includes(val); d.hidden = !ok; if (ok) shown.push(d); });
        fadeIn(shown);
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

  // переключатель предложений в прайсе
  const offers = $$(".offer__item");
  const dots = $$(".offer__switch button");
  dots.forEach((d, i) => d.addEventListener("click", () => {
    offers.forEach((o, j) => (o.hidden = j !== i));
    dots.forEach((x, j) => x.setAttribute("aria-pressed", String(j === i)));
    fadeIn([offers[i]]);
  }));

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
    m.addEventListener("click", () => m.classList.add("is-active"));
    m.addEventListener("mouseleave", () => m.classList.remove("is-active"));
  });

  // кнопка «наверх»
  $$("[data-totop]").forEach((b) => b.addEventListener("click", () => (lenis ? lenis.scrollTo(0, { duration: 1.6 }) : scrollTo({ top: 0, behavior: "smooth" }))));

  // прайс-страница: поиск и разделы
  const search = $("#p-search");
  if (search) {
    let cat = "";
    const tables = $$(".ptables .ptable");
    const empty = $(".pempty");
    const apply = () => {
      const q = search.value.trim().toLowerCase();
      let any = false;
      tables.forEach((t) => {
        const inCat = !cat || t.dataset.cat === cat;
        let n = 0;
        $$("li", t).forEach((li) => { const ok = inCat && (!q || li.textContent.toLowerCase().includes(q)); li.hidden = !ok; if (ok) n++; });
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
    openM = m; anyModal = true;
    root.classList.add("has-modal");
    lenis?.stop();
    if (anim) {
      G.fromTo(m, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power1.out" });
      G.fromTo($(".modal__box", m), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "expo.out", clearProps: "transform,opacity" });
    }
    ($("input:not([type=hidden]):not([type=radio])", m) || $("h2", m))?.focus({ preventScroll: true });
    return true;
  };
  function hideModal(instant) {
    const m = openM;
    if (!m) return;
    openM = null;
    const done = () => { m.hidden = true; m.style.opacity = ""; if (!openM) { root.classList.remove("has-modal"); lenis?.start(); } };
    if (anim && !instant) G.to(m, { opacity: 0, duration: 0.25, ease: "power1.in", onComplete: done });
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
    if (f.hasAttribute("data-quiz")) return;
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const kind = f.dataset.lead, d = doneText[kind];
      const dm = $("#m-done");
      if (dm) { $("h2", dm).textContent = d ? d[0] : "Спасибо!"; $("[data-done-text]", dm).textContent = d ? d[1] : defDone; }
      f.reset();
      showModal("done");
    });
  });

  // окно-заявка: один раз за визит. На компьютере, когда курсор уходит из окна (не раньше 15 с),
  // на любом устройстве после 60 с на сайте. Не показываем, если человек уже открывал любое окно.
  if ($("#m-exit")) {
    const t0 = Date.now();
    const tryExit = () => {
      if (openM || anyModal) return;
      try { if (sessionStorage.getItem("um2-exit")) return; sessionStorage.setItem("um2-exit", "1"); } catch (err) { return; }
      showModal("exit");
    };
    if (fine) document.addEventListener("mouseout", (e) => { if (!e.relatedTarget && e.clientY <= 8 && Date.now() - t0 > 15000) tryExit(); });
    setTimeout(tryExit, 60000);
  }

  // расчёт All-on-4: система и число челюстей
  $$("[data-calc]").forEach((box) => {
    const c = JSON.parse(box.dataset.calc);
    let sys = 0, jaws = 1;
    const fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    const set = (k, v, rub = true) => { const el = $(`[data-c="${k}"]`, box); if (el) el.textContent = fmt(v) + (rub ? " ₽" : ""); };
    const totalEl = $('[data-c="total"]', box);
    const upd = () => {
      const [, surg, old] = c.systems[sys];
      const t = (surg + c.temp + c.perm) * jaws;
      set("surg", surg * jaws); set("temp", c.temp * jaws); set("perm", c.perm * jaws);
      const o = $('[data-c="old"]', box);
      if (o) { o.hidden = !old; if (old) o.textContent = fmt(old * jaws) + " ₽"; }
      set("day", (surg + c.temp) * jaws); set("later", c.perm * jaws);
      const from = parseFloat(totalEl.textContent.replace(/\s/g, "")) || t;
      if (anim) { const v = { n: from }; G.to(v, { n: t, duration: 0.8, ease: "power2.out", onUpdate: () => (totalEl.textContent = fmt(v.n)) }); }
      else totalEl.textContent = fmt(t);
    };
    box.addEventListener("click", (e) => {
      const b = e.target.closest("[data-sys], [data-jaws]");
      if (!b) return;
      if (b.dataset.sys) sys = +b.dataset.sys; else jaws = +b.dataset.jaws;
      $$(b.dataset.sys ? "[data-sys]" : "[data-jaws]", box).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      upd();
    });
  });

  // квиз: вопрос за вопросом, без номеров, полоска прогресса
  $$("[data-quiz]").forEach((form) => {
    const wrap = form.closest(".quiz"), steps = $$(".quiz__step", form), bar = $(".quiz__bar i", wrap);
    let cur = 0;
    const go = (n) => {
      const from = steps[cur], to = steps[n];
      cur = n;
      if (bar) bar.style.transform = `scaleX(${n / (steps.length - 1)})`;
      const show = () => { steps.forEach((s) => (s.hidden = s !== to)); if (anim) G.fromTo(to, { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.5, ease: "expo.out", clearProps: "transform" }); };
      if (anim && from !== to) G.to(from, { opacity: 0, x: -30, duration: 0.2, ease: "power2.in", onComplete: show }); else show();
    };
    form.addEventListener("change", (e) => {
      if (e.target.type === "radio") setTimeout(() => go(Math.min(cur + 1, steps.length - 1)), 220);
    });
    form.addEventListener("click", (e) => { if (e.target.closest("[data-qback]")) go(Math.max(0, cur - 1)); });
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

  // ---------- анимации ----------
  // Правило: прокрутку сглаживает только Lenis, поэтому все scrub = true (без второго сглаживания),
  // одно свойство одного элемента ведёт одна анимация, CSS-переходы на этих свойствах выключены.
  if (!anim) return;
  G.registerPlugin(ST);
  G.defaults({ ease: "power3.out" });
  ST.config({ ignoreMobileResize: true });

  const heroIn = () => {
    const h = $(".hero, .page-hero");
    if (!h) return;
    const words = $$("[data-split] .sw > span", h);
    const tl = G.timeline();
    tl.from($(".hero__media img", h), { scale: 1.18, duration: 2.4, ease: "power2.out" }, 0)
      .from(words, { yPercent: 110, duration: 1.2, stagger: 0.06, ease: "power4.out" }, 0.1)
      .from($$(".kicker, .label, .crumbs, .hero__sub, .page-hero__lead, .hero__facts > *, .hero__promo, .hero__actions > *, .hero__note, .hero__offer, .page-hero__aside > *, .doc-hero__facts > *, .doc-hero__cta > *", h), { autoAlpha: 0, y: 24, duration: 1, stagger: 0.07 }, 0.4)
      .from(".header__bar", { y: -24, autoAlpha: 0, duration: 0.9 }, 0.2);
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

  // герой: фон уходит медленнее страницы, текст спокойно тает
  // на телефоне первый экран выше окна (оффер, кнопки), поэтому текст не тает: его ещё читают
  const mm = G.matchMedia();
  const hero = $(".hero");
  if (hero) G.to(".hero__media", { yPercent: 22, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
  mm.add("(min-width: 761px)", () => {
    if (hero) G.to(".hero__in", { y: -80, autoAlpha: 0, ease: "none", scrollTrigger: { trigger: hero, start: "40% top", end: "95% top", scrub: true } });
    const ph = $(".page-hero");
    if (ph) G.to($(".page-hero__in, .doc-hero__text", ph), { y: -60, autoAlpha: 0.2, ease: "none", scrollTrigger: { trigger: ph, start: "30% top", end: "bottom top", scrub: true } });
  });

  // заголовки разделов: слова поднимаются из-под строки
  $$("[data-split]").forEach((el) => {
    if (el.closest(".hero, .page-hero")) return;
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
    G.to(el, { clipPath: "inset(0% 0% 0% 0% round 22px)", duration: 1.4, ease: "power3.inOut", scrollTrigger: st });
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

  // преимущества: горизонтальная лента с закреплением, карточки едут ровно
  mm.add("(min-width: 761px)", () => {
    const pin = $(".feat__pin"), track = $(".feat__track");
    if (!pin || !track) return;
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    const tw = G.to(track, { x: () => -dist(), ease: "none", scrollTrigger: { trigger: pin, start: "top top", end: () => "+=" + dist(), pin: true, anticipatePin: 1, scrub: true, invalidateOnRefresh: true } });
    // вступительный текст слегка уходит, когда наезжают карточки
    const introCard = $(".fcard--intro", track);
    if (introCard) G.to(introCard, { autoAlpha: 0.25, ease: "none", scrollTrigger: { trigger: introCard, containerAnimation: tw, start: "right 60%", end: "right 10%", scrub: true } });
  });

  // клиника изнутри: кадр раскрывается из карточки на весь экран, затем проявляется заголовок
  const tour = $(".tour__pin");
  if (tour) {
    const frame = $(".tour__frame", tour), fim = $(".tour__frame img", tour), tt = $(".tour__title", tour);
    const tl = G.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: tour, start: "top top", end: "+=110%", pin: true, anticipatePin: 1, scrub: true } });
    tl.fromTo(frame, { clipPath: "inset(16% 22% 16% 22% round 28px)" }, { clipPath: "inset(0% 0% 0% 0% round 0px)", duration: 1 }, 0)
      .fromTo(fim, { scale: 1.25 }, { scale: 1, duration: 1 }, 0)
      .fromTo(tt, { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out" }, 0.7)
      .to({}, { duration: 0.25 });
  }
  // ленты фото и отзывов едут навстречу друг другу; за один оборот колеса проезжает больше карточек (просьба Ilya 16.10)
  $$(".tour__row, .rv__row").forEach((row) => {
    const d = parseFloat(row.dataset.dir) || -1;
    const dist = () => Math.min(row.scrollWidth / 2, innerWidth * (innerWidth <= 760 ? 0.9 : 0.6));
    G.fromTo(row, { x: () => (d < 0 ? 0 : -dist()) }, { x: () => (d < 0 ? -dist() : 0), ease: "none", scrollTrigger: { trigger: row, start: "top bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true } });
  });

  // бегущая строка: скорость плавно следует за скоростью прокрутки, направление — за её направлением
  $$(".marquee__track").forEach((tr) => {
    const loop = G.to(tr, { xPercent: -50, duration: 30, ease: "none", repeat: -1 });
    let dir = 1, cur = 1, target = 1;
    ST.create({ trigger: tr, start: "top bottom", end: "bottom top", onUpdate: (self) => { dir = self.direction; target = dir * (1 + Math.min(Math.abs(self.getVelocity()) / 400, 4)); } });
    G.ticker.add(() => { target += (dir - target) * 0.04; cur += (target - cur) * 0.12; loop.timeScale(cur); });
  });

  // подвал: логотип поднимается
  const big = $(".footer__big");
  if (big) G.from(big.children, { yPercent: 50, autoAlpha: 0, ease: "none", scrollTrigger: { trigger: ".footer", start: "top 85%", end: "bottom bottom", scrub: true } });

  // пересчитываем позиции, когда догрузились шрифты и картинки (до того, как пользователь доскроллил)
  const refresh = () => ST.refresh();
  document.fonts?.ready.then(refresh);
  addEventListener("load", refresh);
  let rt = 0;
  $$(".tour img, .feat img, .collage img").forEach((im) => { if (!im.complete) im.addEventListener("load", () => { clearTimeout(rt); rt = setTimeout(refresh, 200); }, { once: true }); });

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
