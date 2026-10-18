#!/usr/bin/env node
// Сборка макета, вариант 2: главная по логике trydentspb.ru (9 блоков) в дизайне и механике Lava Dental + страницы услуг, прайс и онлайн-запись.
// Каждая страница отдаётся готовым HTML (важно для SEO). Запуск: npm run build → dist/
import { mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync, readdirSync, existsSync, cpSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { transformSync } from "esbuild";
import { fileURLToPath } from "node:url";
import { clinic, doctors, prices, services, brand, pics, homeOrder, home, v2 } from "../src/data.mjs";
import { reviewsMobile } from "./reviews-mobile.mjs";
import { servicePages, servicePriceDate, servicePriceHold } from "../src/service-pages.mjs";
import { parseServiceMd } from "./service-md.mjs";
import { doctorPages } from "../src/doctor-pages.mjs";
import { doctorReviews } from "../src/doctor-reviews.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
// метка версии у стилей и скриптов: после выкладки браузер берёт новые файлы, а не старые из кэша
// Стили (шрифты, основные, отзывы на телефоне) идут одним файлом, стили и скрипты сжаты; исходники в src/assets остаются читаемыми
const hash = (t) => createHash("md5").update(t).digest("hex").slice(0, 8);
const srcAsset = (f) => readFileSync(path.join(root, "src/assets", f), "utf8");
const assets = {
  "styles.css": transformSync(["fonts.css", "styles.css", "rvm.css"].map(srcAsset).join("\n"), { loader: "css", minify: true }).code,
  "app.js": transformSync(srcAsset("app.js"), { loader: "js", minify: true }).code,
  "rvm.js": transformSync(srcAsset("rvm.js"), { loader: "js", minify: true }).code,
};
const V = { css: hash(assets["styles.css"]), app: hash(assets["app.js"]), rvm: hash(assets["rvm.js"]) };
// шрифты лежат на сайте (без Google Fonts): первыми грузим кириллицу и латиницу (цифры, знаки) текста и заголовков
const fontPreload = ["golos-text-cyrillic", "golos-text-latin", "manrope-cyrillic", "manrope-latin"];
const SITE = process.env.SITE_URL || "https://umnaya-stomatologiya.ru"; // домен-пример для canonical и разметки
// PUBLISH=1 SITE_URL=https://… npm run build — сборка для боевого домена: страницы открыты поисковикам, robots.txt
// с картой сайта, без полосы «демонстрационный макет». По умолчанию собирается демо: noindex и полоса сверху
const PUBLISH = process.env.PUBLISH === "1";
if (PUBLISH && !process.env.SITE_URL) throw new Error("PUBLISH=1 собирается только с SITE_URL боевого домена");
// один постоянный @id клиники: на него ссылаются разметка главной и подвал на всех страницах
const CLINIC_ID = `${SITE}/#clinic`;
// картинка для превью ссылок (Telegram, VK, мессенджеры): ресепшен с вывеской, 1200×630, её делает сборка из old-9
const OG_IMAGE = "images/og/clinic.jpg";
const OG_FROM = "images/old/old-9.jpg";

// неразрывные пробелы в ценах и номерах: «КТ от 2 000 ₽» не переносится по частям
const nb = (t) => t.replace(/(\d) (?=\d{3}(?!\d))/g, "$1\u00a0").replace(/ ₽/g, "\u00a0₽").replace(/(^|\s)(от|до) (?=\d)/g, "$1$2\u00a0");
const esc = (s) => nb(String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"));
const rub = (n) => n.toLocaleString("ru-RU").replace(/\s/g, " ") + " ₽";
const priceText = (p) => {
  if (p === 0) return "Бесплатно";
  if (typeof p === "number") return rub(p);
  const m = /^от (\d+)$/.exec(p);
  return m ? "от " + rub(Number(m[1])) : p;
};
const svc = Object.fromEntries(services.map((s) => [s.slug, s]));
// услуги нового формата живут по своим адресам (implantaciya/, implantaciya/all-on-4/), остальные пока на uslugi/<slug>.html
const spBySlug = Object.fromEntries(servicePages.map((x) => [x.old || x.slug, x]));
const svcHref = (k, p) => (spBySlug[k] ? p + spBySlug[k].path : `${p}uslugi/${k}.html`);
const pre = (depth) => "../".repeat(depth);
// врач с новой страницей живёт по адресу vrachi/<id>/, остальные пока на vrachi/<id>.html
const docHref = (id, p) => (doctorPages[id] ? `${p}vrachi/${id}/` : `${p}vrachi/${id}.html`);

// ---------- картинки: локальный файл, если он есть, иначе запасной адрес ----------
// Фото (jpg, png) уходят на сайт в WebP того же размера: на 40–60% легче, на вид то же. Без sharp (не сделан npm install)
// остаются как есть. Значки, показанные мелко, ужимаются до размера для экранов x3
const local = (rel) => rel && existsSync(path.join(root, "src", rel));
let sharp = null;
try { sharp = (await import("sharp")).default; } catch { console.warn("sharp не установлен (npm install): фото идут без перевода в WebP"); }
const RASTER = /\.(jpe?g|png)$/i;
const shrink = { "images/brand/2gis.png": 160 };
const webpJobs = new Map();
const asWebp = (rel) => {
  if (!sharp || !RASTER.test(rel)) return rel;
  const out = rel.replace(RASTER, ".webp");
  if (webpJobs.has(out) && webpJobs.get(out).from !== rel) throw new Error(`${rel} и ${webpJobs.get(out).from} дают один ${out}`);
  webpJobs.set(out, { from: rel, width: shrink[rel] });
  return out;
};
function pick(entry, depth) {
  const ok = entry.filter(Boolean).filter((u) => /^https?:/.test(u) || local(u));
  const c = ok.map((u) => (/^https?:/.test(u) ? u : pre(depth) + asWebp(u)));
  return { src: c[0] || "", fb: c[1] || "", rel: ok[0] && !/^https?:/.test(ok[0]) ? ok[0] : "" };
}
// уменьшенные копии крупных фото для srcset: телефон берёт 480 или 828 px вместо исходных 1440–1800
const natW = {};
if (sharp) {
  const walkImg = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walkImg(path.join(d, e.name)) : [path.join(d, e.name)]));
  await Promise.all(walkImg(path.join(root, "src", "images")).filter((f) => RASTER.test(f)).map(async (f) => { natW[path.relative(path.join(root, "src"), f).split(path.sep).join("/")] = (await sharp(f).metadata()).width; }));
}
const SRCSET_W = [480, 828, 1200];
function srcset(rel, depth) {
  const W = natW[rel];
  if (!W || shrink[rel] || W < 700) return "";
  const ws = SRCSET_W.filter((w) => w < W * 0.85);
  if (!ws.length) return "";
  const p = pre(depth);
  return [...ws.map((w) => {
    const out = rel.replace(RASTER, `-${w}w.webp`);
    webpJobs.set(out, { from: rel, width: w });
    return `${p}${out} ${w}w`;
  }), `${p}${asWebp(rel)} ${W}w`].join(", ");
}
// sizes: «auto» — ширина по вёрстке для ленивых картинок (Chrome, Android); второе значение — для остальных браузеров
const img = (entry, alt, depth, attrs = "", sizes = "auto, 100vw") => {
  const { src, fb, rel } = pick(entry, depth);
  if (!src) return "";
  const set = rel ? srcset(rel, depth) : "";
  return `<img src="${src}"${set ? ` srcset="${set}" sizes="${sizes}"` : ""}${fb ? ` data-fb="${fb}"` : ""} alt="${esc(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="umImg(this)"${attrs}>`;
};
const ph = (text = "Фото клиники") => `<span class="ph">${esc(text)}</span>`;
const logoImg = (depth, eager = true) => {
  const { src, fb } = pick(brand.logo, depth);
  return `<img class="logo__img" src="${src}"${fb ? ` data-fb="${fb}"` : ""} alt=""${eager ? "" : ' loading="lazy"'} referrerpolicy="no-referrer" onerror="umLogo(this)">`;
};

// в шапке телефона и компьютера светлая надпись логотипа (шапка там прозрачная с тёмной дымкой, как у Лава Дент);
// в меню телефона логотип одним тёмным цветом на шалфейном фоне, как у Лава Дент
const phoneLogo = (depth, eager = true, file = "header-logo-light.svg", desk = false) => `<picture><source media="(max-width: 760px) and (forced-colors: none)${desk ? ", (min-width: 1025px) and (forced-colors: none)" : ""}" srcset="${pre(depth)}images/brand/${file}">${logoImg(depth, eager)}</picture>`;

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
// меню сайта, как у Тридента: «Услуги» раскрываются списком направлений, остальное разделы и страницы
const menuItems = (p, href) => [["Цены", `${p}ceny.html`], ["Акции", href("akcii")], ["Врачи", href("team").startsWith("#") ? "#team" : `${p}vrachi.html`], ["О клинике", href("clinic")], ["Отзывы", href("reviews")], ["Контакты", href("contacts")]];
// шапка компьютера как у Лава Дент: под каждым разделом отрезок линии, он заполняется, пока этот раздел проходит
// по экрану (CSS view-timeline блока). «Цены» отдельной страницей, поэтому блок услуг с ценами «от» делят пополам «Услуги» и «Цены»
const navLine = {
  "Услуги": "animation-timeline:--tl-services;animation-range:entry-crossing 0% entry-crossing 50%",
  "Цены": "animation-timeline:--tl-services;animation-range:entry-crossing 50% entry-crossing 100%",
  "О клинике": "animation-timeline:--tl-clinic", "Акции": "animation-timeline:--tl-akcii", "Врачи": "animation-timeline:--tl-team", "Отзывы": "animation-timeline:--tl-reviews",
  "Вопросы": "animation-timeline:--tl-faq", "Контакты": "animation-timeline:--tl-contacts",
};
// меню телефона и шапка компьютера как у Лава Дент: разделы в порядке страницы (Ilya 17.10: после слогана клиника и «5 минут, 0 ₽, 3 врача», потом услуги), «Цены» рядом с услугами
const phoneMenuItems = (p, href) => [["О клинике", href("clinic")], ["Услуги", href("services"), "uslugi implantaciya protezirovanie"], ["Цены", `${p}ceny.html`], ["Акции", href("akcii")], ["Врачи", href("team").startsWith("#") ? "#team" : `${p}vrachi.html`, "vrachi"], ["Отзывы", href("reviews")], ["Вопросы", href("faq")], ["Контакты", href("contacts")]];

function head({ title, desc, canonical, depth, page = "inner", jsonld = [] }) {
  const p = pre(depth);
  return `<!doctype html>
<html lang="ru" data-page="${page}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${PUBLISH ? "index, follow" : "noindex, nofollow"}">
<link rel="canonical" href="${SITE}${canonical}">
<link rel="icon" type="image/svg+xml" href="${p}images/brand/favicon.svg">
<meta property="og:type" content="${/^\/vrachi\/[^/]+\/?$/.test(canonical) ? "profile" : "website"}">
<meta property="og:site_name" content="Умная Медицина. Стоматология">
<meta property="og:url" content="${SITE}${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE}/${OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Ресепшен стоматологии «Умная Медицина» в Удельной">
<meta property="og:locale" content="ru_RU">
<meta name="theme-color" content="#0c2410">
<link rel="apple-touch-icon" href="${p}images/brand/apple-touch-icon.png">
${fontPreload.map((f) => `<link rel="preload" href="${p}assets/fonts/${f}.woff2" as="font" type="font/woff2" crossorigin>`).join("\n")}
<link rel="stylesheet" href="${p}assets/styles.css?v=${V.css}">
<script>
(function(d){d.classList.add("js");try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches){d.classList.add("js-anim");if(d.dataset.page==="home"&&!sessionStorage.getItem("um2-intro"))d.classList.add("js-intro")}}catch(e){}
setTimeout(function(){if(!window.__umReady)d.classList.remove("js-anim","js-intro")},4000)})(document.documentElement);
window.umImg=function(i){var f=i.getAttribute("data-fb");if(f){i.removeAttribute("data-fb");i.removeAttribute("srcset");i.src=f;return}var p=i.closest("[data-ph]");if(p)p.classList.add("ph-on");i.style.opacity="0"};
window.umLogo=function(i){var f=i.getAttribute("data-fb");if(f){i.removeAttribute("data-fb");i.src=f;return}var p=i.closest(".logo,.footer__big");if(p)p.classList.add("is-fallback");i.style.display="none"};
</script>
<script src="${p}assets/vendor/gsap.min.js" defer></script>
<script src="${p}assets/vendor/ScrollTrigger.min.js" defer></script>
<script src="${p}assets/vendor/lenis.min.js" defer></script>
<script src="${p}assets/app.js?v=${V.app}" defer></script>
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join("\n")}
</head>
<body${page === "booking" ? ' class="booking-page"' : ""}>
<a class="skip" href="#main">К содержанию</a>
${PUBLISH ? "" : `<div class="demo-bar">Демонстрационный макет нового сайта стоматологии «Умная Медицина». Заявки из форм пока никуда не отправляются.</div>`}`;
}

// заставка (Ilya 17.10, вариант 5 из пяти): логотип проявляется по центру и перелетает на своё место в шапке, тёмный фон тает
function intro(depth) {
  return `<div class="intro" aria-hidden="true"><div class="intro__bg"></div><img class="intro__mark" src="${pre(depth)}images/brand/header-logo-light.svg" alt=""></div>`;
}

// кнопки-действия: открывают окно на сайте, без скриптов ведут на запись, телефон или Telegram
const fallbackHref = (kind, p, o = {}) => kind === "call" ? clinic.phoneHref
  : kind === "xray" ? clinic.telegram
  : kind === "allon" ? `${p}zapis.html?service=all-on-4`
  : `${p}zapis.html${o.service ? `?service=${bookSlug(o.service)}` : o.doctor ? `?doctor=${o.doctor}` : ""}`;
