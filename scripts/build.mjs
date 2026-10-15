#!/usr/bin/env node
// Статическая сборка макета: каждая страница отдаётся готовым HTML (важно для SEO),
// общий CSS/JS лежит в assets/. Запуск: npm run build → dist/
import { mkdirSync, writeFileSync, copyFileSync, rmSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clinic, doctors, prices, promos, services, gallery, clinicPhoto } from "../src/data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const SITE = process.env.SITE_URL || "https://umnaya-stomatologiya.ru"; // домен-пример для canonical и разметки

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rub = (n) => n.toLocaleString("ru-RU").replace(/ /g, " ") + " ₽";
const priceText = (p) => {
  if (p === 0) return "Бесплатно";
  if (typeof p === "number") return rub(p);
  const m = /^от (\d+)$/.exec(p);
  return m ? "от " + rub(Number(m[1])) : p;
};
const svc = Object.fromEntries(services.map((s) => [s.slug, s]));
const promo = Object.fromEntries(promos.map((p) => [p.id, p]));

// ---------- иконки (inline SVG, без внешних библиотек) ----------
const icon = {
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 10.4 3.3 2-1 1.7L11 13V7h2z"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.2 5.3 19.9 12l-6.7 6.7-1.4-1.4 4.3-4.3H4v-2h12.1l-4.3-4.3z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 16.2-4.2-4.2-1.4 1.4 5.6 5.6 11-11-1.4-1.4z"/></svg>',
  tg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.4 4.1 2.9 11.3c-1.2.5-1.2 1.2 0 1.6l4.7 1.5 1.8 5.6c.2.6.5.7 1 .3l2.7-2.2 4.8 3.6c.9.5 1.5.2 1.7-.8l3.1-14.7c.3-1.3-.5-1.8-1.3-1.5zM9.8 14.4l-.4 4.1-1.6-5 9.9-6.3z"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7l-1.4-1.4L9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3z"/></svg>',
};
const tooth = '<svg class="logo__mark" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="var(--green)"/><path d="M13.6 11.2c2.3-1 4.2 0 6.4 0s4.1-1 6.4 0c3.2 1.4 3.3 6.3 2.2 9.6-.8 2.4-1.4 4.4-1.7 6.9-.3 2.3-1.3 3.6-2.5 3.6-1.5 0-1.8-1.9-2.2-4-.3-1.6-.8-2.9-2.2-2.9s-1.9 1.3-2.2 2.9c-.4 2.1-.7 4-2.2 4-1.2 0-2.2-1.3-2.5-3.6-.3-2.5-.9-4.5-1.7-6.9-1.1-3.3-1-8.2 2.2-9.6z" fill="#fff"/></svg>';

// ---------- общие куски ----------
function head({ title, desc, canonical, depth, jsonld = [] }) {
  const p = "../".repeat(depth);
  return `<!doctype html>
<html lang="ru">
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
<meta name="theme-color" content="#299926">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600&family=Unbounded:wght@500;600&display=swap">
<link rel="stylesheet" href="${p}assets/styles.css">
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join("\n")}
</head>
<body>
<div class="demo-bar">Демонстрационный макет нового сайта. Цены перенесены с um-med.com, акции и сроки ждут согласования с клиникой.</div>`;
}

