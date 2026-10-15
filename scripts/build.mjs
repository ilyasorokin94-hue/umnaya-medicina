#!/usr/bin/env node
// Сборка макета: главная-одностраничник, страницы услуг и врачей, прайс и онлайн-запись.
// Каждая страница отдаётся готовым HTML (важно для SEO). Запуск: npm run build → dist/
import { mkdirSync, writeFileSync, copyFileSync, rmSync, readdirSync, existsSync, cpSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clinic, doctors, prices, services, brand, pics, homeOrder, features, priceTabs, offers, about, home } from "../src/data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const SITE = process.env.SITE_URL || "https://umnaya-stomatologiya.ru"; // домен-пример для canonical и разметки

// неразрывные пробелы: «4 000 ₽» и «+7 495 150-36-15» не разваливаются на две строки
const nb = (s) => String(s).replace(/(\d) (?=\d{3}(?!\d))/g, "$1\u00a0").replace(/ (₽|%)/g, "\u00a0$1");
const esc = (s) => nb(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rub = (n) => n.toLocaleString("ru-RU").replace(/\s/g, "\u00a0") + "\u00a0₽";
const priceText = (p) => {
  if (p === 0) return "Бесплатно";
  if (typeof p === "number") return rub(p);
  const m = /^от (\d+)$/.exec(p);
  return m ? "от " + rub(Number(m[1])) : p;
};
const svc = Object.fromEntries(services.map((s) => [s.slug, s]));
const pre = (depth) => "../".repeat(depth);

// ---------- картинки: локальный файл, если он есть, иначе запасной адрес ----------
const local = (rel) => rel && existsSync(path.join(root, "src", rel));
function pick(entry, depth) {
  const c = entry.filter(Boolean).filter((u) => /^https?:/.test(u) || local(u)).map((u) => (/^https?:/.test(u) ? u : pre(depth) + u));
  return { src: c[0] || "", fb: c[1] || "" };
}
// eager: картинка первого экрана, грузится сразу и с высоким приоритетом
const img = (entry, alt, depth, { eager = false, attrs = "" } = {}) => {
  const { src, fb } = pick(entry, depth);
  if (!src) return "";
  return `<img src="${src}"${fb ? ` data-fb="${fb}"` : ""} alt="${esc(alt)}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async" referrerpolicy="no-referrer" onerror="umImg(this)"${attrs}>`;
};
const ph = (text = "Фото клиники") => `<span class="ph">${esc(text)}</span>`;
const logoImg = (depth, eager = true) => {
  const { src, fb } = pick(brand.logo, depth);
  return `<img class="logo__img" src="${src}"${fb ? ` data-fb="${fb}"` : ""} alt=""${eager ? "" : ' loading="lazy"'} referrerpolicy="no-referrer" onerror="umLogo(this)">`;
};

// ---------- иконки ----------
const icon = {
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18v2H3zm0 8h18v2H3z"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7l-1.4-1.4L9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 16.2-4.2-4.2-1.4 1.4 5.6 5.6 11-11-1.4-1.4z"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>',
  file: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm4 18H6V4h7v5h5zM8 13h8v2H8zm0 4h5v2H8z"/></svg>',
};

// ---------- общие куски ----------
const sections = [["services", "Услуги"], ["about", "О клинике"], ["team", "Врачи"], ["reviews", "Отзывы"], ["pricing", "Цены"], ["faq", "Вопросы"], ["contacts", "Контакты"]];

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
(function(d){d.classList.add("js");try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches)d.classList.add("js-anim")}catch(e){}
setTimeout(function(){if(!window.__umReady)d.classList.remove("js-anim")},4000)})(document.documentElement);
window.umImg=function(i){var f=i.getAttribute("data-fb");if(f){i.removeAttribute("data-fb");i.src=f;return}var p=i.closest("[data-ph]");if(p)p.classList.add("ph-on");i.style.opacity="0"};
window.umLogo=function(i){var f=i.getAttribute("data-fb");if(f){i.removeAttribute("data-fb");i.src=f;return}var p=i.closest(".logo");if(p)p.classList.add("is-fallback");i.style.display="none"};
</script>
<script src="${p}assets/vendor/gsap.min.js" defer></script>
<script src="${p}assets/vendor/ScrollTrigger.min.js" defer></script>
<script src="${p}assets/vendor/lenis.min.js" defer></script>
<script src="${p}assets/app.js" defer></script>
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join("\n")}
</head>
<body${page === "booking" ? ' class="booking-page"' : ""}>
<a class="skip" href="#main">К содержанию</a>
<div class="demo-bar">Демонстрационный макет нового сайта стоматологии «Умная Медицина». Заявки из форм пока никуда не отправляются.</div>`;
}

// кнопки-действия: открывают окно на сайте, без скриптов ведут на запись, телефон или Telegram
const fallbackHref = (kind, p, o = {}) => kind === "call" ? clinic.phoneHref
  : kind === "xray" || kind === "write" ? clinic.telegram
  : kind === "allon" ? `${p}zapis.html?service=all-on-4`
  : `${p}zapis.html${o.service ? `?service=${o.service}` : o.doctor ? `?doctor=${o.doctor}` : ""}`;
const act = (label, kind, p, o = {}) => `<a class="${o.link ? "link" : "btn"}${o.cls ? " " + o.cls : ""}" href="${fallbackHref(kind, p, o)}" data-modal="${kind}"${o.reason ? ` data-reason="${esc(o.reason)}"` : ""}${o.doctor ? ` data-doctor="${o.doctor}"` : ""}>${esc(label)}</a>`;
// единый хвост блока: оффер, кнопка (и ссылка), строка под кнопкой
const ctaBox = (offer, btn, link, note) => `<div class="cta-box" data-reveal>${offer ? `<p class="cta-box__offer">${esc(offer)}</p>` : ""}<div class="cta-box__row">${btn}${link || ""}</div>${note ? `<p class="cta-box__note">${esc(note)}</p>` : ""}</div>`;
// список фактов с галочками
const checks = (list, cls = "", attrs = "") => `<ul class="checks${cls ? " " + cls : ""}"${attrs}>${list.map((t) => `<li>${icon.check}<span>${esc(t)}</span></li>`).join("")}</ul>`;
const ext = ' target="_blank" rel="noopener"';

function header(depth, home = false) {
  const p = pre(depth);
  const href = (id) => (home ? `#${id}` : `${p}index.html#${id}`);
  return `
<header class="header"><div class="header__bar">
  <a class="logo" href="${p}index.html" aria-label="Умная Медицина. Стоматология, на главную">${logoImg(depth)}<span class="logo__text">Умная Медицина<small>стоматология</small></span><span class="logo__unit">Стоматология</span></a>
  <nav class="nav" aria-label="Разделы">${sections.map(([id, t]) => `<a href="${href(id)}">${t}</a>`).join("")}</nav>
  <div class="header__cta">
    <a class="header__phone" href="${clinic.phoneHref}"><b>${esc(clinic.phone)}</b><small>${esc(clinic.hours)}</small></a>
    ${act("Перезвоните мне", "call", p, { cls: "btn--ghost btn--sm header__call" })}
    ${act("Записаться", "book", p, { cls: "btn--sm header__book" })}
    <button class="burger" type="button" aria-label="Открыть меню" aria-expanded="false" aria-controls="menu">${icon.menu}</button>
  </div>
</div></header>
<div class="menu" id="menu" role="dialog" aria-modal="true" aria-label="Меню">
  <div class="menu__top"><a class="logo logo--white" href="${p}index.html">${logoImg(depth, false)}<span class="logo__text">Умная Медицина<small>стоматология</small></span></a><button class="menu__close" type="button" aria-label="Закрыть меню">${icon.close}</button></div>
  <nav aria-label="Разделы">${sections.map(([id, t]) => `<a href="${href(id)}">${t}</a>`).join("")}</nav>
  <div class="menu__foot"><a class="menu__phone" href="${clinic.phoneHref}">${esc(clinic.phone)}</a><span class="note">${esc(clinic.hours)}</span>${act("Перезвоните мне", "call", p, { cls: "btn--ghost btn--wide" })}${act("Записаться", "book", p, { cls: "btn--wide" })}</div>
</div>`;
}

