#!/usr/bin/env node
// Сборка макета v2: одностраничник по механике Lava Dental + страницы услуг, прайс и онлайн-запись.
// Каждая страница отдаётся готовым HTML (важно для SEO). Запуск: npm run build → dist/
import { mkdirSync, writeFileSync, copyFileSync, rmSync, readdirSync, existsSync, cpSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clinic, doctors, prices, services, brand, pics, homeOrder, features, works, priceTabs, offers, about } from "../src/data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const SITE = process.env.SITE_URL || "https://umnaya-stomatologiya.ru"; // домен-пример для canonical и разметки

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rub = (n) => n.toLocaleString("ru-RU").replace(/\s/g, " ") + " ₽";
const priceText = (p) => {
  if (p === 0) return "Бесплатно";
  if (typeof p === "number") return rub(p);
  const m = /^от (\d+)$/.exec(p);
  return m ? "от " + rub(Number(m[1])) : p;
};
const svc = Object.fromEntries(services.map((s) => [s.slug, s]));
const pad = (n) => String(n).padStart(2, "0");
const pre = (depth) => "../".repeat(depth);

// ---------- картинки: локальный файл, если он есть, иначе запасной адрес ----------
const local = (rel) => rel && existsSync(path.join(root, "src", rel));
function pick(entry, depth) {
  const c = entry.filter(Boolean).filter((u) => /^https?:/.test(u) || local(u)).map((u) => (/^https?:/.test(u) ? u : pre(depth) + u));
  return { src: c[0] || "", fb: c[1] || "" };
}
const img = (entry, alt, depth, attrs = "") => {
  const { src, fb } = pick(entry, depth);
  if (!src) return "";
  return `<img src="${src}"${fb ? ` data-fb="${fb}"` : ""} alt="${esc(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="umImg(this)"${attrs}>`;
};
const ph = (text = "Фото клиники") => `<span class="ph">${esc(text)}</span>`;
const logoImg = (depth, eager = true) => {
  const { src, fb } = pick(brand.logo, depth);
  return `<img class="logo__img" src="${src}"${fb ? ` data-fb="${fb}"` : ""} alt=""${eager ? "" : ' loading="lazy"'} referrerpolicy="no-referrer" onerror="umLogo(this)">`;
};

// ---------- иконки ----------
const icon = {
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.2 5.3 19.9 12l-6.7 6.7-1.4-1.4 4.3-4.3H4v-2h12.1l-4.3-4.3z"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18v2H3zm0 8h18v2H3z"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7l-1.4-1.4L9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 16.2-4.2-4.2-1.4 1.4 5.6 5.6 11-11-1.4-1.4z"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>',
  tooth: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M15 9c3-1.3 5.6 0 9 0s6-1.3 9 0c4.3 1.9 4.4 8.4 2.9 12.8-1 3.2-1.9 5.9-2.3 9.2-.4 3.1-1.7 4.8-3.3 4.8-2 0-2.4-2.5-2.9-5.3-.4-2.1-1.1-3.9-3.4-3.9s-3 1.8-3.4 3.9c-.5 2.8-.9 5.3-2.9 5.3-1.6 0-2.9-1.7-3.3-4.8-.4-3.3-1.3-6-2.3-9.2C10.6 17.4 10.7 10.9 15 9z"/></svg>',
};

// ---------- общие куски ----------
const sections = [["about", "О нас"], ["works", "Работы"], ["services", "Услуги"], ["team", "Команда"], ["pricing", "Цены"], ["faq", "FAQ"], ["contacts", "Контакты"]];

function head({ title, desc, canonical, depth, page = "inner", jsonld = [] }) {
  const p = pre(depth);
  return `<!doctype html>
<html lang="ru" data-page="${page}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex, nofollow">
<link rel="canonical" href="${SITE}${canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:locale" content="ru_RU">
<meta name="theme-color" content="#0c2410">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600&family=Manrope:wght@400;500;600&display=swap">
<link rel="stylesheet" href="${p}assets/styles.css">
<script>
(function(d){d.classList.add("js");try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches){d.classList.add("js-anim");if(d.dataset.page==="home"&&!sessionStorage.getItem("um-intro"))d.classList.add("js-intro")}}catch(e){}
setTimeout(function(){if(!window.__umReady)d.classList.remove("js-anim","js-intro")},4000)})(document.documentElement);
window.umImg=function(i){var f=i.getAttribute("data-fb");if(f){i.removeAttribute("data-fb");i.src=f;return}var p=i.closest("[data-ph]");if(p)p.classList.add("ph-on");i.style.opacity="0"};
window.umLogo=function(i){var f=i.getAttribute("data-fb");if(f){i.removeAttribute("data-fb");i.src=f;return}var p=i.closest(".logo,.footer__big,.intro__logo");if(p)p.classList.add("is-fallback");i.style.display="none"};
</script>
<script src="${p}assets/vendor/gsap.min.js" defer></script>
<script src="${p}assets/vendor/ScrollTrigger.min.js" defer></script>
<script src="${p}assets/vendor/lenis.min.js" defer></script>
<script src="${p}assets/app.js" defer></script>
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join("\n")}
</head>
<body${page === "booking" ? ' class="booking-page"' : ""}>
<a class="skip" href="#main">К содержанию</a>
<div class="demo-bar">Демонстрационный макет нового сайта стоматологии. Тексты и цены перенесены с um-med.com, фото работ и сроки акций ждут клиники.</div>`;
}

function intro(depth) {
  return `<div class="intro" aria-hidden="true"><div class="intro__in">
  <div class="intro__logo">${logoImg(depth)}<span class="logo__text">Умная Медицина</span></div>
  <div class="intro__bar"><i></i></div>
  <p class="intro__word">Стоматология</p>
</div></div>`;
}