// услуга страницы нового формата → пункт списка на странице записи (там 10 направлений главной): All-on-6 и протез на имплантах
// к All-on-4, остальные к своему разделу (коронки к протезированию)
const bookSlug = (slug) => {
  if (svc[slug]) return slug;
  if ((slug === "all-on-6" || slug === "vsya-chelyust") && svc["all-on-4"]) return "all-on-4";
  for (let x = servicePages.find((y) => y.slug === slug); x; x = servicePages.find((y) => y.slug === x.parent)) if (svc[x.slug]) return x.slug;
  return slug;
};
const act = (label, kind, p, o = {}) => `<a class="btn${o.cls ? " " + o.cls : ""}" href="${fallbackHref(kind, p, o)}" data-modal="${kind}"${o.reason ? ` data-reason="${esc(o.reason)}"` : ""}${o.promo ? ` data-promo="${esc(o.promo)}"` : ""}${o.doctor ? ` data-doctor="${o.doctor}"` : ""}${o.magnet ? " data-magnet" : ""}>${esc(label)}</a>`;
// тур на телефоне как вторая секция Лава Дент: лента карточек стоит на месте и едет вбок от прокрутки,
// кабинет раскрывается на весь экран, заголовок проявляется по словам, поверх проходят остальные фото, потом текст
function phoneTour(depth) {
  const P = v2.clinic.phone;
  // фото ленты и галереи: в Chromium app.js переключает их на синхронное декодирование (иначе пустые карточки), в Safari остаётся фоновое
  const pic = (entry, alt, x, y = "50%") => img(entry, alt, depth, ` class="ptour__img"${x ? ` style="object-position:${x} ${y}"` : ""}`);
  // карточка ленты; у широких фото (pan) окно карточки ведёт по фото слева направо, пока лента едет: доля p0..p1 от того, что не влезло
  const card = ([f, cap, o], cls = "") => {
    const body = o && o.pan
      ? `<div class="ptour__win" style="--ar:${o.ar};--p0:${o.pan[0]};--p1:${o.pan[1]}"><span class="ptour__rail">${pic([f], cap, `${Math.round(((o.pan[0] + o.pan[1]) / 2) * 100)}%`, o.y)}</span></div>`
      : pic([f], cap, o);
    return `<div class="ptour__item${cls}">${body}<p class="ptour__cap" aria-hidden="true">${esc(cap)}</p></div>`;
  };
  const words = (t, from) => t.split(" ").map((w, i) => `<span class="w" style="--i:${from + i}">${esc(w)}</span>`).join(" ");
  return `<div class="ptour">
    <div class="ptour__car"><div class="ptour__items">
      <div class="ptour__item ptour__item--empty"></div>
      ${P.car.map((c, i) => card(c, i === P.car.length - 1 ? " ptour__item--left" : "")).join("")}
      <div class="ptour__item ptour__item--main">${pic(v2.clinic.frame, "Лечебный кабинет стоматологии «Умная Медицина»")}<span class="ptour__shade"></span>
        <div class="ptour__slogan"><span class="label label--light"><span class="w" style="--i:0">${esc(v2.clinic.label)}</span></span><h2 class="ptour__title">${words(v2.clinic.title, 1)}</h2></div></div>
      ${card(P.right, " ptour__item--right")}
    </div></div>
    <div class="ptour__spacer"></div>
    <div class="ptour__after">
      <div class="ptour__grid">${P.gallery.map(([f, cap, r, x], i) => `<figure class="ptour__fig"${i % 2 ? " data-par" : ""} style="--r:${r}"><span class="ptour__pic">${img([f], cap, depth, x ? ` style="object-position:${x} 50%"` : "")}</span><figcaption>${esc(cap)}</figcaption></figure>`).join("")}</div>
      <div class="ptour__text"><p>${esc(v2.clinic.text)}</p><a class="btn btn--light" href="https://yandex.ru/maps/?rtext=~${clinic.geo.lat},${clinic.geo.lon}"${ext}>Построить маршрут</a></div>
    </div>
  </div>`;
}

// единый хвост блока: оффер, кнопка (и ссылка), строка под кнопкой
const ctaBox = (offer, btn, link, note) => `<div class="cta-box" data-reveal>${offer ? `<p class="cta-box__offer">${esc(offer)}</p>` : ""}<div class="cta-box__row">${btn}${link || ""}</div>${note ? `<p class="cta-box__note">${esc(note)}</p>` : ""}</div>`;
const ext = ' target="_blank" rel="noopener"';

function header(depth, home = false) {
  const p = pre(depth);
  const href = (id) => (home ? `#${id}` : `${p}index.html#${id}`);
  const items = menuItems(p, href);
  return `
<header class="header"><div class="header__bar">
  <a class="logo" href="${p}index.html" aria-label="Умная Медицина. Стоматология, на главную">${phoneLogo(depth, true, "header-logo-light.svg", true)}<span class="logo__text">Умная Медицина<small>стоматология</small></span><span class="logo__unit">Стоматология</span></a>
  <nav class="nav" aria-label="Разделы">
    <ul class="nav__list">${phoneMenuItems(p, href).map(([t, h, dir]) => `<li class="nav__item"><a class="nav__link" href="${h}"${dir ? ` data-dir="${dir}"` : ""}>${t}</a><span class="nav__progress" aria-hidden="true"><span class="nav__fill" style="${navLine[t] || ""}"></span></span></li>`).join("")}</ul>
  </nav>
  <div class="header__cta">
    <a class="header__phone" href="${clinic.phoneHref}"><b>${esc(clinic.phone)}</b><small>${esc(clinic.hours)}</small></a>
    ${act("Записаться", "book", p, { cls: "btn--sm header__book", magnet: true })}
    <button class="burger" type="button" aria-label="Открыть меню" aria-expanded="false" aria-controls="menu">${icon.menu}</button>
  </div>
</div></header>
<div class="menu" id="menu" role="dialog" aria-modal="true" aria-label="Меню" data-lenis-prevent>
  <div class="menu__top"><a class="logo logo--white" href="${p}index.html">${phoneLogo(depth, true, "header-logo-ink.svg")}<span class="logo__text">Умная Медицина<small>стоматология</small></span><span class="logo__unit">Стоматология</span></a><button class="menu__close" type="button" aria-label="Закрыть меню">${icon.close}</button></div>
  <nav aria-label="Разделы">
    <details class="menu__svc"><summary>Услуги</summary><div class="menu__list">${homeOrder.map((k) => `<a href="${svcHref(k, p)}">${esc(svc[k].menu)}</a>`).join("")}</div></details>
    ${items.map(([t, h]) => `<a href="${h}">${t}</a>`).join("")}
  </nav>
  <div class="menu__foot"><a class="footer__phone" href="${clinic.phoneHref}">${esc(clinic.phone)}</a><span class="note">${esc(clinic.hours)}. Перезвоним за 5 минут.</span>${act("Записаться", "book", p, { cls: "btn--wide btn--lg" })}</div>
  <nav class="mnav" aria-label="Разделы">
    <ul class="mnav__list">${phoneMenuItems(p, href).map(([t, h, dir]) => `<li><a class="mnav__link" href="${h}"${dir ? ` data-dir="${dir}"` : ""}>${t}</a></li>`).join("")}</ul>
  </nav>
</div>`;
}

// окна: запись, перезвон, снимок на второе мнение, расчёт All-on-4, мессенджеры, при уходе, «спасибо»
function modals(depth) {
  const p = pre(depth);
  const consent = `Отправляя заявку, вы соглашаетесь на <a href="https://um-med.com/assets/files/pol.pdf"${ext}>обработку персональных данных</a>.`;
  const phone = `<label>Телефон<input name="phone" type="tel" required autocomplete="tel" inputmode="tel" placeholder="+7 ___ ___-__-__"></label>`;
  const name = `<label>Имя<input name="name" autocomplete="given-name" required></label>`;
  // строка «Акция: …», если окно открыли кнопкой из блока акций; уходит в заявку скрытым полем promo
  const promoLine = `<p class="modal__promo" hidden></p>`;
  const msgr = `<div class="modal__msgr"><a class="btn btn--ghost" href="${clinic.telegram}"${ext}>Отправить в Telegram</a><a class="btn btn--ghost" href="${clinic.max}"${ext}>Отправить в MAX</a></div>`;
  const box = (id, title, inner, wide = false) => `<div class="modal modal--${id}" id="m-${id}" role="dialog" aria-modal="true" aria-labelledby="m-${id}-t" hidden><div class="modal__box${wide ? " modal__box--wide" : ""}" data-lenis-prevent>
  <button class="modal__x" type="button" aria-label="Закрыть" data-close>${icon.close}</button>
  <h2 id="m-${id}-t" tabindex="-1">${title}</h2>${inner}
</div></div>`;
  return `
<script type="application/json" id="um-docs">${JSON.stringify(Object.fromEntries(doctors.map((d) => [d.id, d.short])))}</script>
<div class="modals">
${box("book", "Запишитесь на бесплатную консультацию", `<p class="modal__sub">Перезвоним за 5 минут, подберём врача и удобное время.</p>
  <p class="modal__doc" hidden></p>${promoLine}
  <form class="form lead" data-lead="book">
    <input type="hidden" name="doctor"><input type="hidden" name="promo">${name}${phone}
    <fieldset class="reasons"><legend>Что беспокоит <span>необязательно</span></legend><div class="chips">${home.reasons.map((r) => `<label class="chip chip--pick"><input type="radio" name="reason" value="${esc(r)}"><span>${esc(r)}</span></label>`).join("")}</div></fieldset>
    <button class="btn btn--lg btn--wide">Жду звонка</button>
    <p class="modal__note">Перезвоним за 5 минут. Заявки после 21:00 перезваниваем с 9:00 утра. ${consent}</p>
  </form>`)}
${box("call", "Перезвоним за 5 минут", `<p class="modal__sub">Оставьте номер, администратор перезвонит и ответит на вопросы.</p>
  <form class="form lead" data-lead="call">${phone}
    <button class="btn btn--lg btn--wide">Жду звонка</button>
    <p class="modal__note">${consent}</p>
  </form>`)}
${box("xray", "Пришлите снимок, и врач скажет, можно ли сохранить зуб", `<p class="modal__sub">Подойдёт КТ, панорама, прицельный снимок или фото плана лечения из другой клиники. Врач посмотрит и ответит в течение рабочего дня. Это бесплатно.</p>
  <form class="form lead" data-lead="xray">${name}${phone}
    <label class="file">Снимок или план<input name="file" type="file" accept="image/*,.pdf,.zip,.dcm"><span>Выбрать файл</span></label>
    ${msgr}
    <button class="btn btn--lg btn--wide">Отправить снимок</button>
    <p class="modal__note">Если зуб можно спасти, скажем, как и сколько это стоит. ${consent}</p>
  </form>`)}
${box("allon", "Консультация по All-on-4", `<p class="modal__sub">Хирург, ортопед и терапевт осмотрят вас вместе, сделаем КТ. Консультация бесплатная, стоимость лечения врач назовёт после осмотра.</p>
  ${promoLine}
  <form class="form lead" data-lead="allon"><input type="hidden" name="promo">${name}${phone}
    <fieldset class="reasons"><legend>Одна или обе челюсти</legend><div class="chips">${["Одна челюсть", "Обе челюсти"].map((r, i) => `<label class="chip chip--pick"><input type="radio" name="jaws" value="${r}"${i ? "" : " checked"}><span>${r}</span></label>`).join("")}</div></fieldset>
    <fieldset class="reasons"><legend>Носите ли съёмный протез</legend><div class="chips">${["Да, ношу", "Нет"].map((r) => `<label class="chip chip--pick"><input type="radio" name="denture" value="${r}"><span>${r}</span></label>`).join("")}</div></fieldset>
    <button class="btn btn--lg btn--wide">Записаться на консультацию</button>
    <p class="modal__note">Перезвоним за 5 минут. ${consent}</p>
  </form>`)}
${offer(depth, consent)}
${box("done", "Спасибо!", `<p class="modal__sub" data-done-text>Администратор перезвонит за 5 минут с номера ${esc(clinic.phone)}. Пока ждёте, можете прислать снимок в Telegram или MAX, врач посмотрит его до визита.</p>
  <div class="modal__msgr"><a class="btn" href="${clinic.telegram}"${ext}>Telegram</a><a class="btn btn--ghost" href="${clinic.max}"${ext}>MAX</a></div>
  <p class="modal__note">Это демонстрация: на рабочем сайте заявка уйдёт в amoCRM с названием формы, поводом, страницей и UTM-метками.</p>`)}
</div>`;
}

// окно с предложением: всплывает само через время на сайте. Одно поле, три врача крупно, крестик виден сразу
function offer(depth, consent) {
  const o = home.offer;
  return `<div class="modal modal--offer" id="m-offer" role="dialog" aria-modal="true" aria-labelledby="m-offer-t" hidden><div class="modal__box invite" data-lenis-prevent>
  <div class="invite__team">
    <p class="invite__cap">${esc(o.team)}</p>
    <ul class="invite__docs">${o.who.map(([id, role]) => `<li><span class="invite__pic">${img(docPhoto(docById[id]), docById[id].short, depth, "", "auto, 120px")}</span><b>${esc(role)}</b><span>${esc(docById[id].short).replace(" ", "<br>")}</span></li>`).join("")}</ul>
  </div>
  <div class="invite__body">
    <button class="invite__x" type="button" data-close>Закрыть ${icon.close}</button>
    <p class="label">${esc(o.label)}</p>
    <h2 id="m-offer-t" tabindex="-1">${esc(o.title)}</h2>
    <p class="invite__sub">${esc(o.sub)}</p>
    <p class="invite__perk">${esc(o.perk)}</p>
    <form class="lead invite__form" data-lead="offer">
      <label class="invite__field"><span>Телефон</span><input name="phone" type="tel" required autocomplete="tel" inputmode="tel" placeholder="+7 ___ ___-__-__"></label>
      <button class="btn">${esc(o.btn)}</button>
    </form>
    <p class="modal__note">${esc(o.note)} ${consent}</p>
  </div>
</div></div>`;
}

function footer(depth) {
  const p = pre(depth);
  const { lat, lon } = clinic.geo;
  return `
<footer class="footer on-dark"><div class="wrap footer__in">
  <div class="footer__cta footer__cta--big">
    <form class="cb big" data-lead="final" novalidate>
      <p class="label label--light">${esc(home.footForm.label)}</p>
      <h2 class="big__t" data-split>${esc(home.final[0])}</h2>
      <label class="big__field" for="cb-phone"><span class="sr">Ваш телефон</span><span class="big__ghost" aria-hidden="true"><i data-typed></i><span data-rest>+7 000 000-00-00</span></span><input class="big__in" id="cb-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required aria-describedby="cb-hint"></label>
      <button class="big__btn" type="submit">${esc(home.footForm.btn)}</button>
      <p class="cb__hint" id="cb-hint">${esc(home.final[1])}</p>
      <p class="cb__consent">Отправляя номер, вы соглашаетесь на <a href="https://um-med.com/assets/files/pol.pdf"${ext}>обработку персональных данных</a>.</p>
    </form>
    <div class="cb__done" role="status" tabindex="-1" hidden>
      <p class="cb__done-t">Спасибо, номер у нас</p>
      <p class="cb__done-s" data-done-s>Администратор перезвонит за 5 минут с номера ${esc(clinic.phone)}.</p>
      <div class="cb__alt"><p>Пока ждёте, можно прислать снимок.</p><a class="btn btn--ghost btn--sm" href="${fallbackHref("xray", p)}" data-modal="xray" data-reason="Сказали удалить">Прислать снимок врачу</a></div>
      <button class="way__link cb__again" type="button" data-again>Указать другой номер</button>
    </div>
  </div>
  <div class="fstage">
    <div class="fstage__pin" aria-hidden="true"><div class="fstage__logo footer__big">${logoImg(depth, false).replace('class="logo__img"', 'class="footer__logo"')}<span class="footer__word">Умная Медицина</span></div></div>
    <div class="fstage__info" itemscope itemtype="https://schema.org/Dentist" itemid="${CLINIC_ID}">
      <div class="fstage__group">
        <h3>Контакты</h3>
        <a class="fstage__big" href="${clinic.phoneHref}"><span itemprop="telephone">${esc(clinic.phone)}</span></a>
        <a class="fstage__big fstage__big--mail" href="mailto:${clinic.email}"><span itemprop="email">${esc(clinic.email)}</span></a>
      </div>
      <div class="fstage__group">
        <h3>Адрес</h3>
        <p class="fstage__addr" itemprop="address" itemscope itemtype="https://schema.org/PostalAddress"><span itemprop="addressRegion">${esc(A.region)}</span>, ${esc(A.district)}, <span itemprop="addressLocality">${esc(A.locality)}</span>, <span itemprop="streetAddress">${esc(A.street)}</span><meta itemprop="postalCode" content="${A.postal}"><meta itemprop="addressCountry" content="RU"></p>
        <p class="fstage__links"><a href="https://yandex.ru/maps/?rtext=~${lat},${lon}"${ext}>Маршрут в Яндекс Картах</a><a href="${clinic.gis}"${ext}>Открыть в 2ГИС</a></p>
      </div>
      <div class="fstage__group">
        <h3>Часы работы</h3>
        <p class="fstage__text"><meta itemprop="openingHours" content="Mo-Su 09:00-21:00"><span itemprop="geo" itemscope itemtype="https://schema.org/GeoCoordinates"><meta itemprop="latitude" content="${lat}"><meta itemprop="longitude" content="${lon}"></span>${esc(clinic.hours)}</p>
      </div>
      <nav class="fstage__group" aria-label="Услуги">
        <h3>Услуги</h3>
        <p class="fstage__list fstage__list--2">${homeOrder.map((k) => `<a href="${svcHref(k, p)}">${esc(svc[k].menu)}</a>`).join("")}</p>
      </nav>
      <div class="fstage__group">
        <h3>Пациентам</h3>
        <p class="fstage__list fstage__list--2">
          <a href="${p}ceny.html">Полный прайс</a>
          <a href="${fallbackHref("book", p)}" data-modal="book">Записаться</a>
          <a href="${clinic.vk}"${ext}>ВКонтакте</a>
          <a href="https://um-med.com/assets/files/dogovor-oferta.pdf"${ext}>Договор-оферта</a>
          <a href="https://um-med.com/assets/files/pol.pdf"${ext}>Политика обработки данных</a>
          <a href="${clinic.mainSite}"${ext}>Многопрофильная клиника</a>
          <a href="https://um-med.com/vacancies.html"${ext}>Вакансии</a>
        </p>
      </div>
      <meta itemprop="name" content="Умная Медицина. Стоматология"><link itemprop="url" href="${SITE}/">
    </div>
  </div>
  <div class="footer__legal">
    <span>© 2026 ${esc(clinic.legal)}, ИНН ${clinic.inn}, ОГРН ${clinic.ogrn}. Лицензия на медицинскую деятельность.</span>
    <span>Имеются противопоказания, необходима консультация специалиста.</span>
  </div>
</div></footer>
<div class="mobilebar"><a href="${clinic.phoneHref}">${icon.phone}Позвонить</a><a href="${fallbackHref("book", p)}" data-modal="book">Записаться</a></div>
${modals(depth)}`;
}
const end = `\n</body>\n</html>\n`;

