// Поведение макета: меню, запись, фильтр прайса. Без зависимостей.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // Мобильное меню
  const nav = $("#nav");
  const burger = $(".burger");
  burger?.addEventListener("click", () => {
    const open = !nav.classList.contains("is-open");
    nav.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav?.classList.contains("is-open")) { nav.classList.remove("is-open"); burger.setAttribute("aria-expanded", "false"); burger.focus(); }
  });

  // Выпадающее меню услуг
  const drop = $(".nav__drop");
  const toggle = $(".nav__toggle");
  toggle?.addEventListener("click", () => {
    const open = !drop.classList.contains("is-open");
    drop.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", (e) => {
    if (drop && !drop.contains(e.target) && window.matchMedia("(min-width: 1101px)").matches) { drop.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); }
  });

  // Запись
  const dlg = $("#book");
  const done = $(".book__done", dlg);
  const panels = { "t-call": $("#tab-call"), "t-online": $("#tab-online") };
  const tabs = $$('[role="tab"]', dlg);
  const showTab = (id) => {
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t.id === id)));
    Object.entries(panels).forEach(([k, p]) => (p.hidden = k !== id));
  };
  tabs.forEach((t) => t.addEventListener("click", () => showTab(t.id)));
  $$("[data-book]").forEach((b) => b.addEventListener("click", () => {
    done.hidden = true;
    showTab(b.dataset.doctor ? "t-online" : "t-call");
    if (b.dataset.service) $("#b-service").value = b.dataset.service;
    if (b.dataset.doctor) { const o = [...$("#b-doctor").options].find((x) => x.text.startsWith(b.dataset.doctor)); if (o) o.selected = true; }
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
  }));
  const finish = () => { Object.values(panels).forEach((p) => (p.hidden = true)); $(".tabs", dlg).hidden = true; done.hidden = false; };
  dlg.addEventListener("close", () => { $(".tabs", dlg).hidden = false; });
  $$(".chip", $(".days", dlg)).forEach((c) => c.addEventListener("click", () => { $$(".days .chip", dlg).forEach((x) => x.classList.toggle("is-on", x === c)); }));
  $$(".slot", dlg).forEach((s) => s.addEventListener("click", finish));

  // Демо-формы: без отправки, честно говорим, что это макет
  $$("[data-demo-form]").forEach((f) => f.addEventListener("submit", (e) => {
    e.preventDefault();
    if (dlg.contains(f)) { finish(); return; }
    done.hidden = false; Object.values(panels).forEach((p) => (p.hidden = true)); $(".tabs", dlg).hidden = true;
    if (typeof dlg.showModal === "function") dlg.showModal();
  }));

  // Прайс: поиск и разделы
  const search = $("#p-search");
  if (search) {
    let cat = "";
    const tables = $$(".ptables--all .ptable");
    const empty = $(".pempty");
    const apply = () => {
      const q = search.value.trim().toLowerCase();
      let any = false;
      tables.forEach((t) => {
        const inCat = !cat || t.dataset.cat === cat;
        let shown = 0;
        $$("li", t).forEach((li) => { const ok = inCat && (!q || li.textContent.toLowerCase().includes(q)); li.hidden = !ok; if (ok) shown++; });
        t.hidden = shown === 0;
        if (shown) any = true;
      });
      empty.hidden = any;
    };
    search.addEventListener("input", apply);
    $$("[data-filter]").forEach((c) => c.addEventListener("click", () => {
      cat = c.dataset.filter;
      $$("[data-filter]").forEach((x) => x.classList.toggle("is-on", x === c));
      apply();
    }));
  }
})();