function header(depth, home = false) {
  const p = pre(depth);
  const href = (id) => (home ? `#${id}` : `${p}index.html#${id}`);
  return `
<header class="header"><div class="header__bar">
  <a class="logo" href="${p}index.html" aria-label="Умная Медицина. Стоматология, на главную">${logoImg(depth)}<span class="logo__text">Умная Медицина<small>стоматология</small></span><span class="logo__unit">Стоматология</span></a>
  <nav class="nav" aria-label="Разделы">${sections.map(([id, t]) => `<a href="${href(id)}">${t}</a>`).join("")}</nav>
  <div class="header__cta">
    <a class="header__phone" href="${clinic.phoneHref}">${esc(clinic.phone)}</a>
    <a class="btn btn--sm" href="${p}zapis.html" data-magnet>Записаться на приём</a>
    <button class="burger" type="button" aria-label="Открыть меню" aria-expanded="false" aria-controls="menu">${icon.menu}</button>
  </div>
</div></header>
<div class="menu" id="menu" role="dialog" aria-modal="true" aria-label="Меню">
  <div class="menu__top"><a class="logo logo--white" href="${p}index.html">${logoImg(depth, false)}<span class="logo__text">Умная Медицина<small>стоматология</small></span></a><button class="menu__close" type="button" aria-label="Закрыть меню">${icon.close}</button></div>
  <nav aria-label="Разделы">${sections.map(([id, t], i) => `<a href="${href(id)}"><span>${pad(i + 1)}</span>${t}</a>`).join("")}</nav>
  <div class="menu__foot"><a class="footer__phone" href="${clinic.phoneHref}">${esc(clinic.phone)}</a><a href="${p}ceny.html">Полный прайс</a><a class="btn btn--wide" href="${p}zapis.html">Записаться на приём ${icon.arrow}</a></div>
</div>`;
}

function footer(depth) {
  const p = pre(depth);
  const { lat, lon } = clinic.geo;
  return `
<footer class="footer on-dark"><div class="wrap footer__in">
  <div class="footer__cta">
    <h2 data-split>Запишитесь на приём и сделайте первый шаг к здоровой улыбке</h2>
    <div style="display:flex;gap:12px;flex-wrap:wrap"><a class="btn btn--lg" href="${p}zapis.html" data-magnet>Записаться на приём ${icon.arrow}</a><button class="totop" type="button" data-totop aria-label="Наверх">${icon.arrow}</button></div>
  </div>
  <div class="footer__grid">
    <div class="footer__col">
      <h3>Стоматология</h3>
      <a class="footer__phone" href="${clinic.phoneHref}">${esc(clinic.phone)}</a>
      <a href="mailto:${clinic.email}">${esc(clinic.email)}</a>
      <span>${esc(clinic.hours)}</span>
    </div>
    <div class="footer__col">
      <h3>Адрес</h3>
      <span>${esc(clinic.address)}</span>
      <a href="https://yandex.ru/maps/?rtext=~${lat},${lon}">Маршрут в Яндекс Картах</a>
      <a href="https://2gis.ru/moscow/firm/70000001080535965">Открыть в 2ГИС</a>
    </div>
    <nav class="footer__col" aria-label="Услуги">
      <h3>Услуги</h3>
      ${homeOrder.map((k) => `<a href="${p}uslugi/${k}.html">${esc(svc[k].menu)}</a>`).join("")}
    </nav>
    <div class="footer__col">
      <h3>Пациентам</h3>
      <a href="${p}ceny.html">Полный прайс</a>
      <a href="${p}zapis.html">Онлайн-запись</a>
      <a href="${clinic.vk}">ВКонтакте</a>
      <a href="https://um-med.com/assets/files/dogovor-oferta.pdf">Договор-оферта</a>
      <a href="https://um-med.com/assets/files/pol.pdf">Политика обработки данных</a>
      <a href="${clinic.mainSite}">Многопрофильная клиника ↗</a>
    </div>
  </div>
  <div class="footer__big">${logoImg(depth, false).replace('class="logo__img"', 'class="footer__logo"')}<span class="footer__word">Умная Медицина</span></div>
  <div class="footer__legal">
    <span>© 2026 ${esc(clinic.legal)}, ИНН ${clinic.inn}, ОГРН ${clinic.ogrn}. Лицензия на медицинскую деятельность.</span>
    <span>Имеются противопоказания, необходима консультация специалиста.</span>
  </div>
</div></footer>
<div class="mobilebar"><a href="${clinic.phoneHref}">${icon.phone}Позвонить</a><a href="${p}zapis.html">Записаться</a></div>`;
}
const end = `\n</body>\n</html>\n`;

// ---------- разметка schema.org ----------
const dentistLd = {
  "@context": "https://schema.org", "@type": "Dentist", name: "Умная Медицина. Стоматология", telephone: clinic.phone, email: clinic.email, url: SITE,
  address: { "@type": "PostalAddress", streetAddress: "ул. Громова, 10/2", addressLocality: "пгт Удельная", addressRegion: "Московская область", postalCode: "140140", addressCountry: "RU" },
  geo: { "@type": "GeoCoordinates", latitude: clinic.geo.lat, longitude: clinic.geo.lon },
  openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], opens: "09:00", closes: "21:00" }],
  aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", reviewCount: "199" },
  priceRange: "₽₽",
};
const crumbsLd = (items) => ({
  "@context": "https://schema.org", "@type": "BreadcrumbList",
  itemListElement: [["/", "Главная"], ...items].map(([href, name], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE + (href === "/" ? "" : "/" + href) })),
});
const faqLd = (faq) => ({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });

