// Поведение и анимации макета. GSAP + ScrollTrigger + Lenis лежат в assets/vendor.
// Без скриптов и при «уменьшить движение» весь контент виден сразу, формы и окна работают.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(pointer: fine)").matches;
  const phone = () => matchMedia("(max-width: 760px)").matches;
  const G = window.gsap, ST = window.ScrollTrigger;
  const anim = !!(G && ST) && !reduce;
  window.__umReady = true;
  if (!anim) { root.classList.remove("js-anim"); root.classList.add("no-anim"); }

  // ---------- разбивка заголовка на слова: читалке экрана остаётся целый текст ----------
  const escH = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const splitWords = (el, cls = "sw") => {
    const text = el.textContent.replace(/[ \t\r\n]+/g, " ").trim();
    const words = text.split(" ").map(escH);
    el.innerHTML = `<span class="sr">${escH(text)}</span><span aria-hidden="true">${words.map((w) => (cls === "sw" ? `<span class="sw"><span>${w}</span></span>` : `<span class="${cls}">${w}</span>`)).join(" ")}</span>`;
    el.classList.add("is-split");
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
  const headerH = () => (parseFloat(getComputedStyle(root).getPropertyValue("--header-h")) || 70) + 28;
  const scrollToEl = (el) => {
    if (lenis) lenis.scrollTo(el, { offset: -headerH(), duration: 1.2 });
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

  // ---------- при прокрутке: шапка, пункт меню текущего раздела, нижняя панель на телефоне ----------
  const header = $(".header");
  const demo = $(".demo-bar");
  const bar = $(".mobilebar");
  // панель появляется, когда кнопки первого экрана ушли вверх, и прячется над формой в подвале
  const firstCta = $(".hero__actions, .page-hero__aside, .doc-hero__cta");
  const footCta = $(".footer__cta");
  const navLinks = $$('.nav a[href^="#"]');
  const navSecs = navLinks.map((a) => [a, document.getElementById(a.hash.slice(1))]).filter(([, s]) => s);
  let demoH = demo ? demo.offsetHeight : 0, ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = scrollY, vh = innerHeight;
    root.style.setProperty("--hdr-top", Math.max(0, demoH - y) + "px");
    header?.classList.toggle("is-scrolled", y > demoH + 10);
    // активен раздел, через который проходит линия на 40% высоты окна; между разделами меню не подсвечено
    if (navSecs.length) {
      const line = vh * 0.4;
      let cur = null;
      for (const [a, s] of navSecs) { const r = s.getBoundingClientRect(); if (r.top <= line && r.bottom > line) cur = a; }
      navLinks.forEach((a) => a.classList.toggle("is-active", a === cur));
    }
    if (bar) {
      const past = firstCta ? firstCta.getBoundingClientRect().bottom < 0 : y > 200;
      const foot = footCta ? footCta.getBoundingClientRect().top < vh - 40 : false;
      bar.classList.toggle("is-on", past && !foot);
    }
  };
  const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } };
  addEventListener("scroll", req, { passive: true });
  addEventListener("resize", () => { demoH = demo ? demo.offsetHeight : 0; req(); });
  onScroll();

  // ---------- вкладки (команда, прайс, вопросы) ----------
  // появившееся сразу теряет data-reveal, иначе после анимации блок съезжает на исходные 24px
  const fadeIn = (els) => {
    els.forEach((el) => el.removeAttribute("data-reveal"));
    if (anim && els.length) G.fromTo(els, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7, stagger: Math.min(0.05, 0.4 / els.length), ease: "expo.out", overwrite: true, clearProps: "opacity,transform" });
  };
  $$("[data-tabs]").forEach((group) => {
    const kind = group.dataset.tabs;
    const btns = $$("[data-tab]", group);
    btns.forEach((b) => b.addEventListener("click", () => {
      btns.forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      const val = b.dataset.tab;
      if (kind === "team") {
        const grid = $(".team__grid");
        const shown = [];
        $$(".doc", grid).forEach((d) => { const ok = !val || (d.dataset.tags || "").split(" ").includes(val); d.hidden = !ok; if (ok) shown.push(d); });
        if (grid) grid.scrollLeft = 0;
        fadeIn(shown);
      } else {
        $$(`[data-panel="${kind}"]`).forEach((p) => { p.hidden = p.dataset.key !== val; if (!p.hidden) fadeIn($$("li, .qa", p)); });
      }
      ST?.refresh();
    }));
  });

  // отзывы: «Показать все» открывает остальные цитаты, фокус переходит на первую из них
  $$("[data-rv-more]").forEach((b) => b.addEventListener("click", () => {
    const sec = b.closest("section") || document;
    const extra = $$(".rv[data-extra]", sec);
    extra.forEach((r) => (r.hidden = false));
    fadeIn(extra);
    b.setAttribute("aria-expanded", "true");
    const wrap = b.closest(".rv-more");
    if (wrap) wrap.hidden = true;
    if (extra[0]) { extra[0].tabIndex = -1; extra[0].focus({ preventScroll: true }); }
    ST?.refresh();
  }));

  // раскрывающиеся блоки: вопросы и акции; из акций открыта одна
  const accordion = (d, bodySel, group) => {
    const s = $("summary", d), body = $(bodySel, d);
    if (!s || !body) return;
    const close = (x) => {
      const a = $(bodySel, x);
      if (!anim) { x.open = false; return; }
      G.killTweensOf(a);
      G.fromTo(a, { height: a.offsetHeight }, { height: 0, duration: 0.45, ease: "power3.inOut", onComplete: () => { x.open = false; a.style.height = ""; ST.refresh(); } });
    };
    const open = (x) => {
      const a = $(bodySel, x);
      x.open = true;
      if (!anim) return;
      G.killTweensOf(a);
      G.fromTo(a, { height: 0 }, { height: a.scrollHeight, duration: 0.55, ease: "expo.out", onComplete: () => { a.style.height = ""; ST.refresh(); } });
    };
    s.addEventListener("click", (e) => {
      e.preventDefault();
      if (d.open && !d.dataset.closing) { d.dataset.closing = "1"; close(d); setTimeout(() => delete d.dataset.closing, 460); return; }
      if (group) $$("details[open]", group).forEach((x) => { if (x !== d) close(x); });
      open(d);
    });
  };
  $$(".qa").forEach((d) => accordion(d, ".qa__a"));
  $$(".offer-item").forEach((d) => accordion(d, ".offer-item__body", d.closest(".offers")));

  // карта: двигать можно после нажатия, когда курсор ушёл, снова блокируется (чтобы не мешать прокрутке)
  $$(".place__map").forEach((m) => {
    m.addEventListener("click", () => m.classList.add("is-active"));
    m.addEventListener("mouseleave", () => m.classList.remove("is-active"));
  });

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

  // ---------- окна: запись, перезвон, снимок, расчёт, мессенджеры, при уходе ----------
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
      const box = $(".modal__box", m);
      G.fromTo(m, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power1.out" });
      // на телефоне окно выезжает снизу листом, на компьютере поднимается из глубины
      if (phone()) G.fromTo(box, { yPercent: 100 }, { yPercent: 0, duration: 0.6, ease: "expo.out", clearProps: "transform" });
      else G.fromTo(box, { y: 30, scale: 0.98, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.6, ease: "expo.out", clearProps: "transform,opacity" });
    }
    // на телефоне не открываем клавиатуру сразу: фокус на заголовке, поле человек выберет сам
    const field = fine ? $("input:not([type=hidden]):not([type=radio]):not([type=file])", m) : null;
    (field || $("h2", m))?.focus({ preventScroll: true });
    return true;
  };
  function hideModal(instant) {
    const m = openM;
    if (!m) return;
    openM = null;
    const done = () => { m.hidden = true; m.style.opacity = ""; G?.set($(".modal__box", m), { clearProps: "transform" }); if (!openM) { root.classList.remove("has-modal"); lenis?.start(); } };
    if (anim && !instant) {
      if (phone()) G.to($(".modal__box", m), { yPercent: 100, duration: 0.35, ease: "power2.in" });
      G.to(m, { opacity: 0, duration: 0.3, ease: "power1.in", onComplete: done });
    } else done();
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
      const f = $$("a[href], button:not([disabled]), input:not([type=hidden]), textarea, select", openM).filter((x) => x.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  // поле файла: имя выбранного файла вместо подсказки
  const fileInit = (i) => {
    const em = $("em", i.parentElement);
    if (!em) return;
    const def = em.textContent;
    i.addEventListener("change", () => { em.textContent = i.files[0]?.name || def; i.parentElement.classList.toggle("is-filled", !!i.files[0]); });
    i.form?.addEventListener("reset", () => { em.textContent = def; i.parentElement.classList.remove("is-filled"); });
  };
  $$(".file input").forEach(fileInit);

  // отправка любой формы заявки: в демо только «спасибо»; на рабочем сайте здесь уходит заявка в amoCRM
  const xrayDone = ["Снимок у врача", "Врач посмотрит и ответит в течение рабочего дня. Если зуб можно спасти, скажем, как и сколько это стоит."];
  const doneText = {
    xray: xrayDone,
    exit: xrayDone,
    allon: ["Спасибо!", "Администратор перезвонит за 5 минут и запишет к имплантологу на консультацию с КТ. Расчёт бесплатный."],
  };
  const defDone = $("#m-done [data-done-text]")?.textContent;
  $$("form[data-lead]").forEach((f) => {
    if (f.hasAttribute("data-quiz")) return;
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const d = doneText[f.dataset.lead];
      const dm = $("#m-done");
      if (dm) { $("h2", dm).textContent = d ? d[0] : "Спасибо!"; $("[data-done-text]", dm).textContent = d ? d[1] : defDone; }
      f.reset();
      showModal("done");
    });
  });

  // окно при уходе со страницы: один раз за визит, только на компьютере, не раньше чем через 15 секунд
  if (fine && $("#m-exit")) {
    const t0 = Date.now();
    document.addEventListener("mouseout", (e) => {
      if (e.relatedTarget || e.clientY > 8 || openM || anyModal || Date.now() - t0 < 15000) return;
      try { if (sessionStorage.getItem("um-exit")) return; sessionStorage.setItem("um-exit", "1"); } catch (err) { return; }
      showModal("exit");
    });
  }

  // расчёт All-on-4: система и число челюстей
  const fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  $$("[data-calc]").forEach((box) => {
    const c = JSON.parse(box.dataset.calc);
    let sys = 0, jaws = 1;
    const set = (k, v) => { const el = $(`[data-c="${k}"]`, box); if (el) el.textContent = fmt(v) + " ₽"; };
    const totalEl = $('[data-c="total"]', box);
    const upd = () => {
      const [, surg, old] = c.systems[sys];
      const t = (surg + c.temp + c.perm) * jaws;
      set("surg", surg * jaws); set("temp", c.temp * jaws); set("perm", c.perm * jaws);
      const o = $('[data-c="old"]', box);
      if (o) { o.hidden = !old; if (old) o.textContent = fmt(old * jaws) + " ₽"; }
      set("day", (surg + c.temp) * jaws); set("later", c.perm * jaws);
      const from = parseFloat(totalEl.textContent.replace(/\s/g, "")) || t;
      if (anim) { const v = { n: from }; G.to(v, { n: t, duration: 0.8, ease: "power2.out", overwrite: true, onUpdate: () => (totalEl.textContent = fmt(v.n)) }); }
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

  // квиз: вопрос за вопросом, полоска прогресса.
  // Дальше переходим по нажатию на ответ; стрелки клавиатуры только выбирают, переход по Enter или пробелу.
  $$("[data-quiz]").forEach((form) => {
    const wrap = form.closest(".quiz"), steps = $$(".quiz__step", form), bar = $(".quiz__bar i", wrap);
    let cur = 0;
    const focusStep = (st) => {
      if (!form.contains(document.activeElement) && document.activeElement !== document.body) return;
      const el = $("input:checked", st) || $("input", st);
      if (el && (el.type === "radio" || fine)) el.focus({ preventScroll: true });
    };
    const go = (n) => {
      if (n === cur) return;
      const from = steps[cur], to = steps[n];
      cur = n;
      if (bar) bar.style.transform = `scaleX(${n / (steps.length - 1)})`;
      const show = () => {
        steps.forEach((s) => (s.hidden = s !== to));
        if (anim) G.fromTo(to, { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.5, ease: "expo.out", clearProps: "transform" });
        focusStep(to);
        // на телефоне шаги разной высоты: если начало квиза ушло под шапку, возвращаем его в окно
        if (wrap.getBoundingClientRect().top < headerH() - 10) {
          if (lenis) lenis.scrollTo(wrap, { offset: -headerH(), duration: 0.8 });
          else wrap.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
        }
      };
      if (anim && from !== to) G.to(from, { opacity: 0, x: -30, duration: 0.2, ease: "power2.in", onComplete: () => { G.set(from, { clearProps: "opacity,transform" }); show(); } });
      else show();
    };
    const next = () => setTimeout(() => go(Math.min(cur + 1, steps.length - 1)), 220);
    form.addEventListener("click", (e) => {
      if (e.target.closest("[data-qback]")) return go(Math.max(0, cur - 1));
      if (e.target.matches('input[type="radio"]')) next();
    });
    form.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.type === "radio") { e.preventDefault(); if (e.target.checked) next(); }
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

  // ---------- анимации ----------
  // Правило: прокрутку сглаживает только Lenis, поэтому все scrub = true (без второго сглаживания),
  // одно свойство одного элемента ведёт одна анимация, CSS-переходы на этих свойствах выключены.
  if (!anim) return;
  G.registerPlugin(ST);
  G.defaults({ ease: "power3.out" });
  ST.config({ ignoreMobileResize: true });

  // разбиваем заголовки до первого кадра
  $$("[data-split]").forEach((el) => splitWords(el));

  // появилось: снимаем атрибут начального состояния и встроенные стили
  const settle = (attr) => (el) => { el.removeAttribute(attr); G.set(el, { clearProps: "opacity,transform" }); };

  // первый экран: фото раскрывается из круга, слова заголовка поднимаются, остальное проявляется по очереди
  const top = $(".hero, .page-hero");
  if (top) {
    const tl = G.timeline();
    const circle = $(".hero__circle", top);
    if (circle) {
      tl.fromTo(circle, { clipPath: "circle(0% at 50% 50%)" }, { clipPath: "circle(50% at 50% 50%)", duration: 1.5, ease: "expo.inOut", onComplete: () => G.set(circle, { clipPath: "none" }) }, 0);
      const im = $("img", circle);
      if (im) tl.fromTo(im, { scale: 1.3 }, { scale: 1, duration: 2.2, ease: "power2.out", clearProps: "transform" }, 0);
    }
    tl.from($$("[data-split] .sw > span", top), { yPercent: 110, duration: 1.1, stagger: 0.05, ease: "power4.out" }, 0.1);
    const items = $$("[data-in]");
    if (items.length) tl.to(items, { opacity: 1, y: 0, duration: 0.9, stagger: 0.07, onComplete: () => items.forEach(settle("data-in")) }, 0.35);
    if ($(".header__bar")) tl.from(".header__bar", { y: -24, autoAlpha: 0, duration: 0.9, clearProps: "transform,opacity,visibility" }, 0.15);
  }

  // заголовки разделов: слова поднимаются из-под строки
  $$("[data-split]").forEach((el) => {
    if (el.closest(".hero, .page-hero")) return;
    G.from($$(".sw > span", el), { yPercent: 110, duration: 1.1, stagger: 0.04, ease: "power4.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } });
  });

  // появление блоков: по порядку, без наездов друг на друга.
  // То, что уже проскочили быстрой прокруткой, показываем сразу; лесенка не дольше 0,35 с, чтобы видимое не ждало.
  const revealed = settle("data-reveal");
  ST.batch("[data-reveal]", {
    start: "top 92%", once: true, interval: 0.1,
    onEnter: (els) => {
      const live = els.filter((el) => el.getBoundingClientRect().bottom > 0);
      els.filter((el) => !live.includes(el)).forEach(revealed);
      if (live.length) G.to(live, { opacity: 1, y: 0, duration: 0.9, stagger: Math.min(0.07, 0.35 / live.length), overwrite: true, onComplete: () => live.forEach(revealed) });
    },
  });

  // фото раскрываются: люди из круга, кабинеты шторкой; после раскрытия обрезку снимаем совсем
  $$("[data-clip]").forEach((el) => {
    const round = el.classList.contains("circle");
    const im = $("img", el);
    const st = { trigger: el, start: "top 88%", once: true };
    G.fromTo(el, { clipPath: round ? "circle(36% at 50% 50%)" : "inset(12% 0% 12% 0% round 22px)" }, { clipPath: round ? "circle(50% at 50% 50%)" : "inset(0% 0% 0% 0% round 22px)", duration: 1.4, ease: "power3.inOut", scrollTrigger: st, onComplete: () => G.set(el, { clipPath: "none" }) });
    if (im) G.from(im, { scale: 1.15, duration: 1.8, ease: "power2.out", scrollTrigger: st });
  });

  // параллакс: картинка чуть медленнее рамки
  $$("[data-parallax]").forEach((fig) => {
    const im = $("img", fig);
    if (im) G.fromTo(im, { yPercent: -10 }, { yPercent: 0, ease: "none", scrollTrigger: { trigger: fig, start: "top bottom", end: "bottom top", scrub: true } });
  });

  // «О клинике»: фраза проявляется по словам при прокрутке
  const statement = $(".about__statement");
  if (statement) {
    const ws = splitWords(statement, "w");
    G.to(ws, { opacity: 1, stagger: 0.1, ease: "none", scrollTrigger: { trigger: statement, start: "top 78%", end: "bottom 50%", scrub: true } });
  }

  // счётчики на страницах врачей
  $$("[data-count]").forEach((el) => {
    const raw = el.dataset.count;
    const target = parseFloat(raw.replace(/\s/g, "").replace(",", "."));
    const dec = (raw.split(/[.,]/)[1] || "").length;
    const o = { v: 0 };
    G.to(o, { v: target, duration: 1.6, ease: "power2.out", scrollTrigger: { trigger: el, start: "top 92%", once: true }, onUpdate: () => (el.textContent = o.v.toFixed(dec).replace(".", ",")) });
  });

  // клиника изнутри: кадр раскрывается из карточки на весь экран, затем проявляется заголовок.
  // На компьютере блок закреплён на время раскрытия, на телефоне раскрывается по ходу обычной прокрутки.
  const tour = $(".tour__pin");
  if (tour) {
    const frame = $(".tour__frame", tour), fim = $(".tour__frame img", tour), tt = $(".tour__title", tour);
    const build = (st, from) => G.timeline({ defaults: { ease: "none" }, scrollTrigger: st })
      .fromTo(frame, { clipPath: from }, { clipPath: "inset(0% 0% 0% 0% round 0px)", duration: 1 }, 0)
      .fromTo(fim, { scale: 1.25 }, { scale: 1, duration: 1 }, 0)
      .fromTo(tt, { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out" }, 0.65);
    const mm = G.matchMedia();
    mm.add("(min-width: 761px)", () => { build({ trigger: tour, start: "top top", end: "+=80%", pin: true, anticipatePin: 1, scrub: true }, "inset(16% 22% 16% 22% round 28px)").to({}, { duration: 0.2 }); });
    mm.add("(max-width: 760px)", () => { build({ trigger: tour, start: "top 85%", end: "top 15%", scrub: true }, "inset(10% 6% 10% 6% round 22px)"); });
  }

  // пересчитываем позиции, когда догрузились шрифты и картинки
  const refresh = () => ST.refresh();
  document.fonts?.ready.then(refresh);
  addEventListener("load", refresh);
  let rt = 0;
  $$(".tour img, [data-parallax] img").forEach((im) => { if (!im.complete) im.addEventListener("load", () => { clearTimeout(rt); rt = setTimeout(refresh, 200); }, { once: true }); });

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
