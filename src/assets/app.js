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

  // ---------- шапка: прячется при прокрутке вниз ----------
  const header = $(".header");
  const demo = $(".demo-bar");
  const setDemo = () => root.style.setProperty("--demo-h", (demo ? demo.offsetHeight : 0) + "px");
  setDemo(); addEventListener("resize", setDemo);
  let lastY = scrollY;
  addEventListener("scroll", () => {
    const y = scrollY;
    if (header && !menu?.classList.contains("is-open") && y > 260 && y > lastY + 2) header.classList.add("is-hidden");
    if (y < lastY - 2 || y < 260) header?.classList.remove("is-hidden");
    header?.classList.toggle("is-scrolled", y > 40);
    lastY = y;
  }, { passive: true });

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
        $$(`[data-panel="${kind}"]`).forEach((p) => { p.hidden = p.dataset.key !== val; if (!p.hidden) fadeIn($$("li, .qa", p)); });
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

  // картинка за курсором в списке услуг
  const hv = $(".hover-img");
  if (hv && fine) {
    const himg = $("img", hv);
    let x = 0, y = 0, cx = 0, cy = 0, raf = 0;
    const loop = () => { cx += (x - cx) * 0.18; cy += (y - cy) * 0.18; hv.style.left = cx + "px"; hv.style.top = cy + "px"; raf = requestAnimationFrame(loop); };
    $$(".svc-row[data-img]").forEach((row) => {
      row.addEventListener("mouseenter", (e) => { himg.src = row.dataset.img; x = cx = e.clientX; y = cy = e.clientY; hv.classList.add("is-on"); cancelAnimationFrame(raf); loop(); });
      row.addEventListener("mousemove", (e) => { x = e.clientX; y = e.clientY; });
      row.addEventListener("mouseleave", () => { hv.classList.remove("is-on"); cancelAnimationFrame(raf); });
    });
  }

  // «магнитные» кнопки
  if (anim && fine) {
    $$("[data-magnet]").forEach((b) => {
      const xTo = G.quickTo(b, "x", { duration: 0.6, ease: "elastic.out(1, .4)" });
      const yTo = G.quickTo(b, "y", { duration: 0.6, ease: "elastic.out(1, .4)" });
      b.addEventListener("pointermove", (e) => { const r = b.getBoundingClientRect(); xTo((e.clientX - r.left - r.width / 2) * 0.3); yTo((e.clientY - r.top - r.height / 2) * 0.4); });
      b.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
    });
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

  // ---------- анимации ----------
  if (!anim) return;
  G.registerPlugin(ST);
  G.defaults({ ease: "expo.out" });

  const heroIn = () => {
    const h = $(".hero, .page-hero");
    if (!h) return;
    const words = $$("[data-split] .sw > span", h);
    const tl = G.timeline();
    tl.from($(".hero__media img", h), { scale: 1.25, duration: 2.2, ease: "power3.out" }, 0)
      .from(words, { yPercent: 115, duration: 1.3, stagger: 0.07 }, 0.15)
      .from($$(".kicker, .label, .crumbs, .hero__sub, .page-hero__lead, .hero__actions > *, .hero__side > *, .page-hero__aside > *", h), { opacity: 0, y: 30, duration: 1.1, stagger: 0.08 }, 0.45)
      .from(".header__bar", { y: -30, opacity: 0, duration: 1 }, 0.3);
  };

  // разбиваем заголовки до первого кадра
  $$("[data-split]").forEach((el) => splitWords(el));

  const intro = $(".intro");
  if (intro && root.classList.contains("js-intro")) {
    lenis?.stop();
    try { sessionStorage.setItem("um-intro", "1"); } catch (e) { /* приватный режим */ }
    G.timeline({ onComplete: () => { intro.remove(); lenis?.start(); root.classList.remove("js-intro"); } })
      .from(".intro__logo", { opacity: 0, y: 20, duration: 0.9 })
      .from(".intro__word", { opacity: 0, letterSpacing: "0.6em", duration: 1 }, 0.1)
      .to(".intro__bar i", { scaleX: 1, duration: 1.1, ease: "power2.inOut" }, 0.2)
      .to(".intro__in", { opacity: 0, y: -30, duration: 0.5, ease: "power2.in" }, "+=0.1")
      .to(intro, { yPercent: -100, duration: 1.1, ease: "power4.inOut" }, "-=0.15")
      .add(heroIn, "-=0.75");
  } else {
    intro?.remove();
    heroIn();
  }

  // герой уходит при прокрутке
  const hero = $(".hero");
  if (hero) {
    G.to(".hero__media img", { yPercent: 14, scale: 1.08, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
    G.to(".hero__in", { yPercent: -18, opacity: 0.15, ease: "none", scrollTrigger: { trigger: hero, start: "35% top", end: "bottom top", scrub: true } });
  }

  // заголовки разделов: слова поднимаются
  $$("[data-split]").forEach((el) => {
    if (el.closest(".hero, .page-hero")) return;
    G.from($$(".sw > span", el), { yPercent: 115, duration: 1.2, stagger: 0.05, scrollTrigger: { trigger: el, start: "top 88%", once: true } });
  });

  // появление блоков пачками
  ST.batch("[data-reveal]", {
    start: "top 90%", once: true,
    onEnter: (els) => G.to(els, { opacity: 1, y: 0, scale: 1, duration: 1.1, stagger: 0.09, overwrite: true, clearProps: "transform" }),
  });

  // картинки раскрываются шторкой
  $$("[data-clip]").forEach((el) => {
    const im = $("img", el);
    G.to(el, { clipPath: "inset(0% 0% 0% 0% round 22px)", duration: 1.5, ease: "power4.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } });
    if (im) G.from(im, { scale: 1.25, duration: 1.8, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } });
  });

  // параллакс: картинка внутри рамки
  $$("[data-parallax]").forEach((fig) => {
    const im = $("img", fig);
    if (im) G.fromTo(im, { yPercent: -12 }, { yPercent: 0, ease: "none", scrollTrigger: { trigger: fig, start: "top bottom", end: "bottom top", scrub: true } });
  });
  // параллакс: элементы движутся с разной скоростью
  $$("[data-speed]").forEach((el) => {
    const k = parseFloat(el.dataset.speed) || 0;
    G.to(el, { y: () => -k * innerHeight * 0.25, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true } });
  });

  // «О нас»: текст проявляется по словам при прокрутке
  const st = $(".about__statement");
  if (st) {
    const ws = splitWords(st, "w");
    G.to(ws, { opacity: 1, stagger: 0.1, ease: "none", scrollTrigger: { trigger: st, start: "top 80%", end: "bottom 40%", scrub: true } });
  }

  // счётчики
  $$("[data-count]").forEach((el) => {
    const target = parseFloat(el.dataset.count.replace(",", "."));
    const dec = (el.dataset.count.split(/[.,]/)[1] || "").length;
    const o = { v: 0 };
    G.to(o, { v: target, duration: 2, ease: "power2.out", scrollTrigger: { trigger: el, start: "top 92%", once: true }, onUpdate: () => (el.textContent = o.v.toFixed(dec).replace(".", ",")) });
  });

  const mm = G.matchMedia();
  // преимущества: горизонтальная лента с закреплением
  mm.add("(min-width: 761px)", () => {
    const pin = $(".feat__pin"), track = $(".feat__track");
    if (!pin || !track) return;
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    const tw = G.to(track, { x: () => -dist(), ease: "none", scrollTrigger: { trigger: pin, start: "top top", end: () => "+=" + dist(), pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 } });
    G.to(".feat__progress i", { scaleX: 1, ease: "none", scrollTrigger: { trigger: pin, start: "top top", end: () => "+=" + dist(), scrub: true, invalidateOnRefresh: true } });
    $$(".fcard:not(.fcard--intro)", track).forEach((c, i) => {
      const im = $(".fcard__img img", c);
      if (im) G.fromTo(im, { scale: 1.35, xPercent: -8 }, { scale: 1.05, xPercent: 8, ease: "none", scrollTrigger: { trigger: c, containerAnimation: tw, start: "left right", end: "right left", scrub: true } });
      G.fromTo(c, { y: i % 2 ? 50 : -20, rotate: i % 2 ? 2 : -1.5 }, { y: i % 2 ? -20 : 40, rotate: 0, ease: "none", scrollTrigger: { trigger: c, containerAnimation: tw, start: "left right", end: "right left", scrub: true } });
    });
  });

  // бегущая строка реагирует на скорость и направление прокрутки
  $$(".marquee__track").forEach((tr) => {
    const loop = G.to(tr, { xPercent: -50, duration: 28, ease: "none", repeat: -1 });
    let dir = 1;
    ST.create({
      trigger: tr, start: "top bottom", end: "bottom top",
      onUpdate: (self) => {
        dir = self.direction;
        const boost = Math.min(Math.abs(self.getVelocity()) / 300, 5);
        G.to(loop, { timeScale: dir * (1 + boost), duration: 0.2, overwrite: true });
        G.to(loop, { timeScale: dir, duration: 1.2, delay: 0.2, overwrite: false });
      },
    });
  });

  // подвал: логотип поднимается
  const big = $(".footer__big");
  if (big) G.from(big.children, { yPercent: 60, opacity: 0, ease: "none", scrollTrigger: { trigger: ".footer", start: "top 90%", end: "bottom bottom", scrub: true } });

  // после загрузки картинок пересчитываем позиции
  addEventListener("load", () => ST.refresh());

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