// ---------- разметка schema.org ----------
// данные совпадают с видимым текстом (подвал, «Контакты») и карточками клиники; без aggregateRating и review
const A = clinic.addr;
if ([A.region, A.district, A.locality, A.street].join(", ") !== clinic.address) throw new Error("clinic.addr не совпадает с clinic.address");
const dentistLd = {
  "@context": "https://schema.org", "@type": "Dentist", "@id": CLINIC_ID, name: "Умная Медицина. Стоматология", url: `${SITE}/`,
  telephone: clinic.phone, email: clinic.email, image: `${SITE}/${OG_IMAGE}`,
  address: { "@type": "PostalAddress", streetAddress: A.street, addressLocality: A.locality, addressRegion: A.region, postalCode: A.postal, addressCountry: "RU" },
  geo: { "@type": "GeoCoordinates", latitude: clinic.geo.lat, longitude: clinic.geo.lon },
  hasMap: clinic.yandex,
  openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], opens: "09:00", closes: "21:00" }],
  // откуда ездят: те же места, что в строке «К нам ездят из …» блока «Контакты» (v2.way.towns)
  areaServed: ["Удельная", "Жуковский", "Раменское", "Быково", "Ильинский", "Красково", "Малаховка", "Островцы", "Люберцы", "Балашиха"],
  sameAs: [clinic.yandex, clinic.gis, clinic.prodoctorov, clinic.vk],
  priceRange: "₽₽",
};
const crumbsLd = (items) => ({
  "@context": "https://schema.org", "@type": "BreadcrumbList",
  itemListElement: [["/", "Главная"], ...items].map(([href, name], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE + (href === "/" ? "" : "/" + href) })),
});
// ответ вопроса: [текст](окно) становится ссылкой, которая открывает окно записи, перезвона или снимка
// «All-on-4» не рвём по дефису
const nobr = (s) => s.replace(/All-on-4/g, '<span class="nobr">All-on-4</span>').replace(/\+7[\s\u00a0]\d{3}[\s\u00a0]\d{3}-\d{2}-\d{2}/g, (m) => `<span class="nobr">${m}</span>`);
const faqA = (a, p) => esc(a).replace(/\[([^\]]+)\]\((xray|call|book)\)/g, (m, t, k) => `<a href="${fallbackHref(k, p)}" data-modal="${k}">${t}</a>`);
const faqLd = (faq) => ({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });

// ---------- блоки ----------
// спорные цены (servicePriceHold) и в общем прайсе плашкой, как на страницах услуг
const plHeld = (n, v) => servicePriceHold.find(([re]) => { re.lastIndex = 0; return re.test(`${n} — ${priceText(v)}`); });
const plist = (keys, limit = 99) => `<ul class="plist">${keys.flatMap((k) => prices[k].items).slice(0, limit).map(([n, v]) => { const h = plHeld(n, v); if (h) spPending.push(`прайс: ${h[1]}`); return `<li><span>${esc(n)}</span><b>${h ? `<mark class="todo-tag" title="${esc(h[1].replace(/\d{1,3}(?:[\s\u00a0]\d{3})+/g, "…"))}">цена уточняется</mark>` : priceText(v)}</b></li>`; }).join("")}</ul>`;

// портрет врача: обработанный локальный файл, если он есть, иначе фото с ПроДокторов
const docPhoto = (d) => [`images/doctors/${d.id}.jpg`, `images/doctors/${d.id}.png`, d.photo, d.photo && d.photo.replace("_square.jpg", "_square_small.jpg")];
const initialsOf = (d) => d.short.split(" ").map((w) => w[0]).join("");
const plural = (n, one, few, many) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; };
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const reviewsText = (n) => `${n} ${plural(n, "отзыв", "отзыва", "отзывов")}`;

const docById = Object.fromEntries(doctors.map((d) => [d.id, d]));

// o.lava: сетка как у Лава Дент, карточка стоит в левой (l) или правой (r) колонке и не проявляется отдельно
function doctorCard(d, depth, o = {}) {
  const p = pre(depth);
  return `<article class="doc${d.chief ? " doc--chief" : ""}" data-tags="${d.tags.join(" ")}"${o.lava ? ` data-col="${o.i % 2 ? "r" : "l"}"` : " data-reveal"}>
  <div class="doc__photo" data-ph><span class="doc__initials" aria-hidden="true">${initialsOf(d)}</span>${img(docPhoto(d), d.name, depth, "", "auto, (max-width: 760px) 80vw, 30vw")}
    <a class="doc__cover" href="${docHref(d.id, p)}" tabindex="-1" aria-hidden="true"></a>${o.lava ? `
    <a class="doc__go" href="${docHref(d.id, p)}" aria-label="Страница врача: ${esc(d.short)}"><svg viewBox="0 0 60 60" aria-hidden="true"><path d="M24 36 36 24M27 24h9v9"/></svg></a>` : ""}</div>
  <h3><a href="${docHref(d.id, p)}">${esc(d.name)}</a></h3>
  <p class="doc__role${d.chief ? " doc__role--chief" : ""}">${esc(d.role)}</p>
  ${d.focus ? `<p class="doc__focus">${esc(d.focus)}</p>` : ""}
  ${act("Записаться к врачу", "book", p, { cls: "btn--ghost btn--sm doc__cta", doctor: d.id })}
</article>`;
}

const teamTabs = () => `<div class="chips team__tabs" role="tablist" data-tabs="team">
    ${[["", "Все"], ["lechenie-zubov", "Терапия"], ["implantaciya", "Хирургия и имплантация"], ["protezirovanie", "Ортопедия"], ["ortodontiya", "Ортодонтия"], ["detskaya", "Детям"]].map(([v, t], i) => `<button class="chip" type="button" role="tab" data-tab="${v}" aria-selected="${i === 0}">${t}</button>`).join("")}
  </div>`;

function faqBlock(groups) {
  // groups: [[title, [[q, a], ...]], ...]
  const multi = groups.length > 1;
  return `<div class="faq">
  ${multi ? `<div class="faq__groups" role="tablist" data-tabs="faq">${groups.map(([t, qs], i) => `<button type="button" role="tab" data-tab="g${i}" aria-selected="${i === 0}">${esc(t)}</button>`).join("")}</div>` : `<div><h2 class="section__title" data-split>Частые вопросы</h2></div>`}
  <div>${groups.map(([t, qs], i) => `<div class="qa-group" data-panel="faq" data-key="g${i}"${i ? " hidden" : ""}>${qs.map(([q, a]) => `<details class="qa"><summary>${esc(q)}<i aria-hidden="true"></i></summary><div class="qa__a"><p>${esc(a)}</p></div></details>`).join("")}</div>`).join("")}</div>
</div>`;
}

function svcCard(k, i, depth, kind = "") {
  const s = svc[k];
  const p = pre(depth);
  const bg = kind ? `<span class="svc__bg" data-ph>${img(pics.svc[k], s.title, depth)}${ph(s.title)}</span>` : "";
  return `<a class="svc${kind}" href="${svcHref(k, p)}" data-reveal>${bg}
    <span><h3>${esc(s.title)}</h3>${kind.includes("wide") ? `<p class="svc__lead">${esc(s.lead)}</p>` : ""}</span>
  <span class="svc__meta"><span>${esc(s.short)}</span><span class="svc__from">${esc(s.from)}</span></span>
</a>`;
}

function svcRows(keys, depth, start = 0) {
  const p = pre(depth);
  return `<div class="svc-list">${keys.map((k, i) => {
    const s = svc[k];
    return `<a class="svc-row" href="${svcHref(k, p)}" data-reveal><h3>${esc(s.title)}</h3><span class="svc__from">${esc(s.from)}</span></a>`;
  }).join("")}</div>`;
}

function marquee(text) {
  const item = `<span class="marquee__item">${text}</span>`;
  return `<div class="marquee" aria-hidden="true"><div class="marquee__track">${item.repeat(4)}</div></div>`;
}

// ---------- контакты «карточка на карте» (Ilya 17.10): без фото, с Яндекс Картой ----------
// Компьютер: карта на весь экран, контакты на белой карточке поверх, как карточка места в Яндекс Картах; центр карты сдвинут,
// чтобы метка была справа от карточки. Телефон: контакты сверху, карта под ними во всю ширину.
// Карта: виджет Яндекса без ключа; до нажатия не ловит прокрутку (кнопка «Нажмите, чтобы двигать карту»)
const ymapPin = (z, dx = 0) => `https://yandex.ru/map-widget/v1/?ll=${(clinic.geo.lon + dx).toFixed(6)}%2C${clinic.geo.lat}&z=${z}&pt=${clinic.geo.lon},${clinic.geo.lat},pm2grm`;
function place(o = {}) {
  const { lat, lon } = clinic.geo;
  const W = v2.way;
  const map = (src, phone) => `<div class="ctmap ct__map"><iframe title="Карта: стоматология на Громова, 10/2" data-src-phone="${phone}" loading="lazy" src="${src}"></iframe><button class="place__unlock" type="button">Нажмите, чтобы двигать карту</button></div>`;
  return `<section class="way ct" id="contacts" aria-labelledby="ct-title">
  <div class="wrap ct__layer">
    <div class="ct__card">
      ${o.title ? `<h2 id="ct-title" class="way__h">${esc(o.title)}</h2>
      <p class="way__addr">${esc(W.title)}</p>` : `<span class="label way__label">${esc(W.label)}</span>
      <h2 id="ct-title" class="way__addr" data-split>${esc(W.title)}</h2>`}
      <p class="way__where">${esc(o.where || W.where)}</p>
      <div class="way__now"><p class="way__status" data-open-status>${esc(clinic.hours)}</p><a class="way__phone" href="${clinic.phoneHref}">${esc(clinic.phone)}</a></div>
      <ul class="way__facts">${W.facts.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
      <p class="way__towns">${esc(W.towns)}</p>
      <div class="way__apps">
        <a class="way__app" href="https://yandex.ru/maps/?rtext=~${lat},${lon}"${ext}><span class="rt-mark rt-mark--ya"><img src="${pick(["images/brand/yandex-maps.svg"], o.depth || 0).src}" alt=""></span><span>Маршрут<small>Яндекс Карты</small></span></a>
        <a class="way__app" href="${clinic.gis}"${ext}><span class="rt-mark rt-mark--2gis"><img src="${pick(["images/brand/2gis.png"], o.depth || 0).src}" alt=""></span><span>Маршрут<small>2ГИС</small></span></a>
      </div>
      <div class="way__more"><button class="way__link" type="button" data-share data-share-text="${esc(W.share)}" data-share-url="${clinic.yandex}">Отправить адрес</button></div>
    </div>
  </div>
  <div class="ct__mapbox">${map(ymapPin(16, -0.0062), ymapPin(16))}</div>
</section>`;
}

// ---------- услуги как у Лава Дент (компьютер и телефон) ----------
// Пять главных направлений карточками (первая во всю ширину), остальные строками. Клик открывает окно услуги
// с описанием, ценами «от» и записью, как у Лава Дент; без скриптов ссылка ведёт на страницу услуги.
const svlGo = '<span class="svl-go" aria-hidden="true"><svg viewBox="0 0 60 60"><path d="M24 36 36 24M27 24h9v9"/></svg></span>';
// «All-on-4» не рвётся по дефису, короткий предлог не остаётся в конце строки («под микроскопом»)
const svlTitle = (t) => esc(t).replace(/ (под|для|без|на|по|за|в|с|к|о|у|и) /gi, " $1\u00a0").replace(/\S+-\S+/g, (w) => `<span class="svl-nw">${w}</span>`);
const svlItems = () => [...v2.lava.cards, ...v2.lava.list];
function svlBlock(p, depth) {
  const items = svlItems(), n = v2.lava.cards.length;
  const card = (s, i) => `<a class="svl-card" href="${svcHref(s.slug, p)}" style="--delay:${(i * 0.3).toFixed(1)}s">
      ${img(s.img, "", depth, ' class="svl-card__img"')}
      <span class="svl-card__in"><span class="svl-card__top">${svlGo}</span><h3 class="svl-card__title">${svlTitle(s.title)}</h3></span>
    </a>`;
  const row = (s, i) => `<a class="svl-row" href="${svcHref(s.slug, p)}" style="--delay:${(i * 0.3).toFixed(1)}s"><h3 class="svl-row__title">${svlTitle(s.title)}</h3><span class="svl-row__act">${svlGo}</span></a>`;
  return `<div class="svl">
  <div class="svl__head"><div class="wrap"><h2 id="sv-title" data-split>${esc(v2.lava.title)}</h2><a class="link" href="${p}ceny.html">Весь прайс</a></div></div>
  <div class="svl__top"><div class="wrap"><div class="svl-grid" data-svl>
    ${items.slice(0, n).map(card).join("\n    ")}
  </div></div></div>
  <div class="svl__bottom"><div class="wrap"><div class="svl-list" data-svl>
    ${items.slice(n).map(row).join("\n    ")}
  </div></div></div>
</div>`;
}