// ---------- блоки ----------
const plist = (keys, limit = 99) => `<ul class="plist">${keys.flatMap((k) => prices[k].items).slice(0, limit).map(([n, v]) => `<li><span>${esc(n)}</span><b>${priceText(v)}</b></li>`).join("")}</ul>`;

function doctorCard(d, depth) {
  const p = pre(depth);
  const initials = d.short.split(" ").map((w) => w[0]).join("");
  return `<article class="doc" data-tags="${d.tags.join(" ")}" data-reveal>
  <div class="doc__photo" data-ph><span class="doc__initials" aria-hidden="true">${initials}</span>${d.photo ? img([d.photo, d.photo.replace("_square.jpg", "_square_small.jpg")], d.name, depth) : ""}
    <a class="btn btn--sm btn--wide doc__book" href="${p}zapis.html?doctor=${d.id}">Записаться</a></div>
  <h3>${esc(d.name)}</h3>
  <p class="doc__role">${esc(d.role)}</p>
  <p class="doc__meta">${d.exp ? `<span>Стаж <b>${d.exp} лет</b></span>` : "<span>Стаж уточняется</span>"}${d.rating ? `<span>ПроДокторов <b>${d.rating}</b> · ${d.reviews} отзывов</span>` : ""}</p>
</article>`;
}

function faqBlock(groups) {
  // groups: [[title, [[q, a], ...]], ...]
  const multi = groups.length > 1;
  return `<div class="faq">
  ${multi ? `<div class="faq__groups" role="tablist" data-tabs="faq">${groups.map(([t, qs], i) => `<button type="button" role="tab" data-tab="g${i}" aria-selected="${i === 0}">${esc(t)}<span>${pad(qs.length)}</span></button>`).join("")}</div>` : `<div><h2 class="section__title" data-split>Частые вопросы</h2></div>`}
  <div>${groups.map(([t, qs], i) => `<div class="qa-group" data-panel="faq" data-key="g${i}"${i ? " hidden" : ""}>${qs.map(([q, a]) => `<details class="qa"><summary>${esc(q)}<i aria-hidden="true"></i></summary><div class="qa__a"><p>${esc(a)}</p></div></details>`).join("")}</div>`).join("")}</div>
</div>`;
}

function svcCard(k, i, depth, kind = "") {
  const s = svc[k];
  const p = pre(depth);
  const bg = kind ? `<span class="svc__bg" data-ph>${img(pics.svc[k], s.title, depth)}${ph(s.title)}</span>` : "";
  return `<a class="svc${kind}" href="${p}uslugi/${k}.html" data-reveal>${bg}
  <span class="svc__top"><span class="num">${pad(i + 1)}</span><span class="svc__arrow">${icon.arrow}</span></span>
  <span><h3>${esc(s.title)}</h3>${kind.includes("wide") ? `<p class="svc__lead">${esc(s.lead)}</p>` : ""}</span>
  <span class="svc__meta"><span>${esc(s.short)}</span><span class="svc__from">${esc(s.from)}</span></span>
</a>`;
}

function svcRows(keys, depth, start = 0) {
  const p = pre(depth);
  return `<div class="svc-list">${keys.map((k, i) => {
    const s = svc[k];
    return `<a class="svc-row" href="${p}uslugi/${k}.html" data-img="${pick(pics.svc[k], depth).src}" data-reveal><span class="num">${pad(start + i + 1)}</span><h3>${esc(s.title)}</h3><span class="svc__from">${esc(s.from)}</span><span class="svc__arrow">${icon.arrow}</span></a>`;
  }).join("")}</div><div class="hover-img" aria-hidden="true"><img alt=""></div>`;
}

function marquee(text) {
  const item = `<span class="marquee__item">${text}<span class="marquee__dot"></span></span>`;
  return `<div class="marquee" aria-hidden="true"><div class="marquee__track">${item.repeat(4)}</div></div>`;
}

function place() {
  const { lat, lon } = clinic.geo;
  return `<section class="section" id="contacts" aria-labelledby="ct-title"><div class="wrap">
  <div class="section__head"><div><span class="label">Мы здесь</span><h2 id="ct-title" data-split>Удобно добраться из Жуковского</h2></div><p>Стоматология на Громова, 10/2 в Удельной. По соседству, на Громова, 10, работает многопрофильная клиника «Умная Медицина».</p></div>
  <div class="place">
    <div class="place__map" data-ph data-clip><iframe title="Карта: стоматология на Громова, 10/2" src="https://yandex.ru/map-widget/v1/?ll=${lon}%2C${lat}&z=16&pt=${lon},${lat},pm2grm" loading="lazy"></iframe><button class="place__unlock" type="button">Нажмите, чтобы двигать карту</button>${ph("Карта")}</div>
    <div class="place__info" data-reveal>
      <h3>Умная Медицина. Стоматология</h3>
      <dl class="place__list">
        <div><dt>Адрес</dt><dd>${esc(clinic.address)}</dd></div>
        <div><dt>Телефон</dt><dd><a href="${clinic.phoneHref}">${esc(clinic.phone)}</a></dd></div>
        <div><dt>Часы работы</dt><dd>${esc(clinic.hours)}</dd></div>
        <div><dt>Почта</dt><dd><a href="mailto:${clinic.email}">${esc(clinic.email)}</a></dd></div>
      </dl>
      <div class="place__btns"><a class="btn btn--sm" href="https://yandex.ru/maps/?rtext=~${lat},${lon}">Маршрут в Яндекс Картах</a><a class="btn btn--ghost btn--sm" href="https://2gis.ru/moscow/firm/70000001080535965">Открыть в 2ГИС</a></div>
    </div>
  </div>
</div></section>`;
}