// окна: запись, перезвон, снимок на второе мнение, расчёт All-on-4, мессенджеры, при уходе, «спасибо»
function modals(depth) {
  const consent = `Отправляя заявку, вы соглашаетесь на <a href="https://um-med.com/assets/files/pol.pdf"${ext}>обработку персональных данных</a>.`;
  const phone = `<label class="field">Телефон<input name="phone" type="tel" required autocomplete="tel" inputmode="tel" placeholder="+7 ___ ___-__-__"></label>`;
  const name = `<label class="field">Имя<input name="name" autocomplete="given-name" required></label>`;
  const file = (t) => `<label class="file">${t}<input name="file" type="file" accept="image/*,.pdf,.zip,.dcm"><span>${icon.file}<em>Выбрать файл</em></span></label>`;
  const msgr = `<div class="modal__msgr"><a class="btn btn--ghost btn--sm" href="${clinic.telegram}"${ext}>Отправить в Telegram</a><a class="btn btn--ghost btn--sm" href="${clinic.max}"${ext}>Отправить в MAX</a></div>`;
  // обычное окно: заголовок и форма; окно со снимком: слева тёмная панель с фото и заголовком, справа форма
  const box = (id, title, sub, inner, o = {}) => `<div class="modal${o.cls ? " " + o.cls : ""}" id="m-${id}" role="dialog" aria-modal="true" aria-labelledby="m-${id}-t" hidden><div class="modal__box${o.aside ? " modal__box--split" : ""}" data-lenis-prevent>
  <button class="modal__x" type="button" aria-label="Закрыть" data-close>${icon.close}</button>
  ${o.aside ? `<div class="modal__aside on-dark"><figure class="modal__img" data-ph>${img(pics.xray, "", depth)}</figure><h2 id="m-${id}-t" tabindex="-1">${title}</h2>${sub}</div><div class="modal__main">${inner}</div>`
    : `${o.top || ""}<h2 id="m-${id}-t" tabindex="-1">${title}</h2>${sub}${inner}`}
</div></div>`;
  return `
<script type="application/json" id="um-docs">${JSON.stringify(Object.fromEntries(doctors.map((d) => [d.id, d.short])))}</script>
<div class="modals">
${box("book", "Запишитесь на бесплатную консультацию", `<p class="modal__sub">Перезвоним за 5 минут, подберём врача и удобное время.</p>
  <p class="modal__doc" hidden></p>`, `
  <form class="form lead" data-lead="book">
    <input type="hidden" name="doctor"><div class="form__row">${name}${phone}</div>
    <fieldset class="reasons"><legend>Что беспокоит <span>необязательно</span></legend><div class="chips">${home.reasons.map((r) => `<label class="chip chip--pick"><input type="radio" name="reason" value="${esc(r)}"><span>${esc(r)}</span></label>`).join("")}</div></fieldset>
    <button class="btn btn--lg btn--wide">Жду звонка</button>
    <p class="modal__note">Перезвоним за 5 минут. Заявки после 21:00 перезваниваем с 9:00 утра. ${consent}</p>
  </form>`)}
${box("call", "Перезвоним за 5 минут", `<p class="modal__sub">Оставьте номер, администратор перезвонит и ответит на вопросы.</p>`, `
  <form class="form lead" data-lead="call">${phone}
    <button class="btn btn--lg btn--wide">Жду звонка</button>
    <p class="modal__note">${consent}</p>
  </form>`, { cls: "modal--sm" })}
${box("xray", "Пришлите снимок, и врач скажет, можно ли сохранить зуб", `<p class="modal__sub">Подойдёт КТ, панорама, прицельный снимок или фото плана лечения из другой клиники. Врач посмотрит и ответит в течение рабочего дня. Это бесплатно.</p>`, `
  <form class="form lead" data-lead="xray"><div class="form__row">${name}${phone}</div>
    ${file("Снимок или план")}
    <button class="btn btn--lg btn--wide">Отправить снимок</button>
    ${msgr}
    <p class="modal__note">Если зуб можно спасти, скажем, как и сколько это стоит. ${consent}</p>
  </form>`, { aside: true })}
${box("allon", "Расчёт All-on-4 для вашего случая", `<p class="modal__sub">Имплантолог посмотрит ответы, и мы перезвоним с полной ценой: хирургия, временные зубы и постоянный протез.</p>`, `
  <form class="form lead" data-lead="allon"><div class="form__row">${name}${phone}</div>
    <fieldset class="reasons"><legend>Одна или обе челюсти</legend><div class="chips">${["Одна челюсть", "Обе челюсти"].map((r, i) => `<label class="chip chip--pick"><input type="radio" name="jaws" value="${r}"${i ? "" : " checked"}><span>${r}</span></label>`).join("")}</div></fieldset>
    <fieldset class="reasons"><legend>Носите ли съёмный протез</legend><div class="chips">${["Да, ношу", "Нет"].map((r) => `<label class="chip chip--pick"><input type="radio" name="denture" value="${r}"><span>${r}</span></label>`).join("")}</div></fieldset>
    <button class="btn btn--lg btn--wide">Получить расчёт</button>
    <p class="modal__note">Перезвоним за 5 минут. Расчёт бесплатный. ${consent}</p>
  </form>`)}
${box("write", "Напишите нам", `<p class="modal__sub">Ответим за 5 минут, ежедневно с 9:00 до 21:00. Можно сразу прислать снимок, врач посмотрит его до визита.</p>`, `
  <div class="modal__msgr modal__msgr--big"><a class="btn btn--lg" href="${clinic.telegram}"${ext}>Telegram</a><a class="btn btn--lg btn--ghost" href="${clinic.max}"${ext}>MAX</a></div>`, { cls: "modal--sm" })}
${box("exit", "Пока не готовы прийти?", `<p class="modal__sub">Пришлите снимок, и врач бесплатно скажет, можно ли сохранить зуб.</p>`, `
  <form class="form lead" data-lead="exit">${phone}
    ${file("Снимок или план")}
    <button class="btn btn--lg btn--wide">Прислать снимок</button>
    ${msgr}
    <p class="modal__note">${consent}</p>
  </form>`, { aside: true, cls: "modal--exit" })}
${box("done", "Спасибо!", `<p class="modal__sub" data-done-text>Администратор перезвонит за 5 минут с номера ${esc(clinic.phone)}. Пока ждёте, можете прислать снимок в Telegram или MAX, врач посмотрит его до визита.</p>`, `
  <div class="modal__msgr"><a class="btn" href="${clinic.telegram}"${ext}>Telegram</a><a class="btn btn--ghost" href="${clinic.max}"${ext}>MAX</a></div>
  <p class="modal__note">Это демонстрация: на рабочем сайте заявка уйдёт в amoCRM с названием формы, поводом, страницей и UTM-метками.</p>`, { cls: "modal--sm modal--done", top: `<div class="modal__ok">${icon.check}</div>` })}
</div>`;
}