// ---------- акции и выгодные условия: «Стопка» (Ilya 17.10) ----------
// Блок после услуг, перед врачами. Светлые карточки акций наплывают друг на друга при прокрутке, ниже «Выгодно всегда».
// Кнопка открывает окно записи с поводом и строкой «Акция: …», акция уходит в заявку скрытым полем promo.
// Если у акции нет картинки, вместо неё тёмная плитка с крупной ценой
// слова через дефис (Air-Flow, 3D-снимок, All-on-4) не рвутся по строкам
const prNw = (t) => esc(t).replace(/\S+-\S+/g, (w) => `<span class="nobr">${w}</span>`);
const prBtn = (d, p) => act(d.btn, d.modal, p, { reason: d.reason, cls: "btn--lg", promo: d.promo });
const prPrice = (d) => `<p class="pr-price"><b>${esc(d.price)}</b>${d.old ? `<s aria-label="вместо ${esc(d.old)}">${esc(d.old)}</s>` : ""}${d.sub ? `<span>${esc(d.sub)}</span>` : ""}</p>`;
function promoBlock(p, depth) {
  const A = v2.akcii;
  return `<section class="section pr on-dark" id="akcii" aria-labelledby="pr-title"><div class="wrap">
  <div class="section__head"><div><span class="label label--light">${esc(A.label)}</span><h2 id="pr-title" data-split>${esc(A.title)}</h2></div><p>${esc(A.text)}</p></div>
  <div class="pr4">${A.deals.map((d, i) => `<article class="pr4-card" style="--i:${i}">
    ${d.img ? `<span class="pr4-card__pic">${img(d.img, d.alt, depth)}</span>` : `<span class="pr4-card__pic pr4-card__pic--type" aria-hidden="true"><b>${esc(d.price)}</b></span>`}
    <div class="pr4-card__text">
      <span class="label pr-tag">${esc(d.tag)}</span>
      <h3 class="pr-title">${prNw(d.title)}</h3>
      ${prPrice(d)}
      <p class="pr-gift">${prNw(d.gift)}</p>
      ${prBtn(d, p)}
    </div>
  </article>`).join("")}</div>
  <div class="pr-al"><h3 class="pr-al__title">${esc(A.alwaysTitle)}</h3><ul class="pr-al__list">${A.always.map(([t, d]) => `<li data-reveal><b>${prNw(t)}</b><span>${prNw(d)}</span></li>`).join("")}</ul></div>
</div></section>`;
}

// ---------- главная: порядок блоков Тридента ----------
// первый экран, услуги и цены вкладками, клиника и оборудование, путь пациента, врачи, отзывы, три вопроса, контакты

function pageHome() {
  const depth = 0, p = "";
  const { rating } = home;
  const star = icon.star;
  const D = v2;
  // три врача после слогана на телефоне (на компьютере скрыты); пояснение, факты и пометки оттуда убраны (Ilya 17.10)
  const heroTrio = `<ul class="hero__trio" aria-label="Кто составляет план">${[["hludnevskiy", "Хирург"], ["solodukhin", "Ортопед"], ["chitaykin", "Терапевт"]].map(([id, role]) => `<li><a href="${docHref(id, "")}"><span class="hero__face">${img(docPhoto(docById[id]), docById[id].short, depth, "", "auto, 120px")}</span><b>${role}</b><span>${esc(docById[id].short).replace(" ", "<br>")}</span></a></li>`).join("")}</ul>`;
  const brandImg = (file, alt = "") => `<img src="${pick([`images/brand/${file}`], depth).src}" alt="${esc(alt)}" loading="lazy" decoding="async">`;

  return head({ title: D.seoTitle, desc: D.seoDesc, canonical: "/", depth, page: "home", jsonld: [dentistLd, faqLd(D.faq.flatMap(([, qs]) => qs).map(([q, a]) => [q, a.replace(/\[([^\]]+)\]\((\w+)\)/g, "$1")]))] })
  + intro(depth) + header(depth, true) + `
<main id="main">

<div class="opening">
<section class="hero hero--v hero--v1 on-dark" aria-labelledby="h1"><div class="wrap hero__in">
  <div class="hero__text">
    <h1 id="h1"><span data-split>Три врача.</span> <span class="hv__l2" data-split>Один план лечения.</span></h1>
    <p class="hv__rot"><span class="sr">${esc(D.heroLines.join(" "))}</span>${D.heroLines.map((t) => `<span aria-hidden="true">${t.replace(/(^|\s)([А-Яа-яЁё]{1,2}) /g, "$1$2\u00a0").split(" ").map((w, i) => `<span class="sw"><span style="--i:${i}">${esc(w)}</span></span>`).join(" ")}</span>`).join("")}</p>
    <div class="hero__actions">${act("Записаться на бесплатную консультацию", "book", p, { cls: "btn--lg", magnet: true })}</div>
  </div>
</div></section>

<section class="slogan on-dark" aria-label="Сначала думаем. Потом лечим.">
  ${marquee("Сначала думаем. <em>Потом лечим.</em>")}
  <div class="slogan__head" aria-hidden="true"><p class="slogan__title"><span class="line">Сначала думаем.</span> <span class="line">Потом лечим.</span></p></div>
  <div class="slogan__more"><div class="wrap">${heroTrio}</div></div>
</section>
</div>

<section class="tour on-dark" id="clinic" aria-labelledby="tr-title">
  <div class="tour__pin">
    <div class="tour__frame">${img(D.clinic.frame, "Лечебный кабинет стоматологии «Умная Медицина»", depth)}</div>
    <div class="tour__title wrap"><span class="label label--light">${esc(D.clinic.label)}</span><h2 id="tr-title" data-split>${esc(D.clinic.title)}</h2><p>${esc(D.clinic.text)}</p><a class="btn btn--light" href="https://yandex.ru/maps/?rtext=~${clinic.geo.lat},${clinic.geo.lon}"${ext}>Построить маршрут</a></div>
  </div>
  <p class="tour__lead wrap">${esc(D.clinic.text)}</p>
  <div class="tour__rows" aria-label="Фото клиники">
    ${D.clinic.rows.map((row, r) => `<div class="tour__row" data-dir="${r ? 1 : -1}">${[...row, ...row].map(([f, cap, tall], j) => `<figure class="tfig${tall ? " tfig--tall" : ""}"${j >= row.length ? ' aria-hidden="true"' : ""}><span class="tfig__img">${img([f], cap, depth)}</span><figcaption>${esc(cap)}</figcaption></figure>`).join("")}</div>`).join("")}
  </div>
  ${phoneTour(depth)}
</section>

<section class="foil on-dark" id="path" aria-labelledby="ph-title">
  <div class="foil__bg">${pick(pics.foil, depth).src ? `<img src="${pick(pics.foil, depth).src}" alt="" loading="lazy">` : ""}</div>
  <div class="feat">
    <div class="feat__pin"><div class="feat__track">
      <div class="fcard fcard--intro"><span class="label">${esc(D.path.label)}</span><h2 id="ph-title" data-split>${esc(D.path.title)}</h2><p>${esc(D.path.intro)}</p></div>
      ${D.path.steps.map(([big, t, d]) => `<article class="fcard"><div class="fcard__body"><b class="fcard__big">${esc(big)}</b><h3>${esc(t)}</h3><p>${esc(d)}</p></div></article>`).join("")}
    </div><div class="wrap cta-strip"><p>${esc(D.path.note)}</p>${act("Записаться на бесплатную консультацию", "book", p, { cls: "btn--light btn--lg", magnet: true })}</div></div>
  </div>
</section>

<section class="section section--sage svs" id="services" aria-labelledby="sv-title">
${svlBlock(p, depth)}
</section>

${promoBlock(p, depth)}

<section class="section section--sage" id="team" aria-labelledby="tm-title"><div class="wrap">
  <div class="section__head"><div><span class="label">${esc(D.team.label)}</span><h2 id="tm-title" data-split>${esc(D.team.title)}</h2></div><p>${esc(D.team.text)}</p></div>
  <div class="team__grid team__grid--lava">${doctors.map((d, i) => doctorCard(d, depth, { lava: true, i })).join("")}</div>
  <div class="team__more"><a class="btn btn--ghost" href="vrachi.html">Все врачи: опыт, образование, курсы</a></div>
</div></section>

<section class="section reviews" id="reviews" aria-labelledby="rv-title">
  <div class="wrap section__head"><div><span class="label">Отзывы</span><h2 id="rv-title" data-split>Что пишут пациенты</h2></div></div>
  <div class="wrap"><div class="rt" aria-label="Оценки клиники на площадках" data-reveal>
    <div class="rt-avg">
      <div class="rt-avg__num" data-count="${rating.avg}">${rating.avg}</div>
      <div class="rt-stars" role="img" aria-label="5 из 5">${star.repeat(5)}</div>
      <p class="rt-avg__cap">${esc(rating.avgCap)}</p>
    </div>
    <div class="rt-sites">
      ${[["ya", brandImg("yandex-maps.svg"), clinic.ratings[2], "reviews_yandex"], ["2gis", brandImg("2gis.png"), clinic.ratings[1], "reviews_2gis"]].map(([k, mark, r, goal]) => `<a class="rt-site" href="${r.url}"${ext} data-goal="${goal}">
        <span class="rt-site__top"><span class="rt-mark rt-mark--${k}">${mark}</span><span class="rt-site__val">${r.value}${star}</span></span>
        <span><span class="rt-site__name">${esc(r.site)}</span><span class="rt-site__count">${esc(r.count)}</span></span>
        <span class="rt-site__link">Смотреть отзывы</span>
      </a>`).join("")}
    </div>
    <div class="rt-pd">
      <div class="rt-seal"><svg class="rt-seal__ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="rt-seal__track" cx="50" cy="50" r="49.4"/><circle class="rt-seal__fill" cx="50" cy="50" r="49.4" pathLength="100"/></svg><a class="rt-seal__link" href="${clinic.prodoctorov}?utm_source=widget&amp;utm_medium=referral&amp;utm_campaign=recommend#otzivi"${ext} data-goal="reviews_prodoctorov" aria-label="Нас рекомендуют на сайте ПроДокторов: рейтинг 4,9, 199 отзывов">
        <img class="rt-seal__img" src="https://prodoctorov.ru/rating/widget/recommend/95133/200.png" srcset="https://prodoctorov.ru/rating/widget/recommend/95133/200.png 1x, https://prodoctorov.ru/rating/widget/recommend/95133/300.png 2x" width="200" height="134" alt="Нас рекомендуют на сайте ПроДокторов" title="ПроДокторов: стоматология «Умная медицина», Жуковский" loading="lazy" decoding="async" onerror="this.onerror=null;this.removeAttribute('srcset');this.src='${pick(["images/brand/prodoctorov.svg"], depth).src}';this.closest('.rt-seal').classList.add('is-fb')">
      </a></div>
      <div class="rt-pd__text">
        <p class="rt-pd__quote">${esc(rating.pdText)}</p>
        <a class="link rt-pd__link" href="${home.reviewsUrl}"${ext} data-goal="reviews_prodoctorov">Рейтинг 4,9 и 199 отзывов на ПроДокторов</a>
      </div>
    </div>
  </div></div>
  <div class="rv__rows">
    ${[home.reviews.slice(0, 9), home.reviews.slice(9)].map((row, r) => `<div class="rv__row" data-dir="${r ? 1 : -1}">${[...row, ...row].map((q, j) => `<figure class="rv${q.length > 110 ? " rv--long" : q.length < 60 ? " rv--short" : ""}"${j >= row.length ? ' aria-hidden="true"' : ""}><blockquote>«${esc(q)}»</blockquote></figure>`).join("")}</div>`).join("")}
  </div>
  ${reviewsMobile(home.reviews, esc)}
</section>

<section class="section faqv" id="faq" aria-labelledby="fq-title"><div class="wrap">
  <h2 id="fq-title" class="section__title faqv__title" data-split>${esc(D.faqTitle)}</h2>
  <div class="faqv__main">${D.faq.map(([t, qs], i) => `<details class="faqt"${i ? "" : " open"} data-reveal><summary><h3>${nobr(esc(t))}</h3><i aria-hidden="true"></i></summary><div class="faqt__body"><div class="faqt__list">${qs.map(([q, a], k) => `<details class="faqq"${i || k ? "" : " open"}><summary><span>${nobr(esc(q))}</span><i aria-hidden="true"></i></summary><div class="faqq__a"><p>${nobr(faqA(a, p))}</p></div></details>`).join("")}</div></div></details>`).join("")}</div>
</div></section>

${place()}
</main>` + footer(depth) + `
<script src="assets/rvm.js?v=${V.rvm}" async></script>` + end;
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
      <span class="label label--light">Стоимость</span>
      <span class="page-hero__price${/\d/.test(s.from) ? "" : " page-hero__price--text"}">${esc(s.from)}</span>
      ${act("Записаться на консультацию", "book", "../", { cls: "btn--lg", magnet: true, service: s.slug })}
    </div>
  </div>
</section>

<section class="section"><div class="wrap split">
  <div class="split__img" data-ph data-clip data-parallax>${img(pics.svc[s.slug], s.title, depth)}${ph(s.title)}</div>
  <div>
    <span class="label">О лечении</span>
    <div class="prose" style="margin-top:24px">${body.map((t) => `<p data-reveal>${esc(t)}</p>`).join("")}</div>
    <div class="points points--two">${s.points.map((t, j) => `<div class="point" data-reveal><p>${esc(t)}</p></div>`).join("")}</div>
  </div>
</div></section>

<section class="section section--dark on-dark"><div class="wrap">
  <div class="section__head"><div><span class="label">Этапы</span><h2 data-split>Как проходит лечение</h2></div></div>
  <ol class="steps">${s.steps.map((t, j) => `<li data-reveal><b>${esc(t)}</b></li>`).join("")}</ol>
</div></section>

<section class="section section--sage" id="prices"><div class="wrap">
  <div class="section__head"><div><span class="label">Цены</span><h2 data-split>Стоимость</h2></div><a class="link" href="../ceny.html">Весь прайс</a></div>
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

// ---------- страница услуги нового формата (Ilya 17.10): первый экран со своей картинкой, тексты SEO-треда ----------
// Шапка страницы (адрес, крошки, картинка, цифры первого экрана) в src/service-pages.mjs, текст в src/service-texts/<slug>.md
// (раскладывает scripts/import-service-texts.mjs). Пометки [УТОЧНИТЬ …], [ОТЗЫВ …] и спорные цены на демо видны плашками,
// с PUBLISH=1 сборка на них останавливается.
const spPending = [];
const warnText = "Имеются противопоказания. Необходима консультация специалиста.";
const spWarn = `<p class="sp-warn">${warnText}</p>`;
// тире не начинает строку
const spDash = (t) => t.replace(/ — /g, "\u00a0— ");
// акционная цена без слова «акция» рядом получает «по акции» (как 17 500 ₽ Osstem): на um-med.com она помечена «акция!»
const promoMark = (t) => t.replace(/от 77 000 ₽(\*\*)?/g, (m, b, off) => (/акци/i.test(t.slice(Math.max(0, off - 70), off + m.length + 30).split(/\n/).slice(-2).join(" ")) ? m : `${m} по акции`));
const spTexts = Object.fromEntries(servicePages.map((pg) => {
  const f = path.join(root, "src", "service-texts", `${pg.slug}.md`);
  if (!existsSync(f)) throw new Error(`Нет текста страницы услуги: src/service-texts/${pg.slug}.md`);
  return [pg.slug, parseServiceMd(promoMark(readFileSync(f, "utf8")))];
}));