// ---------- главная ----------
const homeFaq = [
  ["Диагностика и лечение", [
    ["Что входит в первую консультацию?", "Врач осматривает полость рта, при необходимости направляет на снимок прямо в клинике и составляет план лечения с ценой. Консультация терапевта, ортопеда, хирурга и имплантолога с планом лечения бесплатная."],
    ["Какие снимки можно сделать в клинике?", "Прицельный снимок (500 ₽), панорамный снимок ОПТГ (1 700 ₽), трёхмерный снимок участка 5×5 см (2 000 ₽) и двух челюстей (4 500 ₽)."],
    ["Лечите ли вы каналы под микроскопом?", "Да. Микроскоп с увеличением в 25–40 раз помогает найти скрытые поражения и трещины, бережно пролечить каналы и закрыть перфорацию."],
    ["Можно ли поставить имплант, если не хватает кости?", "Да. В клинике делают закрытый и открытый синус-лифтинг и костную пластику. Нужна ли она, хирург скажет по КТ."],
  ]],
  ["Услуги и цены", [
    ["Сколько стоит имплантация?", "Установка импланта стоит от 19 300 ₽, металлокерамическая коронка на имплант от 27 400 ₽, циркониевая от 35 100 ₽. Точную сумму хирург называет после КТ."],
    ["Какие импланты вы ставите?", "Osstem, Dentium и Straumann. Систему врач подбирает по клинической ситуации и бюджету."],
    ["Что такое All-on-4?", "Это восстановление всей челюсти несъёмным протезом на четырёх или шести имплантах. Хирургический этап All-on-4 стоит от 114 000 ₽."],
    ["Есть ли акции?", "Каждую среду профессиональная гигиена Air-Flow стоит 4 500 ₽ вместо 5 790 ₽. Консультация хирурга-имплантолога и 3D-снимок бесплатно."],
  ]],
  ["Комфорт и безопасность", [
    ["Больно ли лечить зубы?", "Лечение проходит под местной анестезией. В клинике используют препараты «Скандонест», «Ультракаин», «Убистезин» и «Артикаин»."],
    ["Принимаете ли вы детей?", "Да. Детский стоматолог лечит и удаляет молочные зубы, делает фторирование и герметизацию фиссур."],
    ["Как проходит профессиональная гигиена?", "Врач снимает зубной камень и налёт, чистит зубы методом Air-Flow, полирует их и даёт рекомендации по уходу."],
  ]],
  ["О клинике", [
    ["Где вы находитесь?", "Пгт Удельная, ул. Громова, 10/2, рядом с Жуковским. Рядом, на Громова, 10, работает многопрофильная клиника «Умная Медицина»."],
    ["Когда вы работаете?", "Ежедневно с 9:00 до 21:00, без выходных."],
    ["Как записаться?", `Онлайн на сайте, выбрав услугу, врача и время, или по телефону ${clinic.phone}.`],
  ]],
];