function footer(depth) {
  const p = pre(depth);
  const { lat, lon } = clinic.geo;
  return `
<footer class="footer on-dark"><div class="wrap footer__in">
  <div class="footer__cta">
    <div><h2 data-split>${esc(home.final[0])}</h2><p class="footer__lead">${esc(home.final[1])}</p></div>
    <div class="footer__form">
      <form class="lead lead--inline" data-lead="final"><label class="sr" for="f-name-${depth}">Имя</label><input id="f-name-${depth}" name="name" placeholder="Имя" autocomplete="given-name"><label class="sr" for="f-phone-${depth}">Телефон</label><input id="f-phone-${depth}" name="phone" type="tel" required placeholder="Телефон" autocomplete="tel" inputmode="tel"><button class="btn btn--lg">Жду звонка</button></form>
      ${act("Прислать снимок", "xray", p, { link: true, cls: "footer__xray" })}
    </div>
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
      <a href="https://yandex.ru/maps/?rtext=~${lat},${lon}"${ext}>Маршрут в Яндекс Картах</a>
      <a href="${clinic.gis}"${ext}>Открыть в 2ГИС</a>
    </div>
    <nav class="footer__col" aria-label="Услуги">
      <h3>Услуги</h3>
      ${homeOrder.map((k) => `<a href="${p}uslugi/${k}.html">${esc(svc[k].menu)}</a>`).join("")}
    </nav>
    <div class="footer__col">
      <h3>Пациентам</h3>
      <a href="${p}ceny.html">Полный прайс</a>
      <a href="${fallbackHref("book", p)}" data-modal="book">Записаться</a>
      <a href="${clinic.vk}"${ext}>ВКонтакте</a>
      <a href="https://um-med.com/assets/files/dogovor-oferta.pdf"${ext}>Договор-оферта</a>
      <a href="https://um-med.com/assets/files/pol.pdf"${ext}>Политика обработки данных</a>
      <a href="${clinic.mainSite}"${ext}>Многопрофильная клиника</a>
      <a href="https://um-med.com/vacancies.html"${ext}>Вакансии</a>
    </div>
  </div>
  <div class="footer__bottom">
    <a class="logo logo--white" href="${p}index.html" aria-label="Умная Медицина. Стоматология, на главную">${logoImg(depth, false)}<span class="logo__text">Умная Медицина<small>стоматология</small></span></a>
    <div class="footer__legal">
      <span>© 2026 ${esc(clinic.legal)}, ИНН ${clinic.inn}, ОГРН ${clinic.ogrn}. Лицензия на медицинскую деятельность.</span>
      <span>Имеются противопоказания, необходима консультация специалиста.</span>
    </div>
  </div>
</div></footer>
<div class="mobilebar"><a href="${clinic.phoneHref}">${icon.phone}Позвонить</a><a href="${clinic.telegram}" data-modal="write">Написать</a><a href="${fallbackHref("book", p)}" data-modal="book">Записаться</a></div>
${modals(depth)}`;
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
const plist = (keys, limit = 99) => `<ul class="plist">${keys.flatMap((k) => prices[k].items).slice(0, limit).map(([n, v]) => `<li><span>${esc(n)}</span><b>${esc(priceText(v))}</b></li>`).join("")}</ul>`;

// портрет врача: обработанный локальный файл, если он есть, иначе фото с ПроДокторов
const docPhoto = (d) => [`images/doctors/${d.id}.jpg`, `images/doctors/${d.id}.png`, d.photo, d.photo && d.photo.replace("_square.jpg", "_square_small.jpg")];
const initialsOf = (d) => d.short.split(" ").map((w) => w[0]).join("");
const plural = (n, one, few, many) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; };
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const reviewsText = (n) => `${n} ${plural(n, "отзыв", "отзыва", "отзывов")}`;

function doctorCard(d, depth) {
  const p = pre(depth);
  return `<article class="doc" data-tags="${d.tags.join(" ")}" data-reveal>
  <div class="doc__photo" data-ph><span class="doc__initials" aria-hidden="true">${initialsOf(d)}</span>${img(docPhoto(d), d.name, depth)}
    <a class="doc__cover" href="${p}vrachi/${d.id}.html" tabindex="-1" aria-hidden="true"></a></div>
  <h3><a href="${p}vrachi/${d.id}.html">${esc(d.name)}</a></h3>
  <p class="doc__role">${esc(d.role)}</p>
  ${d.focus ? `<p class="doc__focus">${esc(d.focus)}</p>` : ""}
  <p class="doc__meta">${d.exp ? `<span>Стаж <b>${d.exp} лет</b></span>` : ""}${d.rating ? `<span>ПроДокторов <b>${d.rating}</b> · ${reviewsText(d.reviews)}</span>` : ""}</p>
  ${act("Записаться к врачу", "book", p, { cls: "btn--ghost btn--sm doc__cta", doctor: d.id })}
</article>`;
}
// восьмая ячейка сетки врачей, чтобы не оставалось пустого места: подбор врача по телефону
const doctorMore = (depth) => `<article class="doc doc--more on-dark" data-reveal><p>${esc(home.team.more)}</p>${act("Перезвоните мне", "call", pre(depth), { cls: "btn--light btn--sm" })}</article>`;

function faqBlock(groups) {
  // groups: [[title, [[q, a], ...]], ...]
  const multi = groups.length > 1;
  return `<div class="faq${multi ? "" : " faq--one"}">
  ${multi ? `<div class="faq__groups" role="tablist" data-tabs="faq">${groups.map(([t], i) => `<button type="button" role="tab" data-tab="g${i}" aria-selected="${i === 0}">${esc(t)}</button>`).join("")}</div>` : `<div><span class="label">Вопросы</span><h2 class="section__title" data-split>Частые вопросы</h2></div>`}
  <div>${groups.map(([, qs], i) => `<div class="qa-group" data-panel="faq" data-key="g${i}"${i ? " hidden" : ""}>${qs.map(([q, a]) => `<details class="qa"><summary>${esc(q)}<i aria-hidden="true"></i></summary><div class="qa__a"><p>${esc(a)}</p></div></details>`).join("")}</div>`).join("")}</div>
</div>`;
}

function svcRows(keys, depth) {
  const p = pre(depth);
  return `<div class="svc-list">${keys.map((k) => {
    const s = svc[k];
    return `<a class="svc-row" href="${p}uslugi/${k}.html" data-reveal><h3>${esc(s.title)}</h3><span class="svc__from">${esc(s.from)}</span></a>`;
  }).join("")}</div>`;
}