// адрес из текста (/implantaciya/all-on-4/, /vrachi/solodukhin/, /gigiena/) → ссылка на странице; ещё не сделанная страница → null
const spOld = { lechenie: "lechenie-zubov", "lechenie/pod-mikroskopom": "mikroskop", diagnostika: "diagnostika", hirurgiya: "hirurgiya", gigiena: "gigiena", ortodontiya: "ortodontiya", detskaya: "detskaya" };
function spHref(url, p) {
  if (/^#/.test(url)) return url;
  const u = url.replace(/^\/|\/$/g, "");
  if (u === "") return `${p}index.html`;
  if (u === "ceny") return `${p}ceny.html`;
  if (u === "konsultaciya") return `${p}zapis.html`;
  const page = servicePages.find((x) => x.path === u + "/");
  if (page) return p + page.path;
  const doc = /^vrachi\/([\w-]+)$/.exec(u);
  if (doc) return docById[doc[1]] ? docHref(doc[1], p) : null;
  const old = spOld[u] || spOld[u.split("/")[0]];
  return old && svc[old] ? `${p}uslugi/${old}.html` : null;
}

// пометки в квадратных скобках: места под вёрстку убираем, вопросы к клинике показываем плашкой
const spDrop = /^(КНОПК|Кнопк|ТЕЛЕФОН|ФОРМА|МЕССЕНДЖЕР|КАРТА|КВИЗ|ОГЛАВЛЕНИЕ|СЛУЖЕБНОЕ|ВИДЕО|ФОТО ВРАЧ)/;
const spAsk = [[/^ТЕКСТ/, "текст в работе"], [/^(УТОЧНИТЬ|ДАТА)/, "уточняем у клиники"], [/^СОГЛАСОВАТЬ/, "согласуем с врачом"], [/^ОТЗЫВ/, "отзыв пациента"], [/^КЕЙС/, "пример работы"], [/^(ФОТО|СХЕМА|ИЛЛЮСТРАЦ)/, "фото или схема"], [/^ВРАЧ/, "врач клиники"]];
// суммы в подсказке плашки не показываем: там бывают спорные цены и итоги «под ключ»
const spTag = (label, note, page) => {
  spPending.push(`${page.slug}: ${note}`);
  return `<mark class="todo-tag sp-ask" title="${esc(note.replace(/\d{1,3}(?:[\s\u00a0]\d{3})+/g, "…"))}">${label}</mark>`;
};
function spMd(text, page, p) {
  const keep = [];
  const put = (html) => `\u0001${keep.push(html) - 1}\u0002`;
  // места под кнопку записи («**[Записаться к врачу]**») и телефон — вёрстка, не текст: кнопка и телефон на странице свои
  let s = text.replace(/(?:\*\*)?\[Записаться[^\]]*\](?!\()(?:\*\*)?|Телефон:\s*\[УТОЧНИТЬ У КЛИНИКИ: телефон\]|\s*·\s*кнопка «Записаться[^»]*»\.?/g, "");
  s = s.replace(/\[([А-ЯЁ][А-ЯЁ]{2,}[^\]]*|Кнопки:[^\]]*)\](?!\()/g, (m, note) => {
    if (spDrop.test(note)) return put("");
    if (/^ССЫЛКА НА КАРТОЧКУ/.test(note)) return put(`<a href="${clinic.yandex}"${ext}>карточка клиники в Яндекс Картах</a>`);
    const [, label] = spAsk.find(([re]) => re.test(note)) || [null, "уточняем у клиники"];
    return put(spTag(label, note, page));
  });
  for (const [re, note] of servicePriceHold) s = s.replace(re, (m) => m.replace(/(?:от )?\d{1,3}(?: \d{3})* ₽$/, () => put(spTag("цена уточняется", note, page))));
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, url) => {
    const h = spHref(url, p);
    return put(h ? `<a href="${h}">${esc(t)}</a>` : esc(t));
  });
  // стрелки «КТ → 3D-план → шаблон» на сайте не показываем (правило Ilya): последовательность через запятую
  s = esc(s.replace(/\s+→\s+/g, ", ")).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\s*\n\s*/g, " ");
  return s.replace(/\u0001(\d+)\u0002/g, (m, i) => keep[i]).replace(/·(\s*·)+/g, "·").replace(/(\s*·\s*)+$/, "").replace(/^(\s*·\s*)+/, "").trim();
}
const spPlain = (t) => t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*/g, "").replace(/\s+→\s+/g, ", ").replace(/\s*\n\s*/g, " ").trim();
const spHasAsk = (t) => /\[[А-ЯЁ][А-ЯЁ]{2,}/.test(t) || servicePriceHold.some(([re]) => { re.lastIndex = 0; return re.test(t); });
// точки-разделители «·» не показываем (правило Ilya: без декоративных точек). Строка плашек («Яндекс Карты 5,0 · рассрочка · налоговый вычет»)
// убирается, как «Плашки:» на других страницах; «Проверил: … · Обновлено …» — через точку; в остальном тексте — запятая
const spDots = (src, html) => {
  if (!/·/.test(html)) return html;
  const plain = spPlain(src).replace(/\[[^\]]*\]/g, "").trim();
  const parts = plain.split(/\s*·\s*/).filter(Boolean);
  if (parts.length >= 3 && parts.every((x) => x.length <= 60 && !/[.!?]$/.test(x))) return "";
  if (/^(Текст )?[Пп]роверил/.test(plain)) return html.replace(/\s*·\s*/g, ". ");
  return html.replace(/\s*·\s*/g, ", ");
};
const isWarn = (t) => spPlain(t).replace(/^>\s*/, "") === warnText;
const isPriceTable = (n) => n.t === "table" && /^Услуга/.test(n.head[0]) && /^Цена/.test(n.head[1] || "");
// первое предложение (для подзаголовка первого экрана), сокращения «пос.», «г.», «ул.» не обрывают
// и не рвут кавычки: «Умная Медицина. Стоматология» — одно название
const firstSentence = (t) => {
  for (const m of t.matchAll(/(?<!(?:^|[\s(])(?:пос|г|ул|д|см|мм|др|им|т\.\s?е|т\.\s?к))[.!?](?=\s+[«А-ЯЁA-Z])/g)) {
    const head = t.slice(0, m.index + 1);
    if ((head.match(/«/g) || []).length === (head.match(/»/g) || []).length) return [head, t.slice(head.length).trim()];
  }
  return [t, ""];
};
// цена из строки прайса для разметки: «от 19 300 ₽» → [19300, true]
const spPriceNum = (v) => { const m = /^(от\s+)?(\d[\d\s\u00a0]*)\s?₽$/.exec(v.trim()); return m && [Number(m[2].replace(/\D/g, "")), !!m[1]]; };

function spNodes(nodes, page, p) {
  const out = [];
  let last = "";
  for (const n of nodes) {
    if (n.t === "p" || n.t === "quote") {
      if (isWarn(n.text)) { out.push(spWarn); last = ""; continue; }
      if (n.t === "quote" && /^\*\*(Плашки|Кнопки)/.test(n.text)) continue;
      const html = spDots(n.text, spMd(n.text, page, p));
      if (!html) continue;
      // абзац из одной плашки (место под отзыв, пример работы): подряд одинаковые сливаются
      const only = /^<mark class="todo-tag sp-ask"[^>]*>([^<]+)<\/mark>$/.exec(html);
      if (only) { if (last !== only[1]) out.push(`<p class="sp-slot">${html}</p>`); last = only[1]; continue; }
      last = "";
      out.push(n.t === "quote" ? `<blockquote class="sp-quote"><p>${html}</p></blockquote>` : `<p>${html}</p>`);
    } else if (n.t === "ul" || n.t === "ol") {
      last = "";
      const tag = n.t;
      const lis = n.items.map((t) => spDots(t, spMd(t, page, p))).filter(Boolean);
      if (lis.length) out.push(`<${tag} class="sp-points${tag === "ol" ? " sp-points--ol" : ""}">${lis.map((h) => `<li>${h}</li>`).join("")}</${tag}>`);
    } else if (n.t === "table") {
      last = "";
      out.push(isPriceTable(n) ? spPriceList(n, page, p) : `<div class="sp-table" data-reveal><table>
        <thead><tr>${n.head.map((h) => `<th scope="col">${spMd(h, page, p)}</th>`).join("")}</tr></thead>
        <tbody>${n.rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${spHeldCell(r[0], c, page) || spMd(c, page, p)}</td>` : `<th scope="row">${spMd(c, page, p)}</th>`)).join("")}</tr>`).join("")}</tbody>
      </table></div>`);
    }
  }
  return out.join("\n");
}
// цена в ячейке таблицы, спорная по названию строки («Консультация | 500 ₽») — плашкой
const spHeldCell = (name, cell, page) => {
  const v = spPlain(cell);
  if (!/^(?:от )?\d[\d ]* ₽$/.test(v)) return "";
  const held = servicePriceHold.find(([re]) => { re.lastIndex = 0; return re.test(`${spPlain(name)} — ${v}`); });
  return held ? spTag("цена уточняется", held[1], page) : "";
};
// прайс: название (третья колонка — мелкой строкой под ним) и цена; спорная цена — плашкой
function spPriceList(n, page, p) {
  return `<ul class="sp-plist" data-reveal>${n.rows.map(([name, price = "", note]) => {
    const held = servicePriceHold.find(([re]) => { re.lastIndex = 0; return re.test(`${spPlain(name)} — ${price}`); });
    const v = held ? spTag("цена уточняется", held[1], page) : spMd(price, page, p);
    return `<li${!held && spPlain(price).length > 16 ? ' class="is-long"' : ""}><span>${spMd(name, page, p)}${note ? `<small>${spMd(note, page, p)}</small>` : ""}</span><b>${v}</b></li>`;
  }).join("")}</ul>`;
}
// три и больше коротких подраздела из абзацев — карточками во всю ширину под разделом, остальное стопкой в колонке текста
const subsAsCards = (subs) => subs.length >= 3 && subs.every((s) => s.nodes.every((n) => n.t === "p") && s.nodes.reduce((a, n) => a + n.text.length, 0) <= 650);
const spSubsHtml = (subs, page, p) => {
  if (!subs.length) return "";
  if (subsAsCards(subs)) return `<div class="sp-cards sp-cards--${subs.length % 3 === 0 ? 3 : 2}">${subs.map((s) => `<article class="sp-card" data-reveal><h3>${spMd(s.title, page, p)}</h3>${spNodes(s.nodes, page, p)}</article>`).join("")}</div>`;
  return `<div class="sp-subs-flow">${subs.map((s) => `<div class="sp-sub"${s.id ? ` id="${s.id}"` : ""} data-reveal><h3>${spMd(s.title, page, p)}</h3>${spNodes(s.nodes, page, p)}</div>`).join("")}</div>`;
};