function pageHome() {
  const depth = 0;
  const slides = pics.slides.map((e, i) => img(e, "Стоматология «Умная Медицина»", depth, i === 0 ? ' class="is-on"' : "")).join("");
  const cases = works.map(([cat, tag, title], i) => `<article class="case" data-cat="${cat}"${i >= 6 ? ' data-extra="1" hidden' : ""} data-reveal>
    <div class="ba"><div class="ba__pane ba__pane--before"><div class="ba__ph">${icon.tooth}Фото «до»</div></div><div class="ba__pane ba__pane--after"><div class="ba__ph">${icon.tooth}Фото «после»</div></div><span class="ba__lbl ba__lbl--b">До</span><span class="ba__lbl ba__lbl--a">После</span><span class="ba__handle"></span><input type="range" min="0" max="100" value="50" aria-label="Сравнить до и после: ${esc(title)}"></div>
    <span class="case__tag">${esc(tag)}</span><h3 style="font-size:20px">${esc(title)}</h3><p>Шаблон карточки. Фото работы, сроки лечения и врача предоставит клиника.</p>
  </article>`).join("");
  const cats = [...new Map(works.map(([c, t]) => [c, t])).entries()];

  return head({ title: "Стоматология в Удельной и Жуковском | Умная Медицина", desc: "Стоматология «Умная Медицина» на Громова, 10/2: лечение зубов, имплантация от 19 300 ₽, All-on-4, протезирование, брекеты, детский стоматолог. Ежедневно 9:00–21:00.", canonical: "/", depth, page: "home", jsonld: [dentistLd, faqLd(homeFaq.flatMap((g) => g[1]))] })
  + intro(depth) + header(depth, true) + `
<main id="main">

<section class="hero" aria-labelledby="h1">
  <div class="hero__media" data-ph>${img(pics.hero, "Стоматология «Умная Медицина» в Удельной", depth, ' fetchpriority="high" loading="eager"')}</div>
  <div class="hero__in">
    <div>
      <h1 id="h1"><span class="kicker">Стоматология в Удельной и Жуковском</span><span data-split>Лечение зубов с комфортом</span></h1>
      <p class="hero__sub">Терапия, имплантация, протезирование, ортодонтия и детский приём. Ежедневно с 9:00 до 21:00 на Громова, 10/2.</p>
      <div class="hero__actions"><a class="btn btn--lg" href="zapis.html" data-magnet>Записаться на приём ${icon.arrow}</a><a class="btn btn--ghost btn--lg" href="#services">Услуги и цены</a></div>
    </div>
    <div class="hero__side">
      <div class="hero__card"><div class="hero__slides" data-ph>${slides}</div><p>Мы меняем представление о походе к стоматологу: спокойно, понятно и без боли.</p></div>
      <a class="hero__rating" href="${clinic.ratings[0].url}"><b data-count="4,9">4,9</b><span>рейтинг на ПроДокторов<br>199 отзывов</span></a>
    </div>
  </div>
  <span class="hero__scroll" aria-hidden="true"></span>
</section>

<section class="section" id="about" aria-labelledby="ab-title"><div class="wrap">
  <span class="label">О нас</span>
  <div class="about__grid" style="margin-top:28px">
    <h2 id="ab-title" class="about__statement">${esc(about.statement)}</h2>
    <div class="about__text">${about.text.map((t) => `<p data-reveal>${esc(t)}</p>`).join("")}<p class="about__sign" data-reveal><i></i>${esc(about.sign)}</p></div>
  </div>
  <div class="collage">
    ${pics.about.map((e, i) => `<figure class="c${i + 1}" data-ph data-parallax data-speed="${[0.3, -0.15, 0.1, -0.3, 0.2, -0.1, 0.35][i]}">${img(e, "Стоматология «Умная Медицина»", depth)}${ph()}</figure>`).join("")}
    <div class="collage__badge" data-speed="-0.4"><svg viewBox="0 0 100 100" aria-hidden="true"><defs><path id="circ" d="M50 50m-41 0a41 41 0 1 1 82 0a41 41 0 1 1-82 0"/></defs><text><textPath href="#circ">ПроДокторов · 199 отзывов · рейтинг ·</textPath></text></svg><span><b>4,9</b>из 5</span></div>
  </div>
</div></section>

<section class="foil on-dark" aria-labelledby="ft-title">
  <div class="foil__bg">${pick(pics.foil, depth).src ? `<img src="${pick(pics.foil, depth).src}" alt="" loading="lazy">` : ""}</div>
  <div class="feat">
    <div class="feat__pin"><div class="feat__track">
      <div class="fcard fcard--intro"><span class="label">Почему мы</span><h2 id="ft-title" data-split>Ваша улыбка начинается здесь</h2><p>Шесть причин, по которым пациенты из Жуковского и Раменского выбирают «Умную Медицину».</p></div>
      ${features.map(([t, d], i) => `<article class="fcard"><div class="fcard__img" data-ph>${img(pics.feat[i], t, depth)}${ph(t)}</div><div class="fcard__body"><span class="num">${pad(i + 1)}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></div></article>`).join("")}
    </div><div class="feat__progress" aria-hidden="true"><i></i></div></div>
  </div>
  ${marquee("Это мы — <em>Умная Медицина</em>")}
  <div class="wrap cta-strip"><p>Запишитесь на приём и сделайте шаг к здоровой улыбке.</p><a class="btn btn--light btn--lg" href="zapis.html" data-magnet>Записаться на приём ${icon.arrow}</a></div>
</section>

<section class="section" id="works" aria-labelledby="wk-title"><div class="wrap">
  <div class="section__head"><div><span class="label">Работы</span><h2 id="wk-title" data-split>Улыбки пациентов говорят сами за себя</h2></div><p>Передвиньте ползунок, чтобы сравнить «до» и «после». Сейчас это шаблоны: фото работ врачей добавим, когда их передаст клиника.</p></div>
  <div class="chips" role="tablist" data-tabs="works"><button class="chip" type="button" role="tab" data-tab="" aria-selected="true">Все</button>${cats.map(([c, t]) => `<button class="chip" type="button" role="tab" data-tab="${c}" aria-selected="false">${esc(t)}</button>`).join("")}</div>
  <div class="works__grid">${cases}</div>
  <div class="works__more"><button class="btn btn--ghost" type="button" data-works-more>Показать ещё</button></div>
</div></section>

<section class="section section--sage" id="services" aria-labelledby="sv-title"><div class="wrap">
  <div class="section__head"><div><span class="label">Услуги</span><h2 id="sv-title" data-split>Всё для здоровья зубов в одной клинике</h2></div><a class="link" href="ceny.html">Полный прайс ${icon.arrow}</a></div>
  <div class="svc-grid">
    ${svcCard(homeOrder[0], 0, depth, " svc--img svc--wide")}
    ${homeOrder.slice(1, 5).map((k, i) => svcCard(k, i + 1, depth, " svc--img")).join("")}
  </div>
  <div style="margin-top:clamp(30px,4vw,56px)">${svcRows(homeOrder.slice(5), depth, 5)}</div>
</div></section>

<section class="tour on-dark" id="clinic" aria-labelledby="tr-title">
  <div class="tour__pin">
    <div class="tour__frame">${img(["images/clinic/2gis-04.jpg"], "Лечебный кабинет стоматологии «Умная Медицина»", depth)}</div>
    <div class="tour__title wrap"><span class="label label--light">Клиника изнутри</span><h2 id="tr-title" data-split>Здесь вас ждут</h2><p>Лечебные кабинеты, 3D-томограф Vatech, панорамный рентген и стерилизационная. Фото из карточек клиники в 2ГИС и Яндекс Картах.</p></div>
  </div>
  <div class="tour__rows" aria-label="Фото клиники">
    ${[pics.tour.slice(0, 6), pics.tour.slice(5)].map((row, r) => `<div class="tour__row" data-dir="${r ? 1 : -1}">${[...row, ...row].map(([f, cap], j) => `<figure${j >= row.length ? ' aria-hidden="true"' : ""}>${img([`images/clinic/${f}.jpg`], cap, depth)}<figcaption>${esc(cap)}</figcaption></figure>`).join("")}</div>`).join("")}
  </div>
</section>

<section class="section" id="team" aria-labelledby="tm-title"><div class="wrap">
  <div class="section__head"><div><span class="label">Команда</span><h2 id="tm-title" data-split>За каждой улыбкой стоит команда</h2></div></div>
  <div class="team__intro">
    <div class="team__photo" data-ph data-clip data-parallax>${img(pics.team, "Кабинет стоматологии «Умная Медицина»", depth)}${ph()}</div>
    <div data-reveal><p class="team__lead">Мы верим, что улыбка — это не только эстетика, но и здоровье, и уверенность в себе.</p><p>Семь врачей: терапевты и эндодонтисты, хирурги-имплантологи, ортопеды, ортодонт и детский стоматолог. Стаж и рейтинги взяты с ПроДокторов.</p></div>
  </div>
  <div class="chips team__tabs" role="tablist" data-tabs="team">
    ${[["", "Все"], ["lechenie-zubov", "Терапия"], ["implantaciya", "Хирургия и имплантация"], ["protezirovanie", "Ортопедия"], ["ortodontiya", "Ортодонтия"], ["detskaya", "Детям"]].map(([v, t], i) => `<button class="chip" type="button" role="tab" data-tab="${v}" aria-selected="${i === 0}">${t}</button>`).join("")}
  </div>
  <div class="team__grid">${doctors.map((d) => doctorCard(d, depth)).join("")}</div>
  <div class="team__join" data-reveal><h3>Хотите в команду «Умной Медицины»?</h3><a class="btn btn--ghost" href="https://um-med.com/vacancies.html">Актуальные вакансии ${icon.arrow}</a></div>
</div></section>

<section class="section section--sage" id="pricing" aria-labelledby="pr-title"><div class="wrap">
  <div class="section__head"><div><span class="label">Цены</span><h2 id="pr-title" data-split>Прозрачная стоимость лечения</h2></div><p>Цены на 15.10.2026. Точную стоимость врач называет после осмотра и записывает в план лечения.</p></div>
  <div class="pricing">
    <aside class="offer" data-reveal>
      ${offers.map((o, i) => `<div class="offer__item"${i ? " hidden" : ""}>
        <span class="label label--light">${esc(o.tag)}</span>
        <h3>${esc(o.title)}</h3>
        <p class="offer__price"><b>${esc(o.price)}</b>${o.old ? `<s>${esc(o.old)}</s>` : ""}</p>
        <ul>${o.items.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        <a class="btn btn--light" href="zapis.html?service=${o.service}">Записаться ${icon.arrow}</a>
      </div>`).join("")}
      <div class="offer__switch">${offers.map((o, i) => `<button type="button" aria-label="${esc(o.title)}" aria-pressed="${i === 0}"></button>`).join("")}</div>
      <p class="offer__note">Сроки акций уточняются у клиники.</p>
    </aside>
    <div>
      <div class="ptabs" role="tablist" data-tabs="price">${priceTabs.map(([t], i) => `<button class="chip" type="button" role="tab" data-tab="p${i}" aria-selected="${i === 0}">${esc(t)}</button>`).join("")}</div>
      ${priceTabs.map(([t, keys], i) => `<div class="ppanel" data-panel="price" data-key="p${i}"${i ? " hidden" : ""}>${plist(keys, 9)}</div>`).join("")}
      <div class="pricing__foot"><span class="note">Цены зависят от сложности случая.</span><a class="link" href="ceny.html">Весь прайс ${icon.arrow}</a></div>
    </div>
  </div>
</div></section>

<section class="section" id="faq" aria-labelledby="fq-title"><div class="wrap">
  <div class="section__head"><div><span class="label">FAQ</span><h2 id="fq-title" data-split>Прежде чем прийти, вы, возможно, захотите узнать больше</h2></div></div>
  ${faqBlock(homeFaq)}
</div></section>

${place()}
</main>` + footer(depth) + end;
}

// ---------- страница услуги ----------
function pageService(s) {
  const depth = 1;
  const i = homeOrder.indexOf(s.slug);
  const docs = doctors.filter((d) => d.tags.includes(s.slug));
  const rest = homeOrder.filter((k) => k !== s.slug);
  const body = s.about || [s.lead];
  return head({ title: s.seoTitle, desc: s.seoDesc, canonical: `/uslugi/${s.slug}`, depth, jsonld: [crumbsLd([["uslugi/" + s.slug, s.title]]), faqLd(s.faq), { "@context": "https://schema.org", "@type": "MedicalProcedure", name: s.title, description: s.seoDesc }] })
  + header(depth) + `
<main id="main">
<section class="page-hero on-dark">
  <div class="foil__bg"></div>
  <div class="wrap page-hero__in">
    <div>
      <nav class="crumbs" aria-label="Хлебные крошки"><a href="../index.html">Главная</a><a href="../index.html#services">Услуги</a><span aria-current="page">${esc(s.title)}</span></nav>
      <h1 data-split>${esc(s.h1)}</h1>
      <p class="page-hero__lead">${esc(s.lead)}</p>
    </div>
    <div class="page-hero__aside">
      <span class="label label--light">Услуга ${pad(i + 1)}</span>
      <span class="page-hero__price${/\d/.test(s.from) ? "" : " page-hero__price--text"}">${esc(s.from)}</span>
      <a class="btn btn--lg" href="../zapis.html?service=${s.slug}" data-magnet>Записаться ${icon.arrow}</a>
    </div>
  </div>
</section>

<section class="section"><div class="wrap split">
  <div class="split__img" data-ph data-clip data-parallax>${img(pics.svc[s.slug], s.title, depth)}${ph(s.title)}</div>
  <div>
    <span class="label">О лечении</span>
    <div class="prose" style="margin-top:24px">${body.map((t) => `<p data-reveal>${esc(t)}</p>`).join("")}</div>
    <div class="points" style="grid-template-columns:repeat(2,1fr);margin-top:40px">${s.points.map((t, j) => `<div class="point" data-reveal><span class="num">${pad(j + 1)}</span><p>${esc(t)}</p></div>`).join("")}</div>
  </div>
</div></section>

<section class="section section--dark on-dark"><div class="wrap">
  <div class="section__head"><div><span class="label">Этапы</span><h2 data-split>Как проходит лечение</h2></div></div>
  <ol class="steps">${s.steps.map((t, j) => `<li data-reveal><span class="num">${pad(j + 1)}</span><b>${esc(t)}</b></li>`).join("")}</ol>
</div></section>

<section class="section section--sage" id="prices"><div class="wrap">
  <div class="section__head"><div><span class="label">Цены</span><h2 data-split>Стоимость</h2></div><a class="link" href="../ceny.html">Весь прайс ${icon.arrow}</a></div>
  <div class="ptables">${s.prices.map((k) => `<div class="ptable" data-reveal><h3>${esc(prices[k].title)}</h3>${plist([k])}</div>`).join("")}</div>
  <p class="note" style="margin-top:24px">Цены на 15.10.2026. Точную стоимость врач называет после осмотра.</p>
</div></section>

${docs.length ? `<section class="section"><div class="wrap">
  <div class="section__head"><div><span class="label">Врачи</span><h2 data-split>Кто лечит</h2></div></div>
  <div class="team__grid">${docs.map((d) => doctorCard(d, depth)).join("")}</div>
</div></section>` : ""}

<section class="section ${docs.length ? "section--sage" : ""}"><div class="wrap">
  ${faqBlock([["Вопросы", s.faq]])}
</div></section>

<section class="section"><div class="wrap">
  <div class="section__head"><div><span class="label">Ещё услуги</span><h2 data-split>Другие направления</h2></div></div>
  ${svcRows(rest, depth)}
</div></section>
</main>` + footer(depth) + end;
}

// ---------- прайс ----------
function pagePrices() {
  const depth = 0;
  const order = ["consult", "xray", "therapy", "hygiene", "implant", "bone", "allon", "crowns", "removable", "surgery", "ortho", "kidsOrtho", "kids"];
  return head({ title: "Цены на стоматологию в Удельной и Жуковском | Умная Медицина", desc: "Прайс стоматологии «Умная Медицина»: лечение кариеса от 4 000 ₽, имплантация от 19 300 ₽, коронки от 26 400 ₽, КТ от 2 000 ₽. Цены на 15.10.2026.", canonical: "/ceny", depth, jsonld: [crumbsLd([["ceny", "Цены"]])] })
  + header(depth) + `
<main id="main">
<section class="page-hero on-dark"><div class="foil__bg"></div><div class="wrap page-hero__in">
  <div><nav class="crumbs" aria-label="Хлебные крошки"><a href="index.html">Главная</a><span aria-current="page">Цены</span></nav><h1 data-split>Прайс-лист</h1><p class="page-hero__lead">Цены на 15.10.2026. Итоговую стоимость врач называет после осмотра и записывает в план лечения.</p></div>
  <div class="page-hero__aside"><a class="btn btn--lg" href="zapis.html" data-magnet>Записаться ${icon.arrow}</a></div>
</div></section>
<section class="section"><div class="wrap">
  <div class="pfilter">
    <label class="sr" for="p-search">Поиск услуги</label><input id="p-search" type="search" placeholder="Найти услугу: коронка, имплант, КТ…">
    <div class="chips" role="group" aria-label="Разделы прайса"><button type="button" class="chip is-on" data-filter="">Все</button>${order.map((k) => `<button type="button" class="chip" data-filter="${k}">${esc(prices[k].title)}</button>`).join("")}</div>
  </div>
  <div class="ptables">${order.map((k) => `<div class="ptable" data-cat="${k}"><h3>${esc(prices[k].title)}</h3>${plist([k])}</div>`).join("")}</div>
  <p class="pempty note" hidden>Ничего не нашлось. Позвоните, и администратор подскажет цену: <a href="${clinic.phoneHref}">${esc(clinic.phone)}</a></p>
</div></section>
</main>` + footer(depth) + end;
}

// ---------- онлайн-запись ----------
function pageBooking() {
  const depth = 0;
  const bdata = {
    services: homeOrder.map((k) => ({ slug: k, title: svc[k].title, short: svc[k].short, from: svc[k].from })),
    doctors: doctors.map((d) => ({ id: d.id, short: d.short, role: d.role, tags: d.tags, photo: d.photo ? d.photo.replace("_square.jpg", "_square_small.jpg") : null, initials: d.short.split(" ").map((w) => w[0]).join("") })),
  };
  return head({ title: "Записаться на приём | Умная Медицина. Стоматология", desc: "Онлайн-запись в стоматологию «Умная Медицина»: выберите услугу, врача и удобное время.", canonical: "/zapis", depth, page: "booking" }) + `
<div class="booking" id="booking">
  <main class="booking__main" id="main">
    <div class="booking__top">
      <a class="logo" href="index.html" aria-label="На главную">${logoImg(depth)}<span class="logo__text">Умная Медицина<small>стоматология</small></span><span class="logo__unit">Стоматология</span></a>
      <a class="btn btn--ghost btn--sm" href="index.html">Отменить</a>
    </div>
    <div>
      <section class="bstep bstart" data-step="0">
        <span class="label">Онлайн-запись</span>
        <h1 tabindex="-1">Записаться на приём</h1>
        <p>Ваша улыбка начинается здесь. Выберите услугу, врача и удобное время, а администратор подтвердит запись.</p>
        <button class="btn btn--lg" type="button" data-start data-magnet>Перейти к записи ${icon.arrow}</button>
      </section>
      <section class="bstep" data-step="1" hidden>
        <div class="bsteps" aria-hidden="true"><span><i></i></span><span><i></i></span><span><i></i></span><span><i></i></span></div>
        <span class="label">Шаг 1 из 4</span><h2 tabindex="-1">Что нужно сделать?</h2>
        <div class="opts" id="b-services"></div>
      </section>
      <section class="bstep" data-step="2" hidden>
        <div class="bsteps" aria-hidden="true"><span class="is-done"><i></i></span><span><i></i></span><span><i></i></span><span><i></i></span></div>
        <span class="label">Шаг 2 из 4</span><h2 tabindex="-1">К какому врачу?</h2>
        <div class="opts" id="b-doctors"></div>
        <div class="bnav"><button class="btn btn--ghost btn--sm" type="button" data-back>Назад</button></div>
      </section>
      <section class="bstep" data-step="3" hidden>
        <div class="bsteps" aria-hidden="true"><span class="is-done"><i></i></span><span class="is-done"><i></i></span><span><i></i></span><span><i></i></span></div>
        <span class="label">Шаг 3 из 4</span><h2 tabindex="-1">Когда удобно?</h2>
        <div class="days" id="b-days"></div>
        <div class="slots" id="b-slots"></div>
        <p class="note" style="margin-top:14px">Пример расписания. В рабочей версии здесь живые окна врачей из МИС клиники.</p>
        <div class="bnav"><button class="btn btn--ghost btn--sm" type="button" data-back>Назад</button><button class="btn btn--sm" type="button" data-next-time disabled>Дальше ${icon.arrow}</button></div>
      </section>
      <section class="bstep" data-step="4" hidden>
        <div class="bsteps" aria-hidden="true"><span class="is-done"><i></i></span><span class="is-done"><i></i></span><span class="is-done"><i></i></span><span><i></i></span></div>
        <span class="label">Шаг 4 из 4</span><h2 tabindex="-1">Как с вами связаться?</h2>
        <form class="form" id="b-form">
          <label>Имя<input name="name" required autocomplete="name"></label>
          <label>Телефон<input name="phone" type="tel" required autocomplete="tel" placeholder="+7 ___ ___-__-__"></label>
          <label>Комментарий<textarea name="comment" placeholder="Например, болит зуб слева внизу"></textarea></label>
          <label class="check"><input type="checkbox" required> Согласен на обработку персональных данных</label>
          <div class="bnav" style="margin-top:6px"><button class="btn btn--ghost btn--sm" type="button" data-back>Назад</button><button class="btn">Записаться ${icon.arrow}</button></div>
        </form>
      </section>
      <section class="bstep bdone" data-step="5" hidden>
        <div class="bdone__ok">${icon.check}</div>
        <h2 tabindex="-1">Заявка отправлена</h2>
        <p class="muted">Это демонстрация. На рабочем сайте запись попадёт в расписание клиники и в amoCRM с меткой источника, а пациенту придёт подтверждение.</p>
        <div class="bnav"><a class="btn" href="index.html">На главную</a></div>
      </section>
    </div>
  </main>
  <aside class="booking__aside on-dark" aria-label="Ваша запись">
    <span class="label label--light">Ваша запись</span>
    <dl class="summary">
      <div><dt>Услуга</dt><dd data-sum="service" class="is-empty">не выбрано</dd></div>
      <div><dt>Врач</dt><dd data-sum="doctor" class="is-empty">не выбрано</dd></div>
      <div><dt>Дата и время</dt><dd data-sum="date" class="is-empty">не выбрано</dd></div>
      <div><dt>Адрес</dt><dd>${esc(clinic.addressShort)}</dd></div>
    </dl>
    <p class="note">Есть вопросы? Позвоните: <a href="${clinic.phoneHref}" style="color:#fff">${esc(clinic.phone)}</a>, ежедневно 9:00–21:00.</p>
  </aside>
</div>
<script type="application/json" id="bdata">${JSON.stringify(bdata).replace(/</g, "\\u003c")}</script>` + end;
}

// ---------- сборка ----------
rmSync(dist, { recursive: true, force: true });
mkdirSync(path.join(dist, "uslugi"), { recursive: true });
mkdirSync(path.join(dist, "assets", "vendor"), { recursive: true });
const out = (f, html) => writeFileSync(path.join(dist, f), html);
out("index.html", pageHome());
out("ceny.html", pagePrices());
out("zapis.html", pageBooking());
for (const s of services) out(`uslugi/${s.slug}.html`, pageService(s));
for (const f of readdirSync(path.join(root, "src", "assets"))) copyFileSync(path.join(root, "src", "assets", f), path.join(dist, "assets", f));
const nm = (p) => path.join(root, "node_modules", p);
copyFileSync(nm("gsap/dist/gsap.min.js"), path.join(dist, "assets/vendor/gsap.min.js"));
copyFileSync(nm("gsap/dist/ScrollTrigger.min.js"), path.join(dist, "assets/vendor/ScrollTrigger.min.js"));
copyFileSync(nm("lenis/dist/lenis.min.js"), path.join(dist, "assets/vendor/lenis.min.js"));
if (existsSync(path.join(root, "src", "images"))) cpSync(path.join(root, "src", "images"), path.join(dist, "images"), { recursive: true });
out("robots.txt", "User-agent: *\nDisallow: /\n");
out(".nojekyll", "");
out("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${["/", "/ceny", "/zapis", ...services.map((s) => `/uslugi/${s.slug}`)].map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>2026-10-15</lastmod></url>`).join("\n")}\n</urlset>\n`);
console.log("Собрано страниц:", 3 + services.length, "→", dist);