function place() {
  const { lat, lon } = clinic.geo;
  return `<section class="section" id="contacts" aria-labelledby="ct-title"><div class="wrap">
  <div class="section__head"><div><span class="label">Контакты</span><h2 id="ct-title" data-split>${esc(home.contacts[0])}</h2></div><p>${esc(home.contacts[1])}</p></div>
  <div class="place">
    <div class="place__map" data-clip>
      <div class="place__fallback" aria-hidden="true"><b>${esc(clinic.addressShort)}</b><span>${esc(clinic.near)}</span></div>
      <iframe title="Карта: стоматология на Громова, 10/2" src="https://yandex.ru/map-widget/v1/?ll=${lon}%2C${lat}&z=16&pt=${lon},${lat},pm2grm" loading="lazy"></iframe>
      <button class="place__unlock" type="button">Нажмите, чтобы двигать карту</button>
    </div>
    <div class="place__info" data-reveal>
      <h3>Умная Медицина. Стоматология</h3>
      <dl class="place__list">
        <div><dt>Адрес</dt><dd>${esc(clinic.address)}</dd></div>
        <div><dt>Телефон</dt><dd><a href="${clinic.phoneHref}">${esc(clinic.phone)}</a></dd></div>
        <div><dt>Часы работы</dt><dd>${esc(clinic.hours)}</dd></div>
        <div><dt>Почта</dt><dd><a href="mailto:${clinic.email}">${esc(clinic.email)}</a></dd></div>
      </dl>
      <div class="place__btns"><a class="btn btn--sm" href="https://yandex.ru/maps/?rtext=~${lat},${lon}"${ext}>Построить маршрут</a><a class="btn btn--ghost btn--sm" href="${clinic.phoneHref}">Позвонить</a><a class="btn btn--ghost btn--sm" href="${clinic.telegram}"${ext}>Написать в Telegram</a></div>
      <form class="lead lead--inline" data-lead="contacts"><label class="sr" for="c-phone">Телефон</label><input id="c-phone" name="phone" type="tel" required placeholder="Телефон" autocomplete="tel" inputmode="tel"><button class="btn">Перезвоните мне</button></form>
      <p class="cta-box__note">Перезвоним за 5 минут.</p>
    </div>
  </div>
</div></section>`;
}