function spSection(s, i, page, depth, ids) {
  const p = pre(depth);
  const t = s.title;
  const kind = s.nodes.some(isPriceTable) && !ids.has("ceny") ? "prices"
    : /^(Вопросы|Частые вопросы)/.test(t) ? "faq"
    : /этап/i.test(t) && s.nodes.some((n) => n.t === "ol" && n.items.every((x) => x.length <= 520)) ? "steps"
    : /^Как добраться/.test(t) || (page.geo && /добраться|дорог|маршрут|ехать/i.test(t)) ? "place"
    : /отзыв/i.test(t) ? "reviews"
    : /врач|имплантолог|ортопед/i.test(t) && /\(\/vrachi\//.test(JSON.stringify(s.nodes)) ? "doctors"
    : "text";
  s.kind = kind;
  const id = s.id || { prices: "ceny", faq: "voprosy", steps: "etapy", place: "kak-dobratsya", reviews: "otzyvy", doctors: "vrachi" }[kind] || `r${i + 1}`;
  if (ids.has(id)) throw new Error(`${page.slug}: два раздела с якорем #${id}`);
  ids.add(id);
  // фон чередуется: светлый, шалфей; прайс всегда светлый
  const tone = kind === "prices" || ids.tone === " section--sage" ? "" : " section--sage";
  ids.tone = kind === "steps" ? "" : tone;
  const h2 = `<h2 id="${id}-t" data-split>${spDash(spMd(t, page, p))}</h2>`;
  const sec = (body, cls = "") => `<section class="section sp-sec${tone}${cls}" id="${id}" aria-labelledby="${id}-t"><div class="wrap">${body}${after}</div></section>`;
  const cards = subsAsCards(s.subs);
  const subs = cards ? "" : spSubsHtml(s.subs, page, p);
  const after = cards ? spSubsHtml(s.subs, page, p) : "";
  const wide = s.nodes.some((n) => n.t === "table" && !isPriceTable(n) && n.head.length >= 4);
  const grid = (aside, body) => `<div class="sp-grid"><div class="sp-grid__aside">${aside}</div><div class="sp-body">${body}</div></div>`;
  switch (kind) {
    case "prices": {
      const at = s.nodes.findIndex(isPriceTable);
      return sec(grid(`${h2}<div class="sp-aside-text">${spNodes(s.nodes.slice(0, at), page, p)}</div>${act("Записаться на консультацию", "book", p, { cls: "btn--lg", service: page.slug })}`,
        `${spNodes(s.nodes.slice(at), page, p)}${subs}`));
    }
    case "steps": {
      const at = s.nodes.findIndex((n) => n.t === "ol");
      const items = s.nodes[at].items.map((x) => {
        const m = /^\*\*(.+?)\*\*\s*(—\s*)?([\s\S]*)$/.exec(x);
        // «**План лечения** со стоимостью…», «**Шаблон**, если нужен, —…»: жирное — начало фразы, а не заголовок; фраза целиком идёт текстом
        if (m && !m[2] && m[3] && !/[.:!?]$/.test(m[1])) return [m[1], x.replace(/\*\*/g, "")];
        return m ? [m[1].replace(/[.:]$/, ""), m[3].replace(/^[а-яё]/, (c) => c.toUpperCase())] : ["", x];
      });
      const rest = spNodes(s.nodes.slice(at + 1), page, p) + subs + after;
      return `<section class="foil on-dark sp-steps" id="${id}" aria-labelledby="${id}-t"><div class="feat">
    <div class="feat__pin"><div class="feat__track">
      <div class="fcard fcard--intro">${h2}${spNodes(s.nodes.slice(0, at), page, p)}</div>
      ${items.map(([title, d]) => `<article class="fcard"><div class="fcard__body">${title ? `<h3>${spMd(title, page, p)}</h3>` : ""}${d ? `<p>${spMd(d, page, p)}</p>` : ""}</div></article>`).join("")}
    </div><div class="wrap cta-strip"><p>Сроки и цену каждого этапа врач распишет в плане лечения.</p>${act("Записаться на консультацию", "book", p, { cls: "btn--light btn--lg", service: page.slug })}</div></div>
  </div>${rest ? `<div class="wrap sp-steps__sub">${rest}</div>` : ""}</section>`;
    }
    case "faq": {
      const qa = [];
      const lead = [];
      for (const n of s.nodes) {
        const m = n.t === "p" && /^\*\*(.+?)\*\*\s*\n([\s\S]+)$/.exec(n.text);
        if (m) qa.push({ q: m[1], a: [{ t: "p", text: m[2] }] });
        else if (qa.length) qa[qa.length - 1].a.push(n);
        else lead.push(n);
      }
      page.faq = qa.filter((x) => ![x.q, ...x.a.map((n) => n.text || JSON.stringify(n))].some((t) => spHasAsk(t))).map((x) => [spPlain(x.q), x.a.map((n) => spPlain(n.text || (n.items || []).join("; "))).join(" ")]);
      return sec(grid(`${h2}${spNodes(lead, page, p)}`, `<div class="sp-faq">${qa.map((x) => `<details class="faqq"><summary><span>${nobr(spMd(x.q, page, p))}</span><i aria-hidden="true"></i></summary><div class="faqq__a">${spNodes(x.a, page, p)}</div></details>`).join("")}</div>${subs}`)
        + `<p class="sp-meta">Проверил: ${spMd(page.meta.reviewer || "[ВРАЧ — кто проверил текст]", page, p)}. Цены на ${esc(page.meta.updated || servicePriceDate)}. Обновлено ${esc(page.meta.updated || servicePriceDate)}</p>`);
    }
    case "reviews": return sec(`<div class="sp-head">${h2}</div>
      <div class="sp-rates">${[clinic.ratings[2], clinic.ratings[1], clinic.ratings[0]].map((r) => `<a class="sp-rate" href="${r.url}"${ext} data-reveal><b>${esc(r.value)}</b><span>${esc(r.site)}</span><small>${esc(r.count)}</small><span class="link">Смотреть отзывы</span></a>`).join("")}</div>
      <div class="sp-more">${spNodes(s.nodes, page, p)}${subs}</div>`);
    case "doctors": {
      const docs = [...new Set([...JSON.stringify(s.nodes).matchAll(/\(\/vrachi\/([\w-]+)\/?\)/g)].map((m) => m[1]))].filter((d) => docById[d]);
      const nodes = s.nodes.filter((n) => !(n.t === "ul" && n.items.every((x) => /\(\/vrachi\//.test(x))));
      return sec(`${grid(h2, spNodes(nodes, page, p) + subs)}<div class="team__grid sp-team">${docs.map((d) => doctorCard(docById[d], depth)).join("")}</div>
      <div class="team__more"><a class="btn btn--ghost" href="${p}vrachi.html">Все врачи клиники</a></div>`);
    }
    case "place": {
      const call = s.nodes.find((n) => n.t === "p" && /^\*\*Запишитесь[^*]+\*\*$/.test(n.text.trim()));
      // посреди страницы (дорога на гео-странице) — только текст и карта, призыв записаться — в конце страницы
      const cta = i === page.sectionCount - 1;
      const nodes = cta ? s.nodes.filter((n) => n !== call) : s.nodes;
      return `${cta ? `<section class="section section--dark on-dark sp-cta"><div class="wrap sp-cta__in">
      <p class="sp-cta__t">${call ? spMd(call.text.replace(/\*\*/g, ""), page, p) : "Запишитесь на консультацию: план лечения с ценой по этапам"}</p>
      <div class="sp-cta__act">${act("Записаться на консультацию", "book", p, { cls: "btn--light btn--lg", magnet: true, service: page.slug })}${spWarn}</div>
    </div></section>` : ""}
${sec(grid(h2, spNodes(nodes, page, p) + subs + (page.photo ? geoPhoto(page, depth) : "")))}
${place({ depth })}`;
    }
    default:
      return sec(wide ? `<div class="sp-head">${h2}</div><div class="sp-body sp-body--wide">${spNodes(s.nodes, page, p)}${subs}</div>` : grid(h2, spNodes(s.nodes, page, p) + subs));
  }
}

// гео-страница: настоящее фото входа в клинику в блоке дороги, ровные углы, подпись под фото
const geoPhoto = (page, depth) => {
  const set = srcset(page.photo, depth);
  return `<figure class="geo-photo"><span class="geo-photo__img"><img src="${pick([page.photo], depth).src}"${set ? ` srcset="${set}" sizes="(max-width: 760px) 92vw, 50vw"` : ""} alt="${esc(page.photoCap)}" loading="lazy" decoding="async"${page.photoPos ? ` style="object-position:${page.photoPos}"` : ""}></span><figcaption>${esc(page.photoCap)}</figcaption></figure>`;
};

function pageSvc(page) {
  const depth = page.path.split("/").filter(Boolean).length;
  const p = pre(depth);
  const T = spTexts[page.slug];
  page.meta = T.meta;
  const chain = [];
  for (let x = page; x.parent; ) { x = servicePages.find((y) => y.slug === x.parent); chain.unshift([x.path, x.crumb]); }
  const crumbs = [["index.html", "Главная"], ...chain];
  const heroRel = page.hero.find(local);
  const heroImg = pick(page.hero, depth).src, heroSet = heroRel ? srcset(heroRel, depth) : "";
  if (!local(page.hero[0])) spPending.push(`${page.slug}: картинка первого экрана ${page.hero[0]}`);
  // подзаголовок первого экрана — первое предложение вступления, остальное вступление идёт следующим блоком
  const introP = T.intro.findIndex((n) => n.t === "p");
  const [lead, leadRest] = firstSentence(T.intro[introP].text);
  const intro = T.intro.map((n, i) => (i === introP ? (leadRest ? { t: "p", text: leadRest } : null) : n)).filter(Boolean);
  const ids = new Set();
  page.sectionCount = T.sections.length;
  const parts = T.sections.map((s, i) => spSection(s, i, page, depth, ids));
  // гео-страница не пересказывает страницы услуг, а ведёт на них: блок ссылок перед вопросами (или перед дорогой)
  if (page.links) {
    const faqAt = T.sections.findIndex((s) => s.kind === "faq");
    const last = T.sections.length - 1;
    const at = faqAt >= 0 ? faqAt : T.sections[last].kind === "place" ? last : parts.length;
    parts.splice(at, 0, `<section class="section section--dark on-dark geo-links" aria-labelledby="geo-links-t"><div class="wrap">
  <div class="sp-head"><h2 id="geo-links-t" data-split>Подробно об услугах</h2></div>
  <div class="geo-links__list">${page.links.map(([t, h]) => `<a class="geo-link" href="${p}${h}" data-reveal><span>${esc(t)}</span>${svlGo}</a>`).join("")}</div>
</div></section>`);
  }
  const body = parts.join("\n");
  // разметка: крошки, услуга с ценами из прайсов страницы (без спорных), вопросы с готовыми ответами
  const rows = T.sections.flatMap((s) => [...s.nodes, ...s.subs.flatMap((x) => x.nodes)]).filter(isPriceTable).flatMap((n) => n.rows);
  const offers = rows.filter(([n, v = ""]) => !spHasAsk(`${n} — ${v}`)).map(([n, v = ""]) => {
    const m = spPriceNum(v);
    if (!m) return null;
    const name = spPlain(n);
    return m[1] ? { "@type": "Offer", name, priceSpecification: { "@type": "PriceSpecification", minPrice: m[0], priceCurrency: "RUB" } } : { "@type": "Offer", name, price: m[0], priceCurrency: "RUB" };
  }).filter(Boolean);
  const provider = dentistLd["@id"] ? { "@id": dentistLd["@id"] } : { "@type": "Dentist", name: dentistLd.name, url: SITE, telephone: dentistLd.telephone, address: dentistLd.address };
  // в Title и Description плашку не поставить: предложение со спорной ценой выпадает
  const noHeld = (t) => t.split(/(?<=[.!?])\s+/).filter((x) => !servicePriceHold.some(([re]) => { re.lastIndex = 0; return re.test(x); })).join(" ");
  const title = spPlain(T.meta.title), desc = noHeld(spPlain(T.meta.desc));
  if (spHasAsk(title + desc)) spPending.push(`${page.slug}: пометка в Title или Description`);
  const jsonld = [
    crumbsLd([...chain, [page.path, page.crumb]]),
    { "@context": "https://schema.org", "@type": ["Service", "MedicalProcedure"], name: page.procedure, description: desc, url: `${SITE}/${page.path}`, provider, areaServed: page.geo ? [page.geo] : ["Удельная", "Раменский городской округ", "Жуковский"], offers },
    ...(page.faq && page.faq.length ? [faqLd(page.faq)] : []),
  ];
  const introHtml = spNodes(intro, page, p);
  const heroAlt = esc(spPlain(T.meta.alt || page.crumb));
  const heroMedia = `<div class="sp-hero__media">${heroImg ? `<img src="${heroImg}"${heroSet ? ` srcset="${heroSet}" sizes="(max-width: 760px) 100vw, 60vw"` : ""} alt="${heroAlt}" decoding="async" fetchpriority="high">` : ""}</div>`;
  const heroHtml = `<section class="page-hero sp-hero on-dark" aria-labelledby="h1">
  <div class="sp-hero__top">
    ${heroMedia}
    <div class="sp-hero__text">
      <nav class="crumbs" aria-label="Хлебные крошки">${crumbs.map(([h, t]) => `<a href="${p}${h}">${esc(t)}</a>`).join("")}<span aria-current="page">${esc(page.crumb)}</span></nav>
      <h1 id="h1" data-split>${spDash(esc(T.meta.h1))}</h1>
      <p class="page-hero__lead">${spMd(lead, page, p)}</p>
    </div>
    <div class="sp-hero__act">${act("Записаться на консультацию", "book", p, { cls: "btn--lg", magnet: true, service: page.slug })}<a class="link" href="#ceny">Все цены по этапам</a>${spWarn}</div>
  </div>
  <div class="wrap sp-hero__bottom">
    <ul class="sp-facts">${page.facts.map(([big, t]) => `<li><b>${esc(big)}</b><span>${esc(t)}</span></li>`).join("")}</ul>
    ${page.factsNote ? `<p class="sp-facts__note">${spMd(page.factsNote, page, p)}</p>` : ""}
    ${page.nav ? `<nav class="sp-nav" aria-label="В разделе «${esc(page.crumb)}»"><span class="label">В разделе</span>${page.nav.map(([t, h]) => `<a class="sp-pill" href="${p}${h}">${esc(t)}</a>`).join("")}</nav>` : ""}
  </div>
</section>
${introHtml ? `<section class="section sp-sec sp-intro" aria-label="Коротко об услуге"><div class="wrap">${introHtml}</div></section>` : ""}`;
  if (!ids.has("ceny")) throw new Error(`${page.slug}: в тексте нет прайса (таблица «Услуга | Цена»)`);
  return head({ title, desc, canonical: `/${page.path}`, depth, jsonld })
  + header(depth) + `
<main id="main" class="sp-page">
${heroHtml}
${body}
</main>` + footer(depth) + end;
}

// старый адрес услуги ведёт на новую страницу
const spRedirect = (page) => `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>${esc(page.crumb)}</title>
<meta name="robots" content="noindex"><link rel="canonical" href="${SITE}/${page.path}">
<meta http-equiv="refresh" content="0; url=../${page.path}">
</head><body><p><a href="../${page.path}">${esc(spTexts[page.slug].meta.h1)}</a></p></body></html>
`;

// ---------- страница врача ----------
function pageDoctor(d) {
  const depth = 1;
  const p = pre(depth);
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
  return head({ title: `${d.name} — ${d.title.toLowerCase()} | Умная Медицина`, desc, canonical: `/vrachi/${d.id}`, depth, jsonld: [crumbsLd([["vrachi", "Врачи"], ["vrachi/" + d.id, d.short]]), ld] })
  + header(depth) + `
<main id="main">
<section class="page-hero doc-hero on-dark">
  <div class="foil__bg"></div>
  <div class="wrap doc-hero__in">
    <div class="doc-hero__text">
      <nav class="crumbs" aria-label="Хлебные крошки"><a href="../index.html">Главная</a><a href="../vrachi.html">Врачи</a><span aria-current="page">${esc(d.short)}</span></nav>
      <span class="label label--light doc-hero__role">${esc(d.title)}</span>
      <h1><span data-split>${esc(last)}</span> <span data-split>${esc(given.join(" "))}</span></h1>
      ${d.claims ? `<ul class="doc-hero__facts">${d.claims.map(([n, t]) => `<li><b>${esc(n)}</b><span>${esc(t)}</span></li>`).join("")}</ul>` : d.exp || d.courses.length ? `<ul class="doc-hero__facts">
        ${d.exp ? `<li><b data-count="${d.exp}">${d.exp}</b><span>${plural(d.exp, "год", "года", "лет")} стажа</span></li>` : ""}
        ${d.courses.length ? `<li><b data-count="${d.courses.length}">${d.courses.length}</b><span>${plural(d.courses.length, "курс", "курса", "курсов")} повышения<br>квалификации</span></li>` : ""}
      </ul>` : ""}
      <div class="doc-hero__cta">
        ${act("Записаться к врачу", "book", "../", { cls: "btn--lg", magnet: true, doctor: d.id })}
      </div>
    </div>
    <figure class="doc-hero__photo" data-ph data-clip data-parallax><span class="doc__initials" aria-hidden="true">${initialsOf(d)}</span>${img(docPhoto(d), d.name, depth, ' fetchpriority="high"', "(max-width: 760px) 92vw, 40vw").replace(' loading="lazy"', "")}</figure>
  </div>
</section>

<section class="section"><div class="wrap doc-about">
  <div>
    <span class="label">Специализация</span>
    <ul class="doc-specs">${d.specs.map((t) => `<li data-reveal>${esc(t)}</li>`).join("")}</ul>
  </div>
  <div>
    <span class="label">Чем занимается в клинике</span>
    <div style="margin-top:28px">${svcRows(svcs, depth)}</div>
  </div>
</div></section>

${timeline.length ? `<section class="section section--dark on-dark"><div class="wrap">
  <div class="section__head"><div><span class="label">Образование и опыт</span><h2 data-split>Путь врача</h2></div><p>По анкете врача на ПроДокторов, где документы проверены сервисом.</p></div>
  <ol class="doc-path">${timeline.map((r) => `<li data-reveal><span class="doc-path__y">${esc(r.y)}</span><span class="doc-path__k">${esc(r.kind)}</span><div><b>${esc(r.t)}</b><span>${esc(r.place)}</span></div></li>`).join("")}</ol>
</div></section>` : `<section class="section section--sage"><div class="wrap doc-empty" data-reveal>
  <span class="label">Образование и опыт</span>
  <p>Сведения об образовании${d.exp ? "" : " и стаже"} врача клиника пока не опубликовала. Их можно уточнить у администратора: <a href="${clinic.phoneHref}">${esc(clinic.phone)}</a>.</p>
</div></section>`}

${d.courses.length ? `<section class="section section--sage"><div class="wrap">
  <div class="section__head"><div><span class="label">Повышение квалификации</span><h2 data-split>Курсы и конгрессы</h2></div></div>
  <div class="doc-courses">${d.courses.map(([y, t]) => `<div class="doc-course" data-reveal><span class="doc-course__y">${esc(y)}</span><p>${esc(t)}</p></div>`).join("")}</div>
</div></section>` : ""}

<section class="section section--sage"><div class="wrap">
  <div class="section__head"><div><span class="label">Команда</span><h2 data-split>Другие врачи</h2></div></div>
  <div class="team__grid team__grid--six">${others.map((x) => doctorCard(x, depth)).join("")}</div>
</div></section>
</main>` + footer(depth) + end;
}

// ---------- страница врача нового формата (Ilya 17.10): вид страниц услуг, блоки по ТЗ «врачи_семантика_и_ТЗ» ----------
// Данные в src/doctor-pages.mjs. Портрет справа без маски: лицо не тает. Стаж и оценки ПроДокторов не показываем.
// Помощники страниц врачей: у услуг тексты теперь из markdown, у врачей данные полями в src/doctor-pages.mjs
// ссылка из плана сайта (implantaciya/all-on-4/, hirurgiya/): новая страница услуги или старая uslugi/*.html; ещё не сделанная даёт null
function dpHref(target, p) {
  if (servicePages.some((x) => x.path === target)) return p + target;
  const m = /^([\w-]+)\/$/.exec(target);
  return m && svc[m[1]] ? `${p}uslugi/${m[1]}.html` : null;
}
// текст поля: строка или пометка «Ждём: …» (на демо видна, с PUBLISH=1 сборка остановится)
function dpText(v, page, tag = "p", cls = "") {
  const c = (x) => (x ? ` class="${x}"` : "");
  if (v && v.todo) { spPending.push(`${page.slug}: ${v.todo}`); return `<${tag}${c(("todo " + cls).trim())}>${esc(v.todo)}</${tag}>`; }
  return v == null ? "" : `<${tag}${c(cls)}>${esc(v)}</${tag}>`;
}
const dpInline = (v, page) => (v && v.todo ? dpText(v, page, "span", "todo--in") : esc(priceText(v)));
const dpLink = (text, target, p, cls = "") => {
  const h = dpHref(target, p);
  return h ? `<a${cls ? ` class="${cls}"` : ""} href="${h}">${esc(text)}</a>` : `<span class="sp-soon${cls ? " " + cls : ""}">${esc(text)}<small>страница в работе</small></span>`;
};
function dpBlock(b, page, depth) {
  const p = pre(depth);
  const tone = b.tone === "sage" ? " section--sage" : "";
  const h2 = () => `<h2 id="${b.id}-t" data-split>${spDash(esc(b.title))}</h2>`;
  const sec = (body) => `<section class="section sp-sec${tone}" id="${b.id}" aria-labelledby="${b.id}-t"><div class="wrap">${body}</div></section>`;
  switch (b.type) {
    case "links": return `<section class="section section--dark on-dark sp-sec sp-links" id="${b.id}" aria-labelledby="${b.id}-t"><div class="wrap">
      <div class="sp-head">${h2()}${dpText(b.text, page, "p", "sp-head__lead")}</div>
      <div class="svl"><div class="svl-list" data-svl>${b.items.map(([t, h, price], i) => {
        const href = dpHref(h, p), title = `<h3 class="svl-row__title">${svlTitle(t)}${price ? ` <small class="sp-links__price">${esc(price)}</small>` : ""}</h3>`;
        return href ? `<a class="svl-row" href="${href}" style="--delay:${(i * 0.3).toFixed(1)}s">${title}<span class="svl-row__act">${svlGo}</span></a>`
          : `<div class="svl-row is-soon" style="--delay:${(i * 0.3).toFixed(1)}s">${title}<span class="sp-soon"><small>страница в работе</small></span></div>`;
      }).join("")}</div></div>
    </div></section>`;
    case "text": return sec(`<div class="sp-grid"><div class="sp-grid__aside">${h2()}</div><div>${dpText(b.text, page)}</div></div>`);
    case "faq": return sec(`<div class="sp-grid"><div class="sp-grid__aside">${h2()}</div>
      <div class="sp-faq">${b.items.map(([q, a]) => `<details class="faqq"><summary><span>${nobr(esc(q))}</span><i aria-hidden="true"></i></summary><div class="faqq__a">${typeof a === "string" ? `<p>${nobr(faqA(a, p))}</p>` : dpText(a, page)}</div></details>`).join("")}</div>
    </div>`);
  }
}
const eduKind = (t) => (t.startsWith("Ординатура") ? "Ординатура" : t.startsWith("Повышение") ? "Квалификация" : "Образование");
const eduName = (t) => cap(t.replace(/^(Ординатура|Повышение квалификации): /, ""));
// отзыв: текст дословно, «Понравилось» и «Не понравилось» как на площадке, внизу автор, площадка со ссылкой на отзыв и дата
const dpDate = (iso) => iso.split("-").reverse().join(".");
const dpQuotes = (list) => `<ul class="dp-quotes">${list.map((q) => `<li data-reveal><blockquote cite="${q.url}">${q.text.map((t) => `<p>${esc(t)}</p>`).join("")}${q.liked ? `<p><b>Понравилось:</b> ${esc(q.liked)}</p>` : ""}${q.disliked ? `<p><b>Не понравилось:</b> ${esc(q.disliked)}</p>` : ""}</blockquote>
  <p class="dp-quotes__by">${esc(q.author)}${q.visit ? `, приём в ${esc(q.visit)}` : ""} · <a href="${q.url}"${ext}>отзыв на ${esc(q.site)}</a>, ${dpDate(q.date)}</p></li>`).join("")}</ul>`;
function pageDoc(d, page) {
  const depth = 2;
  const p = pre(depth);
  const pg = { slug: `vrachi/${d.id}`, noMeta: true };
  const [last, ...given] = d.name.split(" ");
  const url = `${SITE}/vrachi/${d.id}/`;
  const photo = pick(docPhoto(d), 0).src;
  const edu = [...d.edu, ...(page.extraEdu || [])];
  const timeline = [
    ...edu.map(([y, place, t, check]) => ({ y, sort: +y, kind: eduKind(t), t: eduName(t), place, check })),
    ...d.work.map(([y, place, t]) => ({ y, sort: +y.match(/\d{4}/)[0], kind: "Работа", t, place })),
  ].sort((a, b) => a.sort - b.sort);
  edu.filter((e) => e[3]).forEach(([y, place, , check]) => spPending.push(`${pg.slug}: ${place} ${y}: ${check}`));
  (page.facts || []).filter((f) => f[2]).forEach(([big]) => spPending.push(`${pg.slug}: сверить «${big}»`));
  const diploma = d.edu.find(([, , t]) => eduKind(t) === "Образование");
  const residency = d.edu.find(([, , t]) => eduKind(t) === "Ординатура");
  const n = d.courses.length;
  // ссылки «Ведёт» в первом экране: одна на страницу
  const pills = page.does.filter(([, h], i, a) => a.findIndex(([, h2]) => h2 === h) === i);
  // отзывы только с площадки и ссылкой на неё; нет отзывов, нет и блока (Ilya 18.10)
  const quotes = doctorReviews[d.id] || [];
  const others = doctors.filter((x) => x.id !== d.id && x.id !== "sikacheva");
  const org = (name) => ({ "@type": "EducationalOrganization", name });
  const ld = {
    "@context": "https://schema.org", "@type": "Person", "@id": `${url}#person`, name: d.name, givenName: given.join(" "), familyName: last,
    jobTitle: d.title, url, image: /^https?:/.test(photo) ? photo : `${SITE}/${photo}`,
    // та же клиника, что в JSON-LD Dentist главной (@id из ksenee7 6c80492)
    worksFor: { "@type": "Dentist", "@id": `${SITE}/#clinic`, name: dentistLd.name, url: SITE },
    alumniOf: [...new Set(d.edu.map(([, place]) => place))].map(org),
    hasCredential: d.edu.map(([y, place, t]) => ({ "@type": "EducationalOccupationalCredential", name: t.startsWith("Ординатура") || t.startsWith("Повышение") ? t : `Диплом: ${t.toLowerCase()}`, credentialCategory: eduKind(t) === "Образование" ? "диплом" : eduKind(t).toLowerCase(), recognizedBy: org(place), dateCreated: y })),
    knowsAbout: page.knowsAbout,
    ...(d.pd ? { sameAs: [d.pd] } : {}),
  };
  const faq = page.faq.filter(([, a]) => typeof a === "string");
  const heroHtml = `<section class="page-hero sp-hero dp-hero on-dark" aria-labelledby="h1">
  <div class="sp-hero__top">
    <figure class="dp-hero__photo" data-ph><span class="doc__initials" aria-hidden="true">${initialsOf(d)}</span>${img(docPhoto(d), `${d.name}, ${page.spec.toLowerCase()}`, depth, ' fetchpriority="high"', "(max-width: 760px) 92vw, 36vw").replace(' loading="lazy"', "")}</figure>
    <div class="sp-hero__text">
      <nav class="crumbs" aria-label="Хлебные крошки"><a href="${p}index.html">Главная</a><a href="${p}vrachi.html">Врачи</a><span aria-current="page">${esc(d.short)}</span></nav>
      <p class="label label--light dp-hero__spec">${esc(page.spec)}</p>
      <h1 id="h1"><span data-split>${esc(last)}</span> <span data-split>${esc(given.join(" "))}</span></h1>
      ${dpText(page.lead, pg, "p", "page-hero__lead")}
    </div>
    <div class="sp-hero__act">${act("Записаться к врачу", "book", p, { cls: "btn--lg", magnet: true, doctor: d.id })}${timeline.length ? `<a class="link" href="#obrazovanie">Образование и курсы</a>` : `<a class="link" href="#uslugi">Что делает врач</a>`}${spWarn}</div>
  </div>
  <div class="wrap sp-hero__bottom">
    <ul class="sp-facts">
      <li><b>${dpInline(page.consult, pg)}</b><span>${esc(page.consultName.toLowerCase())}</span></li>
      ${diploma ? `<li><b>${esc(diploma[0])}</b><span>диплом стоматолога, ${esc(diploma[1])}</span></li>` : ""}
      ${residency ? `<li><b>${esc(residency[0])}</b><span>ординатура: ${esc(eduName(residency[2]).toLowerCase())}, ${esc(residency[1]).replace(/([А-ЯЁ]\.) (?=[А-ЯЁ]\.)/g, "$1\u00a0")}</span></li>` : ""}
      ${n ? `<li><b>${n}</b><span>${plural(n, "курс", "курса", "курсов")} и конгрессов для врачей</span></li>` : ""}
      ${(page.facts || []).map(([big, t, check]) => `<li><b>${esc(big)}</b><span>${esc(t)}${check ? ` <mark class="todo-tag">${esc(check)}</mark>` : ""}</span></li>`).join("")}
    </ul>
    <nav class="sp-nav" aria-label="Что делает врач"><span class="label">Ведёт</span>${pills.map(([t, h]) => dpLink(t, h, p, "sp-pill")).join("")}</nav>
  </div>
</section>`;
  return head({ title: page.seoTitle, desc: page.seoDesc, canonical: `/vrachi/${d.id}/`, depth, jsonld: [crumbsLd([["vrachi", "Врачи"], [`vrachi/${d.id}/`, d.short]]), ld, ...(faq.length ? [faqLd(faq)] : [])] })
  + header(depth) + `
<main id="main" class="sp-page dp-page">
${heroHtml}

<section class="section sp-sec" id="obrazovanie" aria-labelledby="obrazovanie-t"><div class="wrap">
  <div class="sp-head"><h2 id="obrazovanie-t" data-split>Образование и квалификация</h2></div>
  ${page.eduTodo ? dpText(page.eduTodo, pg) : ""}
  ${timeline.length ? `<ol class="doc-path dp-path">${timeline.map((r) => `<li data-reveal><span class="doc-path__y">${esc(r.y)}</span><span class="doc-path__k">${esc(r.kind)}</span><div><b>${esc(r.t)}${r.check ? ` <mark class="todo-tag">${esc(r.check)}</mark>` : ""}</b><span>${esc(r.place)}</span></div></li>`).join("")}</ol>` : ""}
  ${n ? `<div class="sp-sub" data-reveal><h3>Курсы и конгрессы</h3><ul class="sp-plist dp-courses">${d.courses.map(([y, t]) => `<li><span>${esc(t)}</span><b>${esc(y)}</b></li>`).join("")}</ul></div>` : ""}
  ${page.docs ? `<div class="sp-more">${dpText(page.docs, pg)}</div>` : ""}
</div></section>

${dpBlock({ type: "links", id: "uslugi", title: "Что делает врач в клинике", text: `${page.spec} в Удельной. Точную стоимость врач называет после осмотра и снимков.`, items: page.does }, pg, depth)}

${quotes.length ? `<section class="section sp-sec" id="otzyvy" aria-labelledby="otzyvy-t"><div class="wrap sp-grid">
  <div class="sp-grid__aside"><h2 id="otzyvy-t" data-split>Отзывы пациентов</h2><p class="sp-aside-text">Отзывы с ${[...new Set(quotes.map((q) => q.site))].join(", ")} дословно, со ссылкой на каждый.</p>${d.pd && quotes.some((q) => q.site === "ПроДокторов") ? `<a class="link" href="${d.pd}otzivi/"${ext}>Все отзывы о враче на ПроДокторов</a>` : ""}</div>
  <div>${dpQuotes(quotes.slice(0, 3))}${quotes.length > 3 ? `<details class="dp-more"><summary><span class="link">Ещё ${quotes.length - 3} ${plural(quotes.length - 3, "отзыв", "отзыва", "отзывов")}</span></summary>${dpQuotes(quotes.slice(3))}</details>` : ""}</div>
</div></section>` : ""}

${place({ title: "Где принимает врач", depth })}

${dpBlock({ type: "faq", id: "voprosy", title: "Вопросы о приёме", items: page.faq }, pg, depth)}

<section class="section section--dark on-dark sp-cta"><div class="wrap sp-cta__in">
  <p class="sp-cta__t">${esc(page.cta || "Запишитесь на консультацию: врач осмотрит, посмотрит снимки и предложит план лечения с ценой.")}</p>
  <div class="sp-cta__act">${act("Записаться к врачу", "book", p, { cls: "btn--light btn--lg", magnet: true, doctor: d.id })}${spWarn}</div>
</div></section>

<section class="section section--sage"><div class="wrap">
  <div class="section__head"><div><span class="label">Команда</span><h2 data-split>Другие врачи</h2></div></div>
  <div class="team__grid team__grid--six">${others.map((x) => doctorCard(x, depth)).join("")}</div>
</div></section>
</main>` + footer(depth) + end;
}
// старого файла vrachi/<id>.html рядом с папкой нет: GitHub Pages отдаёт его и по адресу vrachi/<id>/; перенаправление настроим на сервере

// ---------- прайс ----------
// ---------- все врачи ----------
function pageDoctors() {
  const depth = 0;
  const ld = { "@context": "https://schema.org", "@type": "ItemList", itemListElement: doctors.map((d, i) => ({ "@type": "ListItem", position: i + 1, url: SITE + docHref(d.id, "/"), name: d.name })) };
  return head({ title: "Врачи стоматологии в Удельной: хирурги, ортопеды, терапевты | Умная Медицина", desc: "Врачи стоматологии «Умная Медицина» в Удельной: имплантологи, ортопеды, терапевты, ортодонты и детский стоматолог. Опыт, образование, запись к врачу.", canonical: "/vrachi", depth, jsonld: [crumbsLd([["vrachi", "Врачи"]]), ld] })
  + header(depth) + `
<main id="main">
<section class="page-hero on-dark"><div class="foil__bg"></div><div class="wrap page-hero__in">
  <div><nav class="crumbs" aria-label="Хлебные крошки"><a href="index.html">Главная</a><span aria-current="page">Врачи</span></nav><h1 data-split>Врачи стоматологии</h1><p class="page-hero__lead">${esc(v2.team.text)}</p></div>
  <div class="page-hero__aside">${act("Записаться на консультацию", "book", "", { cls: "btn--lg", magnet: true })}</div>
</div></section>
<section class="section section--sage team--page" id="team" aria-label="Врачи"><div class="wrap">
  ${teamTabs()}
  <div class="team__grid team__grid--lava">${doctors.map((d, i) => doctorCard(d, depth, { lava: true, i })).join("")}</div>
</div></section>
</main>` + footer(depth) + end;
}

function pagePrices() {
  const depth = 0;
  const order = ["consult", "xray", "therapy", "hygiene", "implant", "bone", "allon", "crowns", "removable", "surgery", "ortho", "kidsOrtho", "kids"];
  return head({ title: "Цены на стоматологию в Удельной и Жуковском | Умная Медицина", desc: "Прайс стоматологии «Умная Медицина»: лечение кариеса от 4 000 ₽, имплантация от 19 300 ₽, коронки от 26 400 ₽, КТ от 2 000 ₽. Цены на 15.10.2026.", canonical: "/ceny", depth, jsonld: [crumbsLd([["ceny", "Цены"]])] })
  + header(depth) + `
<main id="main">
<section class="page-hero on-dark"><div class="foil__bg"></div><div class="wrap page-hero__in">
  <div><nav class="crumbs" aria-label="Хлебные крошки"><a href="index.html">Главная</a><span aria-current="page">Цены</span></nav><h1 data-split>Прайс-лист</h1><p class="page-hero__lead">Цены на 15.10.2026. Итоговую стоимость врач называет после осмотра и записывает в план лечения.</p></div>
  <div class="page-hero__aside">${act("Записаться на консультацию", "book", "", { cls: "btn--lg", magnet: true })}</div>
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
    doctors: doctors.map((d) => ({ id: d.id, short: d.short, role: d.role, tags: d.tags, photo: pick(docPhoto(d), 0).src || null, initials: initialsOf(d) })),
  };
  return head({ title: "Записаться на приём | Умная Медицина. Стоматология", desc: "Онлайн-запись в стоматологию «Умная Медицина»: выберите услугу, врача и удобное время.", canonical: "/zapis", depth, page: "booking", jsonld: [crumbsLd([["zapis", "Записаться на приём"]])] }) + `
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
        <button class="btn btn--lg" type="button" data-start data-magnet>Перейти к записи</button>
      </section>
      <section class="bstep" data-step="1" hidden>
        <div class="bsteps" aria-hidden="true"><span><i></i></span><span><i></i></span><span><i></i></span><span><i></i></span></div>
        <h2 tabindex="-1">Что нужно сделать?</h2>
        <div class="opts" id="b-services"></div>
      </section>
      <section class="bstep" data-step="2" hidden>
        <div class="bsteps" aria-hidden="true"><span class="is-done"><i></i></span><span><i></i></span><span><i></i></span><span><i></i></span></div>
        <h2 tabindex="-1">К какому врачу?</h2>
        <div class="opts" id="b-doctors"></div>
        <div class="bnav"><button class="btn btn--ghost btn--sm" type="button" data-back>Назад</button></div>
      </section>
      <section class="bstep" data-step="3" hidden>
        <div class="bsteps" aria-hidden="true"><span class="is-done"><i></i></span><span class="is-done"><i></i></span><span><i></i></span><span><i></i></span></div>
        <h2 tabindex="-1">Когда удобно?</h2>
        <div class="days" id="b-days"></div>
        <div class="slots" id="b-slots"></div>
        <p class="note" style="margin-top:14px">Пример расписания. В рабочей версии здесь живые окна врачей из МИС клиники.</p>
        <div class="bnav"><button class="btn btn--ghost btn--sm" type="button" data-back>Назад</button><button class="btn btn--sm" type="button" data-next-time disabled>Дальше</button></div>
      </section>
      <section class="bstep" data-step="4" hidden>
        <div class="bsteps" aria-hidden="true"><span class="is-done"><i></i></span><span class="is-done"><i></i></span><span class="is-done"><i></i></span><span><i></i></span></div>
        <h2 tabindex="-1">Как с вами связаться?</h2>
        <form class="form" id="b-form">
          <label>Имя<input name="name" required autocomplete="name"></label>
          <label>Телефон<input name="phone" type="tel" required autocomplete="tel" placeholder="+7 ___ ___-__-__"></label>
          <label>Комментарий<textarea name="comment" placeholder="Например, болит зуб слева внизу"></textarea></label>
          <label class="check"><input type="checkbox" required> Согласен на обработку персональных данных</label>
          <div class="bnav" style="margin-top:6px"><button class="btn btn--ghost btn--sm" type="button" data-back>Назад</button><button class="btn">Записаться</button></div>
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
  <aside class="booking__aside on-dark" aria-label="Ваша запись" itemscope itemtype="https://schema.org/Dentist" itemid="${CLINIC_ID}">
    <span class="label label--light">Ваша запись</span>
    <dl class="summary">
      <div><dt>Услуга</dt><dd data-sum="service" class="is-empty">не выбрано</dd></div>
      <div><dt>Врач</dt><dd data-sum="doctor" class="is-empty">не выбрано</dd></div>
      <div><dt>Дата и время</dt><dd data-sum="date" class="is-empty">не выбрано</dd></div>
      <div><dt>Адрес</dt><dd itemprop="address" itemscope itemtype="https://schema.org/PostalAddress">${esc(clinic.addressShort)}<meta itemprop="streetAddress" content="${esc(clinic.addr.street)}"><meta itemprop="addressLocality" content="${esc(clinic.addr.locality)}"><meta itemprop="addressRegion" content="${esc(clinic.addr.region)}"><meta itemprop="postalCode" content="${clinic.addr.postal}"><meta itemprop="addressCountry" content="RU"></dd></div>
    </dl>
    <p class="note">Есть вопросы? Позвоните: <a href="${clinic.phoneHref}" style="color:#fff"><span itemprop="telephone">${esc(clinic.phone)}</span></a>, ежедневно с 9:00 до 21:00.<meta itemprop="openingHours" content="Mo-Su 09:00-21:00"></p>
    <meta itemprop="name" content="Умная Медицина. Стоматология"><link itemprop="url" href="${SITE}/">
  </aside>
</div>
<script type="application/json" id="bdata">${JSON.stringify(bdata).replace(/</g, "\\u003c")}</script>` + end;
}

// ---------- сборка ----------
rmSync(dist, { recursive: true, force: true });
mkdirSync(path.join(dist, "uslugi"), { recursive: true });
mkdirSync(path.join(dist, "vrachi"), { recursive: true });
mkdirSync(path.join(dist, "assets", "vendor"), { recursive: true });
// типографика: после коротких слов (в, к, на, от, до…) неразрывный пробел, чтобы они не висели в конце строки.
// Только в тексте между тегами, без скриптов и стилей.
const typo = (html) => html.replace(/(<(script|style)\b[\s\S]*?<\/\2>)|>([^<]+)</g, (m, block, _t, text) => block || ">" + text.replace(/(?<=^|[\s(«])([А-Яа-яЁё]{1,2}) (?=\S|$)/g, "$1\u00a0") + "<");
// правило сайта (Главная_концепция/контент_главной.md): в текстах нет длинных тире. После запятой тире просто уходит;
// в определении и перед ценой («Коронка — несъёмный протез», «композит — от 148 500 ₽») становится двоеточием,
// если в предложении уже есть двоеточие или тире — запятой
const noDash = (html) => html.replace(/(<script(?![^>]*ld\+json)[\s\S]*?<\/script>|<style[\s\S]*?<\/style>)|([,;:])?[ \u00a0]*—[ \u00a0]*/g, (m, block, punct, off, all) => {
  if (block) return block;
  if (punct) return punct + " ";
  const before = all.slice(Math.max(0, off - 400), off).replace(/<[^>]*>/g, "");
  if (!before.trim()) return "";
  const sent = before.split(/[.!?]\s+|"/).pop();
  const rest = all.slice(off + m.length, off + m.length + 400).replace(/<[^>]*>/g, "").split(/[.!?](?:\s|$)|"/)[0];
  return /[:—]/.test(sent) || /:/.test(rest) ? ", " : ": ";
});
const pages = [];
const urls = new Map(); // адрес страницы на сайте → её html, для карты сайта
const out = (f, html, map = true) => {
  if (f.endsWith(".html")) { pages.push((html = typo(f === "vrachi/sikacheva.html" ? html : noDash(html)))); if (map) urls.set("/" + f.replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, ""), html); }
  writeFileSync(path.join(dist, f), html);
};
out("index.html", pageHome());
out("ceny.html", pagePrices());
out("vrachi.html", pageDoctors());
out("zapis.html", pageBooking());
// старые адреса услуг, переехавших в новый формат, ведут на новую страницу и в карту сайта не попадают
for (const s of services) spBySlug[s.slug] ? writeFileSync(path.join(dist, `uslugi/${s.slug}.html`), noDash(spRedirect(spBySlug[s.slug]))) : out(`uslugi/${s.slug}.html`, pageService(s));
for (const page of servicePages) { mkdirSync(path.join(dist, page.path), { recursive: true }); out(`${page.path}index.html`, pageSvc(page)); }
// старая страница Сикачевой остаётся, но в карту сайта не идёт, пока Ilya не решит (17.10)
for (const d of doctors) {
  if (!doctorPages[d.id]) { out(`vrachi/${d.id}.html`, pageDoctor(d), d.id !== "sikacheva"); continue; }
  mkdirSync(path.join(dist, "vrachi", d.id), { recursive: true });
  out(`vrachi/${d.id}/index.html`, pageDoc(d, doctorPages[d.id]));
}
if (spPending.length) {
  // боевая сборка с пометками не оставляет полусобранный dist с «index, follow»
  if (PUBLISH) { rmSync(dist, { recursive: true, force: true }); throw new Error("На страницах услуг и врачей остались пометки:\n" + spPending.join("\n")); }
  console.log(`Страницы услуг и врачей: пометок на демо ${spPending.length} (тексты, картинки, ответы клиники)`);
}
for (const [f, code] of Object.entries(assets)) writeFileSync(path.join(dist, "assets", f), code);
cpSync(path.join(root, "src", "fonts"), path.join(dist, "assets", "fonts"), { recursive: true });
const nm = (p) => path.join(root, "node_modules", p);
copyFileSync(nm("gsap/dist/gsap.min.js"), path.join(dist, "assets/vendor/gsap.min.js"));
copyFileSync(nm("gsap/dist/ScrollTrigger.min.js"), path.join(dist, "assets/vendor/ScrollTrigger.min.js"));
copyFileSync(nm("lenis/dist/lenis.min.js"), path.join(dist, "assets/vendor/lenis.min.js"));

// картинки: в dist только те, на которые ссылаются страницы и стили; фото переводятся в WebP (с кэшем в node_modules/.cache)
const refs = new Set(["images/brand/favicon.svg"]);
for (const t of [...pages, assets["styles.css"]]) for (const m of t.matchAll(/images\/[\w./-]+?\.(?:jpe?g|png|webp|svg|avif|gif)\b/g)) refs.add(m[0]);
const cache = path.join(root, "node_modules", ".cache", "umed-img");
mkdirSync(cache, { recursive: true });
const toWebp = async (from, to, width) => {
  const buf = readFileSync(path.join(root, "src", from));
  const key = path.join(cache, `${hash(buf)}-${width || 0}.webp`);
  if (!existsSync(key)) {
    let im = sharp(buf);
    if (width) im = im.resize({ width, withoutEnlargement: true });
    await im.webp({ quality: 82, effort: 5, smartSubsample: true }).toFile(key);
  }
  mkdirSync(path.dirname(to), { recursive: true });
  copyFileSync(key, to);
};
const jobs = [];
for (const rel of refs) {
  const to = path.join(dist, rel), job = webpJobs.get(rel);
  if (job) jobs.push(toWebp(job.from, to, job.width));
  else if (rel.endsWith("apple-touch-icon.png") || rel === OG_IMAGE) continue;
  else if (local(rel)) { mkdirSync(path.dirname(to), { recursive: true }); copyFileSync(path.join(root, "src", rel), to); }
  else console.warn("нет картинки:", rel);
}
// значок для экрана «Домой» на iPhone из favicon.svg
if (sharp) jobs.push(sharp(path.join(root, "src/images/brand/favicon.svg"), { density: 300 }).resize(180, 180).flatten({ background: "#ffffff" }).png().toFile(path.join(dist, "images/brand/apple-touch-icon.png")));
// картинка для превью ссылок: 1200×630 из фото ресепшена (без sharp копируется как есть)
mkdirSync(path.join(dist, path.dirname(OG_IMAGE)), { recursive: true });
if (sharp) jobs.push(sharp(path.join(root, "src", OG_FROM)).resize(1200, 630, { fit: "cover" }).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(dist, OG_IMAGE)));
else copyFileSync(path.join(root, "src", OG_FROM), path.join(dist, OG_IMAGE));
await Promise.all(jobs);

// robots.txt: демо закрыто целиком. Боевой сайт открыт всем; YandexAdditional и YandexAdditionalBot (ответы Алисы и Нейропоиска)
// не слушают группы «*» и «Yandex», поэтому у них своя группа. Отдельных разрешений и запретов для других нейросетей нет
out("robots.txt", PUBLISH ? `User-agent: *\nAllow: /\n\nUser-agent: Yandex\nAllow: /\n\nUser-agent: YandexAdditional\nUser-agent: YandexAdditionalBot\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n` : "User-agent: *\nDisallow: /\n");
out(".nojekyll", "");

// карта сайта с честной датой: lastmod меняется, только когда меняется содержание страницы (заголовок, описание, разметка, текст),
// а не вёрстка или версии файлов. Отпечатки и даты хранятся в scripts/seo-state.json, обновляет их только боевая сборка:
// она же складывает новые, изменённые и удалённые адреса в indexnow-pending.json, их после выкладки отправляет scripts/indexnow.mjs
const stateFile = path.join(root, "scripts", "seo-state.json");
const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : {};
// домен вырезаем, чтобы сборка на другой адрес не сбрасывала даты; данные в application/json (списки страницы записи) учитываем
const fingerprint = (page) => {
  const html = page.split(SITE).join("");
  const ld = [...html.matchAll(/<script type="application\/(?:ld\+)?json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("");
  const meta = [...html.matchAll(/<(?:title>([^<]*)|meta name="description" content="([^"]*))/g)].map((m) => m[1] ?? m[2]).join("|");
  const text = html.slice(html.indexOf("<body")).replace(/<div class="demo-bar">[\s\S]*?<\/div>/, "").replace(/<(script|style)\b[\s\S]*?<\/\1>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return hash(meta + ld + text);
};
const today = process.env.BUILD_DATE || new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });
const fresh = {}, changed = [];
for (const [u, html] of urls) {
  const fp = fingerprint(html), was = state[u];
  fresh[u] = was && was.fp === fp ? was : { fp, lastmod: today };
  if (fresh[u] !== was) changed.push(u);
}
const removed = Object.keys(state).filter((u) => !urls.has(u));
out("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...urls.keys()].map((u) => `  <url><loc>${SITE}${u}</loc>${PUBLISH || state[u] ? `<lastmod>${(PUBLISH ? fresh : state)[u].lastmod}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>\n`);
if (PUBLISH) {
  writeFileSync(stateFile, JSON.stringify(fresh, null, 1) + "\n");
  const pend = path.join(root, "indexnow-pending.json");
  const was = existsSync(pend) ? JSON.parse(readFileSync(pend, "utf8")) : null;
  // IndexNow принимает адреса только своего домена: ожидающие от другого домена выбрасываем
  const prev = was && was.site === SITE ? was.urls : [];
  const list = [...new Set([...prev, ...[...changed, ...removed].map((u) => SITE + u)])];
  if (list.length) writeFileSync(pend, JSON.stringify({ site: SITE, urls: list }, null, 1) + "\n");
  else if (was) rmSync(pend);
  // ключ IndexNow лежит в корне сайта файлом <ключ>.txt
  const key = process.env.INDEXNOW_KEY;
  if (key) { if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) throw new Error("INDEXNOW_KEY: 8–128 символов a-z, A-Z, 0-9, «-»"); out(`${key}.txt`, key); }
  console.log(`Карта сайта: изменились ${changed.length}, удалены ${removed.length}; для IndexNow ждут отправки ${list.length}`);
}
console.log("Собрано страниц:", 3 + services.length + servicePages.length + doctors.length, "→", dist);