function header(depth, active = "") {
  const p = "../".repeat(depth);
  const link = (href, label, key) => `<a href="${p}${href}"${active === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `
<header class="header">
  <div class="topline wrap">
    <a class="topline__back" href="${clinic.mainSite}">Многопрофильная клиника «Умная Медицина» ${icon.arrow}</a>
    <span class="topline__info">${icon.pin}${esc(clinic.addressShort)} · ${esc(clinic.near)}</span>
    <span class="topline__info">${icon.clock}${esc(clinic.hours)}</span>
  </div>
  <div class="header__main wrap">
    <a class="logo" href="${p}index.html" aria-label="Умная Медицина. Стоматология, на главную">${tooth}<span class="logo__text"><b>Умная Медицина</b><small>стоматология</small></span></a>
    <nav class="nav" id="nav" aria-label="Основное меню">
      <div class="nav__drop">
        <button class="nav__toggle" type="button" aria-expanded="false" aria-controls="nav-services">Услуги</button>
        <div class="nav__panel" id="nav-services">
          ${services.map((s) => `<a href="${p}uslugi/${s.slug}.html"><b>${esc(s.menu)}</b><small>${esc(s.short)} · ${esc(s.from)}</small></a>`).join("")}
        </div>
      </div>
      ${link("akcii.html", "Акции", "akcii")}
      ${link("ceny.html", "Цены", "ceny")}
      ${link("vrachi.html", "Врачи", "vrachi")}
      ${link("otzyvy.html", "Отзывы", "otzyvy")}
      ${link("kontakty.html", "Контакты", "kontakty")}
    </nav>
    <div class="header__cta">
      <a class="header__phone" href="${clinic.phoneHref}">${esc(clinic.phone)}</a>
      <button class="btn btn--primary" type="button" data-book>Записаться</button>
      <button class="burger" type="button" aria-label="Открыть меню" aria-expanded="false" aria-controls="nav">${icon.menu}</button>
    </div>
  </div>
</header>`;
}

function footer(depth) {
  const p = "../".repeat(depth);
  return `
<footer class="footer">
  <div class="wrap footer__grid">
    <div class="footer__brand">
      <a class="logo logo--light" href="${p}index.html">${tooth}<span class="logo__text"><b>Умная Медицина</b><small>стоматология</small></span></a>
      <p>Стоматология для взрослых и детей в Удельной, рядом с Жуковским. Работаем с 2016 года вместе с многопрофильной клиникой на Громова, 10.</p>
    </div>
    <nav class="footer__col" aria-label="Услуги">
      <h3>Услуги</h3>
      ${services.map((s) => `<a href="${p}uslugi/${s.slug}.html">${esc(s.menu)}</a>`).join("")}
    </nav>
    <nav class="footer__col" aria-label="Пациентам">
      <h3>Пациентам</h3>
      <a href="${p}akcii.html">Акции</a><a href="${p}ceny.html">Цены</a><a href="${p}vrachi.html">Врачи</a><a href="${p}otzyvy.html">Отзывы</a><a href="${p}kontakty.html">Контакты</a>
      <a href="${clinic.mainSite}">Многопрофильная клиника</a>
    </nav>
    <div class="footer__col">
      <h3>Контакты</h3>
      <a class="footer__phone" href="${clinic.phoneHref}">${esc(clinic.phone)}</a>
      <span>${esc(clinic.address)}</span>
      <span>${esc(clinic.hours)}</span>
      <a href="mailto:${clinic.email}">${esc(clinic.email)}</a>
      <div class="footer__msg"><a href="${clinic.telegram}">Telegram</a><a href="${clinic.max}">MAX</a><a href="${clinic.vk}">ВКонтакте</a></div>
    </div>
  </div>
  <div class="wrap footer__legal">
    <span>${esc(clinic.legal)}, ИНН ${clinic.inn}, ОГРН ${clinic.ogrn}. Лицензия на медицинскую деятельность.</span>
    <span>Имеются противопоказания, необходима консультация специалиста.</span>
  </div>
</footer>
<div class="mobilebar">
  <a href="${clinic.phoneHref}">${icon.phone}Позвонить</a>
  <button type="button" data-book>Записаться</button>
  <a href="${clinic.telegram}">${icon.tg}Telegram</a>
</div>
${bookingDialog()}
<script src="${p}assets/app.js" defer></script>
</body>
</html>`;
}

function bookingDialog() {
  const days = ["Чт, 16 окт", "Пт, 17 окт", "Сб, 18 окт", "Вс, 19 окт", "Пн, 20 окт"];
  const slots = ["9:30", "11:00", "12:30", "14:00", "15:30", "17:00", "18:30", "20:00"];
  return `
<dialog class="book" id="book" aria-labelledby="book-title">
  <form method="dialog" class="book__close-form"><button class="book__close" aria-label="Закрыть">${icon.close}</button></form>
  <h2 id="book-title">Запись в стоматологию</h2>
  <div class="tabs" role="tablist">
    <button role="tab" aria-selected="true" aria-controls="tab-call" id="t-call" type="button">Перезвоните мне</button>
    <button role="tab" aria-selected="false" aria-controls="tab-online" id="t-online" type="button">Выбрать время</button>
  </div>
  <div role="tabpanel" id="tab-call" aria-labelledby="t-call">
    <form class="form" data-demo-form>
      <label>Имя<input id="b-name" name="name" required autocomplete="name"></label>
      <label>Телефон<input id="b-phone" name="phone" type="tel" required autocomplete="tel" placeholder="+7 ___ ___-__-__"></label>
      <label>Услуга<select id="b-service" name="service"><option value="">Не знаю, нужна консультация</option>${services.map((s) => `<option value="${s.slug}">${esc(s.title)}</option>`).join("")}</select></label>
      <label class="check"><input id="b-consent" type="checkbox" required> Согласен на обработку персональных данных</label>
      <button class="btn btn--primary btn--wide">Жду звонка</button>
      <p class="form__note">Администратор перезвонит в рабочее время, с 9:00 до 21:00.</p>
    </form>
  </div>
  <div role="tabpanel" id="tab-online" aria-labelledby="t-online" hidden>
    <label class="form">Врач<select id="b-doctor">${doctors.map((d) => `<option>${esc(d.short)}, ${esc(d.role.toLowerCase())}</option>`).join("")}</select></label>
    <div class="days">${days.map((d, i) => `<button type="button" class="chip${i === 0 ? " is-on" : ""}">${d}</button>`).join("")}</div>
    <div class="slots">${slots.map((t, i) => `<button type="button" class="slot"${i === 2 || i === 5 ? " disabled" : ""}>${t}</button>`).join("")}</div>
    <p class="form__note">Пример расписания. В рабочей версии здесь живые окна врачей из МИС SQNS.</p>
  </div>
  <div class="book__done" hidden><h3>Заявка принята</h3><p>Это демонстрация. На рабочем сайте заявка уйдёт в amoCRM с меткой источника, а администратор перезвонит.</p></div>
</dialog>`;
}

const breadcrumbs = (depth, items) => {
  const p = "../".repeat(depth);
  return `<nav class="crumbs wrap" aria-label="Хлебные крошки"><a href="${p}index.html">Главная</a>${items.map(([href, label]) => (href ? `<a href="${p}${href}">${esc(label)}</a>` : `<span aria-current="page">${esc(label)}</span>`)).join("")}</nav>`;
};
const crumbsLd = (items) => ({
  "@context": "https://schema.org", "@type": "BreadcrumbList",
  itemListElement: [["/", "Главная"], ...items].map(([href, name], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE + (href ? "/" + href.replace(/^\//, "") : "") })),
});
const faqLd = (faq) => ({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });
const dentistLd = {
  "@context": "https://schema.org", "@type": "Dentist", name: "Умная Медицина. Стоматология", telephone: clinic.phone, email: clinic.email, url: SITE,
  address: { "@type": "PostalAddress", streetAddress: "ул. Громова, 10/2", addressLocality: "пгт Удельная", addressRegion: "Московская область", postalCode: "140140", addressCountry: "RU" },
  geo: { "@type": "GeoCoordinates", latitude: clinic.geo.lat, longitude: clinic.geo.lon },
  openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], opens: "09:00", closes: "21:00" }],
  aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", reviewCount: "199" },
  priceRange: "₽₽",
};

const img = (src, alt, cls = "") => `<img class="${cls}" src="${src}" alt="${esc(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('[data-ph]')?.classList.add('ph-on');this.remove()">`;

function doctorCard(d, depth) {
  const p = "../".repeat(depth);
  const initials = d.short.split(" ").map((w) => w[0]).join("");
  return `<article class="doc">
  <div class="doc__photo" data-ph><span class="doc__initials" aria-hidden="true">${initials}</span>${d.photo ? img(d.photo, d.name) : ""}</div>
  <h3 class="doc__name">${esc(d.name)}</h3>
  <p class="doc__role">${esc(d.role)}</p>
  <p class="doc__meta">${d.exp ? `Стаж ${d.exp} лет` : "Стаж уточняется"}${d.rating ? ` · ${icon.star}${d.rating} · ${d.reviews} отзывов` : ""}</p>
  <button class="btn btn--ghost btn--sm" type="button" data-book data-doctor="${esc(d.short)}">Записаться к врачу</button>
</article>`;
}

function promoCard(pr, depth, big = false) {
  const p = "../".repeat(depth);
  const s = svc[pr.service];
  return `<article class="promo${big ? " promo--big" : ""}">
  <span class="promo__tag">${esc(pr.tag)}</span>
  <h3>${esc(pr.title)}</h3>
  <p class="promo__price"><b>${pr.price === 0 ? "Бесплатно" : rub(pr.price)}</b>${pr.old ? `<s>${rub(pr.old)}</s>` : ""}</p>
  <p>${esc(pr.text)}</p>
  <p class="promo__until">${icon.clock}${esc(pr.until)}</p>
  <div class="promo__actions"><button class="btn btn--primary btn--sm" type="button" data-book data-service="${pr.service}">Записаться по акции</button><a class="link" href="${p}uslugi/${s.slug}.html">${esc(s.title)} ${icon.arrow}</a></div>
</article>`;
}

function priceTable(key, opts = {}) {
  const c = prices[key];
  return `<div class="ptable" data-cat="${key}">
  <h3>${esc(c.title)}</h3>
  <ul>${c.items.map(([n, v]) => `<li><span>${esc(n)}</span><b>${priceText(v)}</b></li>`).join("")}</ul>
</div>`;
}

function ratingsBlock() {
  return `<div class="ratings">${clinic.ratings.map((r) => `<a class="rating" href="${r.url}"><span class="rating__site">${r.site}</span><span class="rating__val">${r.value ? icon.star + r.value : "Смотреть"}</span><span class="rating__count">${r.count}</span></a>`).join("")}</div>`;
}

function ctaBand() {
  return `<section class="cta-band" aria-labelledby="cta-title"><div class="wrap cta-band__in">
  <div><h2 id="cta-title">Первый шаг: бесплатная консультация с планом лечения</h2><p>Врач осмотрит зубы, при необходимости сделает снимок и распишет план с ценой по этапам. Решение остаётся за вами.</p></div>
  <form class="form form--inline" data-demo-form>
    <input id="c-name" name="name" placeholder="Имя" aria-label="Имя" required autocomplete="name">
    <input id="c-phone" name="phone" type="tel" placeholder="Телефон" aria-label="Телефон" required autocomplete="tel">
    <button class="btn btn--light">Перезвоните мне</button>
    <label class="check check--light"><input id="c-consent" type="checkbox" required checked> Согласен на обработку персональных данных</label>
  </form>
</div></section>`;
}

// ---------- страницы ----------
function pageHome() {
  const depth = 0;
  const top = ["implantaciya", "lechenie-zubov", "all-on-4", "protezirovanie", "ortodontiya", "detskaya", "gigiena", "hirurgiya", "mikroskop", "diagnostika"];
  return head({ title: "Стоматология в Жуковском и Удельной | Умная Медицина", desc: "Стоматология «Умная Медицина» на Громова, 10/2: имплантация от 19 300 ₽, лечение зубов, All-on-4, брекеты, детский стоматолог. Свой КТ, приём ежедневно 9:00–21:00.", canonical: "/", depth, jsonld: [dentistLd] })
  + header(depth) + `
<main id="main">
<section class="hero">
  <div class="wrap hero__grid">
    <div class="hero__text">
      <p class="eyebrow">Умная Медицина · с 2016 года</p>
      <h1>Стоматология рядом с Жуковским</h1>
      <p class="lead">План лечения и цена до начала работы. Семь врачей, свой КТ и микроскоп: имплантация, All-on-4, брекеты и детский приём на Громова, 10/2, ежедневно с 9:00 до 21:00.</p>
      <div class="hero__actions">
        <button class="btn btn--primary btn--lg" type="button" data-book>Записаться на консультацию</button>
        <a class="btn btn--ghost btn--lg" href="akcii.html">Акции месяца</a>
      </div>
      ${ratingsBlock()}
    </div>
    <div class="hero__visual" data-ph>
      ${img(clinicPhoto, "Стоматология «Умная Медицина» на Громова, 10/2", "hero__img")}
      <div class="hero__card hero__card--promo"><span class="promo__tag">Каждую среду</span><b>Air-Flow ${rub(4500)}</b><s>${rub(5790)}</s></div>
      <div class="hero__card hero__card--slot"><span>Ближайшее окно</span><b>Сегодня, 18:30</b><small>пример</small></div>
    </div>
  </div>
</section>

<section class="facts" aria-label="Клиника в цифрах"><div class="wrap facts__grid">
  <div><b>7</b><span>врачей: терапевты, хирурги, ортопеды, ортодонт, детский</span></div>
  <div><b>4,9</b><span>рейтинг на ПроДокторов по 199 отзывам</span></div>
  <div><b>КТ</b><span>и панорамный снимок в клинике, результат в тот же день</span></div>
  <div><b>9–21</b><span>принимаем ежедневно, без выходных</span></div>
</div></section>

<section class="section" aria-labelledby="svc-title"><div class="wrap">
  <div class="section__head"><h2 id="svc-title">Услуги и цены</h2><a class="link" href="ceny.html">Все цены ${icon.arrow}</a></div>
  <div class="svc-grid">
    ${top.map((k, i) => { const s = svc[k]; return `<a class="svc${i < 2 ? " svc--wide" : ""}" href="uslugi/${s.slug}.html"><span class="svc__title">${esc(s.title)}</span><span class="svc__short">${esc(s.short)}</span><span class="svc__from">${esc(s.from)}</span>${icon.arrow}</a>`; }).join("")}
  </div>
</div></section>

<section class="section section--mint" aria-labelledby="promo-title"><div class="wrap">
  <div class="section__head"><h2 id="promo-title">Акции</h2><a class="link" href="akcii.html">Все акции ${icon.arrow}</a></div>
  <div class="promo-grid">${promos.slice(0, 3).map((pr) => promoCard(pr, depth)).join("")}</div>
</div></section>

<section class="section" aria-labelledby="why-title"><div class="wrap why">
  <div class="why__media" data-ph>${img(gallery[0], "Кабинет стоматологии «Умная Медицина»")}</div>
  <div>
    <h2 id="why-title">Почему пациенты возвращаются</h2>
    <ul class="ticks">
      <li>${icon.check}<div><b>План и цена до лечения.</b> На консультации врач расписывает этапы и стоимость. Цена в договоре не меняется.</div></li>
      <li>${icon.check}<div><b>Диагностика на месте.</b> КТ, ОПТГ и 3D-сканер в клинике: не нужно ехать за снимком.</div></li>
      <li>${icon.check}<div><b>Сложные случаи.</b> Лечение каналов под микроскопом, All-on-4, синус-лифтинг и костная пластика.</div></li>
      <li>${icon.check}<div><b>Рядом многопрофильная клиника.</b> Анализы, терапевт и кардиолог перед имплантацией в соседнем здании.</div></li>
      <li>${icon.check}<div><b>Налоговый вычет.</b> Выдаём справку для возврата 13% за лечение.</div></li>
    </ul>
  </div>
</div></section>

<section class="section" aria-labelledby="doc-title"><div class="wrap">
  <div class="section__head"><h2 id="doc-title">Врачи</h2><a class="link" href="vrachi.html">Все врачи ${icon.arrow}</a></div>
  <div class="doc-row">${doctors.slice(0, 4).map((d) => doctorCard(d, depth)).join("")}</div>
</div></section>

<section class="section section--mint" aria-labelledby="steps-title"><div class="wrap">
  <h2 id="steps-title">Как проходит первый визит</h2>
  <ol class="steps">
    <li><b>Запись</b><span>Онлайн, по телефону или в Telegram. Подтверждаем время сообщением.</span></li>
    <li><b>Осмотр и снимок</b><span>Врач осматривает зубы, при необходимости делаем ОПТГ или КТ.</span></li>
    <li><b>План и цена</b><span>Получаете план лечения с ценой по этапам, можно взять домой и подумать.</span></li>
    <li><b>Лечение</b><span>Начинаем в удобный день, администратор напомнит о визите.</span></li>
  </ol>
</div></section>

<section class="section" aria-labelledby="rev-title"><div class="wrap">
  <div class="section__head"><h2 id="rev-title">Отзывы пациентов</h2><a class="link" href="otzyvy.html">Все отзывы ${icon.arrow}</a></div>
  ${ratingsBlock()}
  <p class="muted">В рабочей версии здесь выводятся свежие отзывы с ПроДокторов, 2ГИС и Яндекс Карт с датой и ссылкой на источник.</p>
</div></section>

<section class="section section--tight" aria-labelledby="gal-title"><div class="wrap">
  <h2 id="gal-title">Клиника</h2>
  <div class="gallery">${gallery.slice(1, 7).map((g, i) => `<figure data-ph>${img(g, `Стоматология «Умная Медицина», фото ${i + 2}`)}</figure>`).join("")}</div>
</div></section>

${ctaBand()}
${contactsBlock(depth)}
</main>` + footer(depth);
}

function contactsBlock(depth) {
  const { lat, lon } = clinic.geo;
  return `<section class="section" aria-labelledby="ct-title"><div class="wrap contacts">
  <div>
    <h2 id="ct-title">Как добраться</h2>
    <dl class="contacts__list">
      <div><dt>Адрес</dt><dd>${esc(clinic.address)}</dd></div>
      <div><dt>Телефон</dt><dd><a href="${clinic.phoneHref}">${esc(clinic.phone)}</a></dd></div>
      <div><dt>Часы работы</dt><dd>${esc(clinic.hours)}</dd></div>
    </dl>
    <div class="contacts__links"><a class="btn btn--ghost btn--sm" href="https://yandex.ru/maps/?rtext=~${lat},${lon}">Маршрут в Яндекс Картах</a><a class="btn btn--ghost btn--sm" href="https://2gis.ru/moscow/firm/70000001080535965">Открыть в 2ГИС</a></div>
  </div>
  <div class="map" data-ph><iframe title="Карта: стоматология на Громова, 10/2" src="https://yandex.ru/map-widget/v1/?ll=${lon}%2C${lat}&z=16&pt=${lon},${lat},pm2grm" loading="lazy"></iframe><span class="map__ph">${icon.pin}Громова, 10/2</span></div>
</div></section>`;
}

function pageService(s) {
  const depth = 1;
  const pr = promo[s.promo];
  const docs = doctors.filter((d) => d.tags.includes(s.slug));
  const rel = services.filter((x) => x.slug !== s.slug).slice(0, 4);
  return head({ title: s.seoTitle, desc: s.seoDesc, canonical: `/uslugi/${s.slug}`, depth, jsonld: [crumbsLd([["uslugi/" + s.slug, s.title]]), faqLd(s.faq), { "@context": "https://schema.org", "@type": "MedicalProcedure", name: s.title, description: s.seoDesc }] })
  + header(depth) + breadcrumbs(depth, [[null, s.title]]) + `
<main id="main">
<section class="svc-hero"><div class="wrap svc-hero__grid">
  <div>
    <h1>${esc(s.h1)}</h1>
    <p class="lead">${esc(s.lead)}</p>
    <ul class="ticks ticks--compact">${s.points.map((t) => `<li>${icon.check}<div>${esc(t)}</div></li>`).join("")}</ul>
    <div class="hero__actions"><button class="btn btn--primary btn--lg" type="button" data-book data-service="${s.slug}">Записаться</button><a class="btn btn--ghost btn--lg" href="#prices">Цены ${esc(s.from)}</a></div>
  </div>
  <aside>${promoCard(pr, depth, true)}</aside>
</div></section>

<section class="section section--mint" aria-labelledby="st-title"><div class="wrap">
  <h2 id="st-title">Этапы</h2>
  <ol class="steps">${s.steps.map((t) => `<li><b>${esc(t)}</b></li>`).join("")}</ol>
</div></section>

<section class="section" id="prices" aria-labelledby="pr-title"><div class="wrap">
  <div class="section__head"><h2 id="pr-title">Цены</h2><a class="link" href="../ceny.html">Весь прайс ${icon.arrow}</a></div>
  <div class="ptables">${s.prices.map((k) => priceTable(k)).join("")}</div>
  <p class="muted">Цены указаны на 15.10.2026. Точную стоимость врач называет после осмотра и фиксирует в плане лечения.</p>
</div></section>

${docs.length ? `<section class="section section--mint" aria-labelledby="dc-title"><div class="wrap"><h2 id="dc-title">Врачи направления</h2><div class="doc-row">${docs.map((d) => doctorCard(d, depth)).join("")}</div></div></section>` : ""}

<section class="section" aria-labelledby="fq-title"><div class="wrap faq">
  <h2 id="fq-title">Частые вопросы</h2>
  <div>${s.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div>
</div></section>

<section class="section section--tight" aria-labelledby="rl-title"><div class="wrap">
  <h2 id="rl-title">Другие услуги</h2>
  <div class="svc-grid svc-grid--4">${rel.map((x) => `<a class="svc" href="${x.slug}.html"><span class="svc__title">${esc(x.title)}</span><span class="svc__short">${esc(x.short)}</span><span class="svc__from">${esc(x.from)}</span>${icon.arrow}</a>`).join("")}</div>
</div></section>
${ctaBand()}
</main>` + footer(depth);
}

function pagePromos() {
  const depth = 0;
  return head({ title: "Акции стоматологии «Умная Медицина» в Жуковском", desc: "Действующие акции: профгигиена Air-Flow по средам 4 500 ₽, консультация хирурга и КТ в подарок, временный протез All-on-4 за 77 000 ₽.", canonical: "/akcii", depth, jsonld: [crumbsLd([["akcii", "Акции"]])] })
  + header(depth, "akcii") + breadcrumbs(depth, [[null, "Акции"]]) + `
<main id="main"><section class="section"><div class="wrap">
  <h1>Акции</h1>
  <p class="lead">У каждой акции есть срок и условия. Записаться можно прямо с карточки, администратор применит цену автоматически.</p>
  <div class="promo-grid promo-grid--2">${promos.map((pr) => promoCard(pr, depth)).join("")}</div>
  <p class="muted">Акции не суммируются. Подробности уточняйте у администратора.</p>
</div></section>${ctaBand()}</main>` + footer(depth);
}

function pagePrices() {
  const depth = 0;
  const order = ["consult", "therapy", "hygiene", "implant", "bone", "allon", "crowns", "removable", "surgery", "ortho", "kidsOrtho", "kids", "xray"];
  return head({ title: "Цены на стоматологию в Жуковском и Удельной | Умная Медицина", desc: "Прайс стоматологии «Умная Медицина»: лечение кариеса от 4 000 ₽, имплантация от 19 300 ₽, коронки от 26 400 ₽, КТ от 2 000 ₽. Цены на 15.10.2026.", canonical: "/ceny", depth, jsonld: [crumbsLd([["ceny", "Цены"]])] })
  + header(depth, "ceny") + breadcrumbs(depth, [[null, "Цены"]]) + `
<main id="main"><section class="section"><div class="wrap">
  <h1>Цены</h1>
  <p class="lead">Цены на 15.10.2026. Итоговую стоимость врач фиксирует в плане лечения, она не меняется после начала работ.</p>
  <div class="pfilter">
    <label class="pfilter__search">Поиск услуги<input id="p-search" type="search" placeholder="Например, коронка или имплант"></label>
    <div class="pfilter__chips" role="group" aria-label="Разделы прайса"><button type="button" class="chip is-on" data-filter="">Все</button>${order.map((k) => `<button type="button" class="chip" data-filter="${k}">${esc(prices[k].title)}</button>`).join("")}</div>
  </div>
  <div class="ptables ptables--all">${order.map((k) => priceTable(k)).join("")}</div>
  <p class="pempty muted" hidden>Ничего не нашлось. Позвоните, и администратор подскажет цену: <a href="${clinic.phoneHref}">${esc(clinic.phone)}</a></p>
</div></section>${ctaBand()}</main>` + footer(depth);
}

function pageDoctors() {
  const depth = 0;
  return head({ title: "Врачи-стоматологи «Умной Медицины» в Жуковском", desc: "Стоматологи клиники «Умная Медицина»: хирурги-имплантологи, терапевты, ортопеды, ортодонт и детский стоматолог. Стаж, рейтинг и запись к врачу.", canonical: "/vrachi", depth, jsonld: [crumbsLd([["vrachi", "Врачи"]])] })
  + header(depth, "vrachi") + breadcrumbs(depth, [[null, "Врачи"]]) + `
<main id="main"><section class="section"><div class="wrap">
  <h1>Врачи</h1>
  <p class="lead">Стаж и рейтинги взяты с ПроДокторов. Записаться можно к конкретному врачу.</p>
  <div class="doc-row doc-row--all">${doctors.map((d) => doctorCard(d, depth)).join("")}</div>
</div></section>${ctaBand()}</main>` + footer(depth);
}

function pageReviews() {
  const depth = 0;
  return head({ title: "Отзывы о стоматологии «Умная Медицина»", desc: "Рейтинг стоматологии «Умная Медицина»: 4,9 на ПроДокторов по 199 отзывам, 5,0 в 2ГИС. Отзывы о врачах и лечении.", canonical: "/otzyvy", depth, jsonld: [crumbsLd([["otzyvy", "Отзывы"]])] })
  + header(depth, "otzyvy") + breadcrumbs(depth, [[null, "Отзывы"]]) + `
<main id="main"><section class="section"><div class="wrap">
  <h1>Отзывы</h1>
  <p class="lead">Мы не пишем отзывы сами и не удаляем негативные. Все отзывы собраны на независимых площадках.</p>
  ${ratingsBlock()}
  <div class="review-demo">
    <article class="review review--demo"><p class="review__src">ПроДокторов · образец карточки</p><p>Здесь появится текст свежего отзыва пациента с датой, именем врача и ссылкой на оригинал.</p></article>
    <article class="review review--demo"><p class="review__src">2ГИС · образец карточки</p><p>Отзывы подтягиваются автоматически, поэтому блок всегда показывает актуальные оценки.</p></article>
    <article class="review review--demo"><p class="review__src">Яндекс Карты · образец карточки</p><p>Пациент может сразу перейти на площадку и оставить свой отзыв после визита.</p></article>
  </div>
</div></section>${ctaBand()}</main>` + footer(depth);
}

function pageContacts() {
  const depth = 0;
  return head({ title: "Контакты стоматологии «Умная Медицина»: Громова, 10/2", desc: "Стоматология «Умная Медицина»: пгт Удельная, ул. Громова, 10/2, рядом с Жуковским. Телефон +7 495 150-36-15, ежедневно 9:00–21:00.", canonical: "/kontakty", depth, jsonld: [crumbsLd([["kontakty", "Контакты"]]), dentistLd] })
  + header(depth, "kontakty") + breadcrumbs(depth, [[null, "Контакты"]]) + `<main id="main"><h1 class="wrap sr-h1">Контакты</h1>${contactsBlock(depth)}${ctaBand()}</main>` + footer(depth);
}

// ---------- сборка ----------
rmSync(dist, { recursive: true, force: true });
mkdirSync(path.join(dist, "uslugi"), { recursive: true });
mkdirSync(path.join(dist, "assets"), { recursive: true });
const out = (f, html) => writeFileSync(path.join(dist, f), html);
out("index.html", pageHome());
out("akcii.html", pagePromos());
out("ceny.html", pagePrices());
out("vrachi.html", pageDoctors());
out("otzyvy.html", pageReviews());
out("kontakty.html", pageContacts());
for (const s of services) out(`uslugi/${s.slug}.html`, pageService(s));
for (const f of readdirSync(path.join(root, "src", "assets"))) copyFileSync(path.join(root, "src", "assets", f), path.join(dist, "assets", f));
out("robots.txt", "User-agent: *\nDisallow: /\n");
out(".nojekyll", "");
out("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${["/", "/akcii", "/ceny", "/vrachi", "/otzyvy", "/kontakty", ...services.map((s) => `/uslugi/${s.slug}`)].map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>2026-10-15</lastmod></url>`).join("\n")}\n</urlset>\n`);
console.log("Собрано страниц:", 6 + services.length, "→", dist);