// ---------- главная ----------
function pageHome() {
  const depth = 0, p = "";
  const { save, restore, allon, kids, quiz, rating } = home;
  // ситуации пациента: три главные крупно, остальные компактно; картинки одной серии
  const sit = ([t, d, price, btn, kind, reason, k, pic], i) => `<article class="sit ${i < 3 ? "sit--lg" : "sit--sm"}" data-reveal>
      <div class="sit__img" data-ph>${img(pic || [], "", depth)}</div>
      <a class="sit__link" href="uslugi/${k}.html" aria-label="${esc(svc[k].title)}"></a>
      <div class="sit__body"><h3>${esc(t)}</h3><p>${esc(d)}</p></div>
      <div class="sit__foot"><b class="sit__price">${esc(price)}</b>${act(btn, kind, p, { cls: "btn--sm", reason })}</div>
    </article>`;
  const [moreT, moreD] = home.situationsMore.split(/\?\s+/);
  const kidsDoc = doctors.find((d) => d.id === kids.doctor);
  const stars = icon.star.repeat(5);
  const sys0 = allon.systems[0];
  const total0 = sys0[1] + allon.temp + allon.perm;
  // отзывы: три колонки, в каждой сначала по три цитаты, остальные открываются кнопкой
  const tone = (j) => ([1, 8, 14].includes(j) ? " rv--ink" : [6, 15].includes(j) ? " rv--green" : [4, 12].includes(j) ? " rv--sage" : "");
  const cols = [[], [], []];
  home.reviews.forEach((q, j) => cols[j % 3].push([q, j]));
  const [pdR, gisR, yaR] = clinic.ratings;
  const site = (k, mark, r, goal) => `<a class="rt-site" href="${r.url}"${ext} data-goal="${goal}">
        <span class="rt-mark rt-mark--${k}" aria-hidden="true">${mark}</span>
        <span class="rt-site__info"><span class="rt-site__name">${esc(r.site)}</span><span class="rt-site__count">${esc(r.count)}</span></span>
        <span class="rt-site__val">${r.value}${icon.star}</span>
      </a>`;

  return head({ title: home.seoTitle, desc: home.seoDesc, canonical: "/", depth, page: "home", jsonld: [dentistLd, faqLd(home.faq.flatMap((g) => g[1]))] })
  + header(depth, true) + `
<main id="main">

<section class="hero on-dark" aria-labelledby="h1">
  <div class="hero__bg" aria-hidden="true"></div>
  <div class="wrap hero__in">
    <div class="hero__main">
      <h1 id="h1"><span class="kicker" data-in>${esc(home.kicker)}</span><span data-split>${esc(home.h1)}</span></h1>
      <p class="hero__sub" data-in>${esc(home.sub)}</p>
      ${checks(home.heroFacts, "checks--row hero__facts", " data-in")}
      <div class="hero__actions" data-in>${act("Записаться на бесплатную консультацию", "book", p, { cls: "btn--lg" })}${act("Прислать снимок на второе мнение", "xray", p, { cls: "btn--ghost btn--lg", reason: "Сказали удалить" })}</div>
      <p class="hero__note" data-in>${home.heroNote.map((t) => `<span>${esc(t)}</span>`).join("")}</p>
    </div>
    <div class="hero__visual">
      <figure class="hero__circle circle" data-ph>${img(pics.hero, "Хирург и ассистент стоматологии «Умная Медицина» на приёме", depth, { eager: true })}</figure>
      <aside class="hero__offer" aria-label="Акция" data-in>
        <h2>${esc(home.heroOffer.title)}</h2>
        <ul>${home.heroOffer.rows.map(([t, v, old]) => `<li><span>${esc(t)}</span><b>${esc(v)}</b><s>${esc(old)}</s></li>`).join("")}</ul>
        ${act("Записаться на консультацию", "book", p, { cls: "btn--sm btn--wide", reason: "Нужен имплант" })}
      </aside>
    </div>
  </div>
</section>

<section class="section section--sage" id="services" aria-labelledby="sv-title"><div class="wrap">
  <div class="section__head"><div><span class="label">С чего начать</span><h2 id="sv-title" data-split>С чем вы к нам придёте</h2></div><a class="link" href="ceny.html">Все цены</a></div>
  <div class="sit-grid">${home.situations.map(sit).join("")}</div>
  <div class="sit-extra">
    <div class="sit-more" data-reveal><span class="label">Ещё направления</span>${svcRows(["diagnostika", "protezirovanie", "hirurgiya"], depth)}</div>
    <article class="sit-call on-dark" data-reveal><h3>${esc(moreT)}?</h3><p>${esc(moreD)}</p>${act("Перезвоните мне", "call", p, { cls: "btn--light" })}</article>
  </div>
</div></section>

<section class="section" id="about" aria-labelledby="ab-title"><div class="wrap">
  <span class="label">О клинике</span>
  <h2 id="ab-title" class="about__statement">${esc(about.statement)}</h2>
  <div class="about__grid">
    <figure class="about__circle circle" data-ph data-clip data-parallax>${img(pics.aboutCircle, "Администраторы встречают пациентов на ресепшене стоматологии «Умная Медицина»", depth)}</figure>
    <div class="about__text">${about.text.map((t) => `<p data-reveal>${esc(t)}</p>`).join("")}
      ${checks(about.facts, "checks--two", " data-reveal")}
      ${ctaBox("", act("Записаться на бесплатную консультацию", "book", p, { cls: "btn--lg" }), "", "Перезвоним за 5 минут.")}
    </div>
  </div>
</div></section>

<section class="section principles on-dark" id="rules" aria-labelledby="ft-title">
  <div class="foil__bg" aria-hidden="true"></div>
  <div class="wrap principles__in">
    <div class="principles__head">
      <span class="label">${esc(home.rules.label)}</span>
      <h2 id="ft-title" data-split>${esc(home.rules.title)}</h2>
      <p>${esc(home.rules.intro)}</p>
      <div class="principles__cta"><p>${esc(home.rules.note)}</p>${act("Записаться на бесплатную консультацию", "book", p, { cls: "btn--light btn--lg" })}</div>
    </div>
    <div class="principles__grid">${features.map(([big, t, d]) => `<article class="pcard" data-reveal><b class="pcard__big">${esc(big)}</b><h3>${esc(t)}</h3><p>${esc(d)}</p></article>`).join("")}</div>
  </div>
</section>

<section class="section" id="save" aria-label="Сохранить или восстановить"><div class="wrap chapters">
  ${[save, restore].map((b, i) => `<article class="chapter${i ? " chapter--flip" : ""}">
    <figure class="chapter__img" data-ph data-clip data-parallax>${img(b.img, b.imgAlt, depth)}</figure>
    <div class="chapter__text">
      <span class="label">${esc(b.label)}</span>
      <h2 data-split>${esc(b.title)}</h2>
      ${b.sub ? `<p class="chapter__sub" data-reveal>${esc(b.sub)}</p>` : ""}
      <p class="chapter__p" data-reveal>${esc(b.text)}</p>
      ${checks(b.facts, "", " data-reveal")}
      ${b.quote ? `<blockquote class="quote" data-reveal>«${esc(b.quote)}»<cite>из отзыва пациента</cite></blockquote>` : ""}
      ${ctaBox(b.offer, act(b.btn[0], b.btn[1], p, { cls: "btn--lg", reason: b.btn[2] }), `<a class="link" href="uslugi/${b.link[1]}.html">${esc(b.link[0])}</a>`, b.note)}
    </div>
  </article>`).join("")}
</div></section>

<section class="section section--dark on-dark allon" id="allon" aria-labelledby="ao-title"><div class="wrap allon__in">
  <div class="allon__text">
    <span class="label">All-on-4</span>
    <h2 id="ao-title" data-split>${esc(allon.title)}</h2>
    <p data-reveal>${esc(allon.text)}</p>
    <p class="allon__compare" data-reveal>${esc(allon.compare)}</p>
    ${ctaBox(allon.offer, act("Получить расчёт для своего случая", "allon", p, { cls: "btn--light btn--lg" }), `<a class="link" href="uslugi/all-on-4.html">Подробнее об All-on-4</a>`, allon.note)}
  </div>
  <div class="calc allon__calc" data-reveal data-calc='${JSON.stringify({ systems: allon.systems, temp: allon.temp, perm: allon.perm })}'>
    <div class="calc__opts">
      <div class="calc__group"><span class="calc__label" id="calc-sys">Система имплантов</span><div class="seg" role="group" aria-labelledby="calc-sys">${allon.systems.map(([n], i) => `<button type="button" data-sys="${i}" aria-pressed="${i === 0}">${n}</button>`).join("")}</div></div>
      <div class="calc__group"><span class="calc__label" id="calc-jaws">Сколько челюстей</span><div class="seg" role="group" aria-labelledby="calc-jaws">${["Одна челюсть", "Обе челюсти"].map((t, i) => `<button type="button" data-jaws="${i + 1}" aria-pressed="${i === 0}">${t}</button>`).join("")}</div></div>
    </div>
    <ul class="calc__rows">
      <li><span>Хирургический этап</span><b><i data-c="surg">${rub(sys0[1])}</i>${sys0[2] ? ` <s data-c="old">${rub(sys0[2])}</s>` : ""}</b></li>
      <li><span>Временный протез на имплантах</span><b>от <i data-c="temp">${rub(allon.temp)}</i></b></li>
      <li><span>Постоянный протез</span><b>от <i data-c="perm">${rub(allon.perm)}</i></b></li>
    </ul>
    <div class="calc__total" aria-live="polite"><span>Весь путь</span><b>от <i data-c="total">${rub(total0).replace(/\u00a0₽$/, "")}</i>&nbsp;₽</b></div>
    <p class="calc__pay">Оплата по этапам: в день операции от <i data-c="day">${rub(sys0[1] + allon.temp)}</i> (хирургия и временные зубы), через 4–6 месяцев от <i data-c="later">${rub(allon.perm)}</i> (постоянный протез). Есть рассрочка и кредит, скидка 10% при оплате в день консультации.</p>
    <p class="calc__six">${esc(allon.six)}</p>
  </div>
</div></section>

<section class="section section--sage" id="quiz" aria-labelledby="qz-title"><div class="wrap quiz-wrap">
  <div class="quiz-wrap__head"><span class="label">Расчёт</span><h2 id="qz-title" data-split>${esc(quiz.title)}</h2><p data-reveal>${esc(quiz.sub)}</p></div>
  <div class="quiz" data-reveal>
    <div class="quiz__bar" aria-hidden="true"><i></i></div>
    <form class="quiz__form lead" data-lead="quiz" data-quiz>
      <fieldset class="quiz__step" data-step="0"><legend>${esc(quiz.first[0])}</legend><div class="quiz__opts">${quiz.first[1].map(([t, price]) => `<label class="qopt"><input type="radio" name="q0" value="${esc(t)}" data-price="${esc(price)}"><i aria-hidden="true"></i><span>${esc(t)}</span></label>`).join("")}</div></fieldset>
      ${quiz.rest.map(([q, opts], i) => `<fieldset class="quiz__step" data-step="${i + 1}" hidden><legend>${esc(q)}</legend><div class="quiz__opts">${opts.map((t) => `<label class="qopt"><input type="radio" name="q${i + 1}" value="${esc(t)}"><i aria-hidden="true"></i><span>${esc(t)}</span></label>`).join("")}</div><div class="quiz__nav"><button class="btn btn--ghost btn--sm" type="button" data-qback>Назад</button></div></fieldset>`).join("")}
      <fieldset class="quiz__step" data-step="${quiz.rest.length + 1}" hidden><legend>Куда прислать план и цену?</legend>
        <div class="quiz__contact">
          <label class="field">Имя<input name="name" autocomplete="given-name"></label>
          <label class="field">Телефон<input name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="+7 ___ ___-__-__" data-req></label>
          <label class="file">Снимок, если есть<input name="file" type="file" accept="image/*,.pdf,.zip,.dcm"><span>${icon.file}<em>Приложить файл</em></span></label>
        </div>
        <div class="quiz__nav"><button class="btn btn--ghost btn--sm" type="button" data-qback>Назад</button><button class="btn btn--lg">Получить план и цену</button></div>
        <p class="cta-box__note">Перезвоним за 5 минут. Отправляя заявку, вы соглашаетесь на обработку персональных данных.</p>
      </fieldset>
    </form>
    <div class="quiz__done" hidden>
      <div class="quiz__ok">${icon.check}</div>
      <h3>Готово. Перезвоним за 5 минут.</h3>
      <p>Предварительно по вашему случаю:</p>
      <p class="quiz__price" data-qprice></p>
      <p class="cta-box__note">${esc(quiz.discount)}</p>
    </div>
  </div>
</div></section>

<section class="section" id="kids" aria-labelledby="kd-title"><div class="wrap kids">
  <figure class="kids__doc">
    <a class="kids__circle circle" href="vrachi/${kidsDoc.id}.html" data-ph data-clip data-parallax>${img(docPhoto(kidsDoc), kidsDoc.name, depth)}</a>
    <figcaption><a href="vrachi/${kidsDoc.id}.html">${esc(kidsDoc.short)}</a><span>${esc(kidsDoc.title)}</span></figcaption>
  </figure>
  <div class="kids__text">
    <span class="label">Детям</span>
    <h2 id="kd-title" data-split>${esc(kids.title)}</h2>
    <p class="chapter__sub" data-reveal>${esc(kids.sub)}</p>
    <p class="chapter__p" data-reveal>${esc(kids.text)}</p>
    ${checks(kids.facts, "", " data-reveal")}
    <blockquote class="quote" data-reveal>«${esc(kids.quote[0])}»<cite>${esc(kids.quote[1])}</cite></blockquote>
    ${ctaBox(kids.offer, act("Записать ребёнка", "book", p, { cls: "btn--lg", reason: "Ребёнок" }), `<a class="link" href="uslugi/detskaya.html">Детская стоматология</a>`, kids.note)}
  </div>
</div></section>

<section class="section section--sage" id="team" aria-labelledby="tm-title"><div class="wrap">
  <div class="section__head"><div><span class="label">Врачи</span><h2 id="tm-title" data-split>Кто будет вас лечить</h2></div><p>${esc(home.team.intro)}</p></div>
  <div class="chips team__tabs" role="tablist" data-tabs="team">
    ${[["", "Все"], ["lechenie-zubov", "Терапия"], ["implantaciya", "Хирургия и имплантация"], ["protezirovanie", "Ортопедия"], ["ortodontiya", "Ортодонтия"], ["detskaya", "Детям"]].map(([v, t], i) => `<button class="chip" type="button" role="tab" data-tab="${v}" aria-selected="${i === 0}">${t}</button>`).join("")}
  </div>
  <div class="team__grid team__grid--scroll">${doctors.map((d) => doctorCard(d, depth)).join("")}</div>
  <div class="strip" data-reveal><p>${esc(home.team.more)}</p>${act("Перезвоните мне", "call", p, { cls: "btn--ghost" })}</div>
</div></section>

<section class="section reviews" id="reviews" aria-labelledby="rv-title"><div class="wrap">
  <div class="section__head"><div><span class="label">Отзывы</span><h2 id="rv-title" data-split>Что пишут пациенты</h2></div></div>
  <div class="rt on-dark" aria-label="Оценки клиники на площадках" data-reveal>
    <div class="rt-pd">
      <a class="rt-seal" href="${pdR.url}"${ext} data-goal="reviews_prodoctorov" aria-label="Рейтинг ${pdR.value} на ПроДокторов, ${esc(pdR.count)}">
        <span class="rt-seal__in"><span class="rt-seal__num">${pdR.value}</span><span class="rt-seal__stars" aria-hidden="true">${stars}</span><span class="rt-seal__cap">${esc(pdR.count)}<br>на сайте</span><span class="pd-word" aria-hidden="true"><b>про</b><span>докторов</span></span></span>
      </a>
      <div class="rt-pd__text">
        <p class="rt-pd__quote">${esc(rating.pdText)}</p>
        <a class="btn btn--light rt-btn" href="${pdR.url}"${ext} data-goal="reviews_prodoctorov">Читать отзывы на ПроДокторов</a>
      </div>
    </div>
    <div class="rt-side">
      <div class="rt-avg">
        <div class="rt-avg__num">${rating.avg}</div>
        <div><div class="rt-stars" role="img" aria-label="5 из 5">${stars}</div><p class="rt-avg__cap">${esc(rating.avgCap)}</p></div>
      </div>
      <div class="rt-sites">
        ${site("ya", "Я", yaR, "reviews_yandex")}
        ${site("2gis", "2ГИС", gisR, "reviews_2gis")}
      </div>
    </div>
  </div>
  <div class="rv-cols">${cols.map((c) => `<div class="rv-col">${c.map(([q, j], k) => `<figure class="rv${tone(j)}"${k >= 3 ? " data-extra hidden" : " data-reveal"}><blockquote>«${esc(q)}»</blockquote></figure>`).join("")}</div>`).join("")}</div>
  <div class="rv-more"><button class="btn btn--ghost" type="button" data-rv-more aria-expanded="false">Показать все отзывы</button></div>
  ${ctaBox("", act("Записаться на бесплатную консультацию", "book", p, { cls: "btn--lg" }), "", "Перезвоним за 5 минут.")}
</div></section>

<section class="tour on-dark" id="clinic" aria-labelledby="tr-title">
  <div class="tour__pin">
    <div class="tour__frame">${img(pics.tourFrame, "Лечебный кабинет стоматологии «Умная Медицина»", depth)}</div>
    <div class="tour__title wrap"><span class="label label--light">Клиника изнутри</span><h2 id="tr-title" data-split>Здесь вас ждут</h2><p>Лечебные кабинеты, 3D-томограф Vatech, панорамный рентген и стерилизационная. ${esc(home.tour)}</p><a class="btn btn--light" href="https://yandex.ru/maps/?rtext=~${clinic.geo.lat},${clinic.geo.lon}"${ext}>Построить маршрут</a></div>
  </div>
  <div class="wrap tour__grid">${pics.tour.map(([f, c]) => `<figure class="tour__ph" data-ph data-reveal>${img([f], c, depth)}<figcaption>${esc(c)}</figcaption></figure>`).join("")}</div>
</section>

<section class="section section--sage" id="pricing" aria-labelledby="pr-title"><div class="wrap">
  <div class="section__head"><div><span class="label">Цены</span><h2 id="pr-title" data-split>Цены до того, как вы сели в кресло</h2></div><p>Цены на 15.10.2026 из прайса клиники. Точную сумму врач запишет в план лечения, и она попадёт в договор.</p></div>
  <div class="pricing">
    <aside class="offers on-dark" data-reveal aria-label="Акции">
      ${offers.map((o, i) => `<details class="offer-item"${i ? "" : " open"}>
        <summary><span class="offer-item__tag">${esc(o.tag)}</span><span class="offer-item__title">${esc(o.title)}</span>${o.price ? `<span class="offer-item__price">${esc(o.price)}${o.old ? `<s>${esc(o.old)}</s>` : ""}</span>` : ""}</summary>
        <div class="offer-item__body"><div class="offer-item__in">${checks(o.items)}${act(o.btn, o.act, p, { cls: "btn--light btn--sm", reason: o.reason })}</div></div>
      </details>`).join("")}
    </aside>
    <div class="pricing__main">
      <div class="ptabs" role="tablist" data-tabs="price">${priceTabs.map(([t], i) => `<button class="chip" type="button" role="tab" data-tab="p${i}" aria-selected="${i === 0}">${esc(t)}</button>`).join("")}</div>
      ${priceTabs.map(([, keys], i) => `<div class="ppanel" data-panel="price" data-key="p${i}"${i ? " hidden" : ""}>${plist(keys, 9)}</div>`).join("")}
      <div class="pricing__foot"><p>${esc(home.priceFoot)}</p><div class="cta-box__row">${act("Получить план с ценой", "book", p)}<a class="link" href="ceny.html">Весь прайс</a></div></div>
    </div>
  </div>
</div></section>

<section class="section" id="faq" aria-labelledby="fq-title"><div class="wrap">
  <div class="section__head"><div><span class="label">Вопросы</span><h2 id="fq-title" data-split>Что спрашивают перед первым визитом</h2></div></div>
  ${faqBlock(home.faq)}
  <div class="strip" data-reveal><p>${esc(home.faqMore)}</p><div class="cta-box__row">${act("Написать", "write", p)}${act("Перезвоните мне", "call", p, { cls: "btn--ghost" })}</div></div>
</div></section>

${place()}
</main>` + footer(depth) + end;
}

// ---------- страница услуги ----------
function pageService(s) {
  const depth = 1;
  const docs = doctors.filter((d) => d.tags.includes(s.slug));
  const rest = homeOrder.filter((k) => k !== s.slug);
  const body = s.about || [s.lead];
  // разделы под первым экраном чередуют фон: бумага, шалфей, бумага…
  const bg = (i) => (i % 2 ? " section--sage" : "");
  let n = 0;
  return head({ title: s.seoTitle, desc: s.seoDesc, canonical: `/uslugi/${s.slug}`, depth, jsonld: [crumbsLd([["uslugi/" + s.slug, s.title]]), faqLd(s.faq), { "@context": "https://schema.org", "@type": "MedicalProcedure", name: s.title, description: s.seoDesc }] })
  + header(depth) + `
<main id="main">
<section class="page-hero on-dark">
  <div class="foil__bg" aria-hidden="true"></div>
  <div class="wrap page-hero__in">
    <div>
      <nav class="crumbs" aria-label="Хлебные крошки" data-in><a href="../index.html">Главная</a><a href="../index.html#services">Услуги</a><span aria-current="page">${esc(s.title)}</span></nav>
      <h1 data-split>${esc(s.h1)}</h1>
      <p class="page-hero__lead" data-in>${esc(s.lead)}</p>
    </div>
    <div class="page-hero__aside" data-in>
      <span class="label label--light">Стоимость</span>
      <span class="page-hero__price${/\d/.test(s.from) ? "" : " page-hero__price--text"}">${esc(s.from)}</span>
      ${act("Записаться на консультацию", "book", "../", { cls: "btn--lg", service: s.slug })}
    </div>
  </div>
</section>

<section class="section${bg(n++)}"><div class="wrap split">
  <div class="split__img" data-ph data-clip data-parallax>${img(pics.svc[s.slug], s.title, depth)}${ph(s.title)}</div>
  <div class="split__text">
    <span class="label">О лечении</span>
    <div class="prose">${body.map((t) => `<p data-reveal>${esc(t)}</p>`).join("")}</div>
    ${checks(s.points, "checks--two points", " data-reveal")}
  </div>
</div></section>

<section class="section${bg(n++)}"><div class="wrap">
  <div class="section__head"><div><span class="label">Этапы</span><h2 data-split>Как проходит лечение</h2></div></div>
  <ol class="steps">${s.steps.map((t) => `<li data-reveal><p>${esc(t)}</p></li>`).join("")}</ol>
</div></section>

<section class="section${bg(n++)}" id="prices"><div class="wrap">
  <div class="section__head"><div><span class="label">Цены</span><h2 data-split>Стоимость</h2></div><a class="link" href="../ceny.html">Весь прайс</a></div>
  <div class="ptables${s.prices.length === 1 ? " ptables--one" : ""}">${s.prices.map((k) => `<div class="ptable" data-reveal><h3>${esc(prices[k].title)}</h3>${plist([k])}</div>`).join("")}</div>
  <p class="note ptables__note">Цены на 15.10.2026. Точную стоимость врач называет после осмотра.</p>
</div></section>

${docs.length ? `<section class="section${bg(n++)}"><div class="wrap">
  <div class="section__head"><div><span class="label">Врачи</span><h2 data-split>Кто лечит</h2></div></div>
  <div class="team__grid${docs.length < 4 ? " team__grid--few" : " team__grid--scroll"}">${docs.map((d) => doctorCard(d, depth)).join("")}${docs.length % (docs.length < 4 ? 2 : 4) ? doctorMore(depth) : ""}</div>
</div></section>` : ""}

<section class="section${bg(n++)}"><div class="wrap">
  ${faqBlock([["Вопросы", s.faq]])}
</div></section>

<section class="section${bg(n++)}"><div class="wrap">
  <div class="section__head"><div><span class="label">Ещё услуги</span><h2 data-split>Другие направления</h2></div></div>
  ${svcRows(rest, depth)}
</div></section>
</main>` + footer(depth) + end;
}

// ---------- страница врача ----------
function pageDoctor(d) {
  const depth = 1;
  const [last, ...given] = d.name.split(" ");
  const svcs = homeOrder.filter((k) => d.tags.includes(k));
  const others = doctors.filter((x) => x.id !== d.id);
  const kind = (t) => (t.startsWith("Ординатура") ? "Ординатура" : t.startsWith("Повышение") ? "Квалификация" : "Образование");
  const timeline = [
    ...d.edu.map(([y, place, t]) => ({ y, sort: +y, kind: kind(t), t: cap(t.replace(/^(Ординатура|Повышение квалификации): /, "")), place })),
    ...d.work.map(([y, place, t]) => ({ y, sort: parseInt(y, 10), kind: "Работа", t, place })),
  ].sort((a, b) => a.sort - b.sort);
  const desc = `${d.name}, ${d.title.toLowerCase()} стоматологии «Умная Медицина» в Удельной (Жуковский).${d.exp ? ` Стаж ${d.exp} лет.` : ""} Образование, курсы, запись на приём.`;
  const ld = { "@context": "https://schema.org", "@type": "Person", name: d.name, jobTitle: d.title, worksFor: { "@type": "Dentist", name: clinic.name }, url: `${SITE}/vrachi/${d.id}` };
  return head({ title: `${d.name} — ${d.title.toLowerCase()} | Умная Медицина`, desc, canonical: `/vrachi/${d.id}`, depth, jsonld: [crumbsLd([["index.html#team", "Врачи"], ["vrachi/" + d.id, d.short]]), ld] })
  + header(depth) + `
<main id="main">
<section class="page-hero doc-hero on-dark">
  <div class="foil__bg" aria-hidden="true"></div>
  <div class="wrap doc-hero__in">
    <div class="doc-hero__text">
      <nav class="crumbs" aria-label="Хлебные крошки" data-in><a href="../index.html">Главная</a><a href="../index.html#team">Врачи</a><span aria-current="page">${esc(d.short)}</span></nav>
      <span class="label label--light doc-hero__role" data-in>${esc(d.title)}</span>
      <h1><span data-split>${esc(last)}</span> <span data-split>${esc(given.join(" "))}</span></h1>
      ${d.exp || d.courses.length ? `<ul class="doc-hero__facts" data-in>
        ${d.exp ? `<li><b data-count="${d.exp}">${d.exp}</b><span>${plural(d.exp, "год", "года", "лет")} стажа</span></li>` : ""}
        ${d.courses.length ? `<li><b data-count="${d.courses.length}">${d.courses.length}</b><span>${plural(d.courses.length, "курс", "курса", "курсов")} повышения<br>квалификации</span></li>` : ""}
        ${d.rating ? `<li><b>${d.rating}</b><span>на ПроДокторов,<br>${reviewsText(d.reviews)}</span></li>` : ""}
      </ul>` : ""}
      <div class="doc-hero__cta" data-in>
        ${act("Записаться к врачу", "book", "../", { cls: "btn--lg", doctor: d.id })}
      </div>
    </div>
    <figure class="doc-hero__photo" data-ph data-clip data-parallax><span class="doc__initials" aria-hidden="true">${initialsOf(d)}</span>${img(docPhoto(d), d.name, depth, { eager: true })}</figure>
  </div>
</section>

<section class="section"><div class="wrap doc-about">
  <div>
    <span class="label">Специализация</span>
    <ul class="doc-specs">${d.specs.map((t) => `<li data-reveal>${esc(t)}</li>`).join("")}</ul>
  </div>
  <div>
    <span class="label">Чем занимается в клинике</span>
    <div class="doc-about__svcs">${svcRows(svcs, depth)}</div>
  </div>
</div></section>

${timeline.length ? `<section class="section section--dark on-dark"><div class="wrap">
  <div class="section__head"><div><span class="label">Образование и опыт</span><h2 data-split>Путь врача</h2></div><p>По анкете врача на ПроДокторов, где документы проверены сервисом.</p></div>
  <ol class="doc-path">${timeline.map((r) => `<li data-reveal><span class="doc-path__y">${esc(r.y)}</span><span class="doc-path__k">${esc(r.kind)}</span><div><b>${esc(r.t)}</b><span>${esc(r.place)}</span></div></li>`).join("")}</ol>
</div></section>` : `<section class="section section--sage"><div class="wrap doc-empty" data-reveal>
  <span class="label">Образование и опыт</span>
  <p>Сведения об образовании и стаже врача клиника пока не опубликовала. Их можно уточнить у администратора: <a href="${clinic.phoneHref}">${esc(clinic.phone)}</a>.</p>
</div></section>`}

${d.courses.length ? `<section class="section section--sage"><div class="wrap">
  <div class="section__head"><div><span class="label">Повышение квалификации</span><h2 data-split>Курсы и конгрессы</h2></div></div>
  <div class="doc-courses">${d.courses.map(([y, t]) => `<div class="doc-course" data-reveal><span class="doc-course__y">${esc(y)}</span><p>${esc(t)}</p></div>`).join("")}</div>
</div></section>` : ""}

<section class="section${d.courses.length || !timeline.length ? "" : " section--sage"}"><div class="wrap">
  <div class="section__head"><div><span class="label">Команда</span><h2 data-split>Другие врачи</h2></div></div>
  <div class="team__grid team__grid--scroll">${others.map((x) => doctorCard(x, depth)).join("")}${others.length % 4 ? doctorMore(depth) : ""}</div>
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
<section class="page-hero on-dark"><div class="foil__bg" aria-hidden="true"></div><div class="wrap page-hero__in">
  <div><nav class="crumbs" aria-label="Хлебные крошки" data-in><a href="index.html">Главная</a><span aria-current="page">Цены</span></nav><h1 data-split>Прайс-лист</h1><p class="page-hero__lead" data-in>Цены на 15.10.2026. Итоговую стоимость врач называет после осмотра и записывает в план лечения.</p></div>
  <div class="page-hero__aside" data-in>${act("Записаться на консультацию", "book", "", { cls: "btn--lg" })}</div>
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
    services: homeOrder.map((k) => ({ slug: k, title: svc[k].title, short: svc[k].short, from: nb(svc[k].from) })),
    doctors: doctors.map((d) => ({ id: d.id, short: d.short, role: d.role, tags: d.tags, photo: pick(docPhoto(d), 0).src || null, initials: initialsOf(d) })),
  };
  const bar = (n) => `<div class="bsteps" aria-hidden="true">${[0, 1, 2, 3].map((i) => `<span${i < n ? ' class="is-done"' : ""}><i></i></span>`).join("")}</div>`;
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
        <p>Выберите услугу, врача и удобное время, а администратор подтвердит запись. Консультация с планом лечения бесплатная.</p>
        <button class="btn btn--lg" type="button" data-start>Перейти к записи</button>
      </section>
      <section class="bstep" data-step="1" hidden>
        ${bar(0)}
        <h2 tabindex="-1">Что нужно сделать?</h2>
        <div class="opts" id="b-services"></div>
      </section>
      <section class="bstep" data-step="2" hidden>
        ${bar(1)}
        <h2 tabindex="-1">К какому врачу?</h2>
        <div class="opts" id="b-doctors"></div>
        <div class="bnav"><button class="btn btn--ghost btn--sm" type="button" data-back>Назад</button></div>
      </section>
      <section class="bstep" data-step="3" hidden>
        ${bar(2)}
        <h2 tabindex="-1">Когда удобно?</h2>
        <div class="days" id="b-days"></div>
        <div class="slots" id="b-slots"></div>
        <p class="note bnote">Пример расписания. В рабочей версии здесь живые окна врачей из МИС клиники.</p>
        <div class="bnav"><button class="btn btn--ghost btn--sm" type="button" data-back>Назад</button><button class="btn btn--sm" type="button" data-next-time disabled>Дальше</button></div>
      </section>
      <section class="bstep" data-step="4" hidden>
        ${bar(3)}
        <h2 tabindex="-1">Как с вами связаться?</h2>
        <form class="form" id="b-form">
          <label class="field">Имя<input name="name" required autocomplete="name"></label>
          <label class="field">Телефон<input name="phone" type="tel" required autocomplete="tel" placeholder="+7 ___ ___-__-__"></label>
          <label class="field">Комментарий<textarea name="comment" placeholder="Например, болит зуб слева внизу"></textarea></label>
          <label class="check"><input type="checkbox" required> Согласен на обработку персональных данных</label>
          <div class="bnav"><button class="btn btn--ghost btn--sm" type="button" data-back>Назад</button><button class="btn">Записаться</button></div>
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
    <p class="note">Есть вопросы? Позвоните: <a href="${clinic.phoneHref}">${esc(clinic.phone)}</a>, ежедневно с 9:00 до 21:00.</p>
  </aside>
</div>
<script type="application/json" id="bdata">${JSON.stringify(bdata).replace(/</g, "\\u003c")}</script>` + end;
}

// ---------- сборка ----------
rmSync(dist, { recursive: true, force: true });
mkdirSync(path.join(dist, "uslugi"), { recursive: true });
mkdirSync(path.join(dist, "vrachi"), { recursive: true });
mkdirSync(path.join(dist, "assets", "vendor"), { recursive: true });
const out = (f, html) => writeFileSync(path.join(dist, f), html);
out("index.html", pageHome());
out("ceny.html", pagePrices());
out("zapis.html", pageBooking());
for (const s of services) out(`uslugi/${s.slug}.html`, pageService(s));
for (const d of doctors) out(`vrachi/${d.id}.html`, pageDoctor(d));
for (const f of readdirSync(path.join(root, "src", "assets"))) copyFileSync(path.join(root, "src", "assets", f), path.join(dist, "assets", f));
const nm = (p) => path.join(root, "node_modules", p);
copyFileSync(nm("gsap/dist/gsap.min.js"), path.join(dist, "assets/vendor/gsap.min.js"));
copyFileSync(nm("gsap/dist/ScrollTrigger.min.js"), path.join(dist, "assets/vendor/ScrollTrigger.min.js"));
copyFileSync(nm("lenis/dist/lenis.min.js"), path.join(dist, "assets/vendor/lenis.min.js"));
if (existsSync(path.join(root, "src", "images"))) cpSync(path.join(root, "src", "images"), path.join(dist, "images"), { recursive: true });
out("robots.txt", "User-agent: *\nDisallow: /\n");
out(".nojekyll", "");
out("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${["/", "/ceny", "/zapis", ...services.map((s) => `/uslugi/${s.slug}`), ...doctors.map((d) => `/vrachi/${d.id}`)].map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>2026-10-15</lastmod></url>`).join("\n")}\n</urlset>\n`);
console.log("Собрано страниц:", 3 + services.length + doctors.length, "→", dist);
