#!/usr/bin/env node
// Сборка макета, вариант 2: главная по логике trydentspb.ru (9 блоков) в дизайне и механике Lava Dental + страницы услуг, прайс и онлайн-запись.
// Каждая страница отдаётся готовым HTML (важно для SEO). Запуск: npm run build → dist/
import { mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync, readdirSync, existsSync, cpSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { clinic, doctors, prices, services, brand, pics, homeOrder, home, v2 } from "../src/data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
// метка версии у стилей и скриптов: после выкладки браузер берёт новые файлы, а не старые из кэша
const ver = (f) => createHash("md5").update(readFileSync(path.join(root, "src/assets", f))).digest("hex").slice(0, 8);
const V = { css: ver("styles.css"), app: ver("app.js"), heroseq: ver("heroseq.js") };
const SITE = process.env.SITE_URL || "https://umnaya-stomatologiya.ru"; // домен-пример для canonical и разметки

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

// в шапке телефона светлая надпись логотипа (шапка там тёмная и полупрозрачная, как у Лава Дент);
// в меню телефона логотип одним тёмным цветом на шалфейном фоне, как у Лава Дент
const phoneLogo = (depth, eager = true, file = "header-logo-light.svg") => `<picture><source media="(max-width: 760px) and (forced-colors: none)" srcset="${pre(depth)}images/brand/${file}">${logoImg(depth, eager)}</picture>`;

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
const menuItems = (p, href) => [["Цены", `${p}ceny.html`], ["Врачи", href("team").startsWith("#") ? "#team" : `${p}vrachi.html`], ["О клинике", href("clinic")], ["Отзывы", href("reviews")], ["Контакты", href("contacts")]];
// меню телефона как у Лава Дент: разделы в порядке страницы, «Цены» рядом с услугами
const phoneMenuItems = (p, href) => [["Услуги", href("services"), "uslugi"], ["Цены", `${p}ceny.html`], ["О клинике", href("clinic")], ["Врачи", href("team").startsWith("#") ? "#team" : `${p}vrachi.html`, "vrachi"], ["Отзывы", href("reviews")], ["Вопросы", href("faq")], ["Контакты", href("contacts")]];

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
<link rel="icon" type="image/svg+xml" href="${p}images/brand/favicon.svg">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:locale" content="ru_RU">
<meta name="theme-color" content="#0c2410">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,400;1,500&family=Golos+Text:wght@400;500;600&family=Inter+Tight:wght@450&family=Manrope:wght@400;500;600&display=swap">
<link rel="stylesheet" href="${p}assets/styles.css?v=${V.css}">
<script>
(function(d){d.classList.add("js");try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches){d.classList.add("js-anim");if(d.dataset.page==="home"&&!sessionStorage.getItem("um2-intro"))d.classList.add("js-intro")}}catch(e){}
setTimeout(function(){if(!window.__umReady)d.classList.remove("js-anim","js-intro")},4000)})(document.documentElement);
window.umImg=function(i){var f=i.getAttribute("data-fb");if(f){i.removeAttribute("data-fb");i.src=f;return}var p=i.closest("[data-ph]");if(p)p.classList.add("ph-on");i.style.opacity="0"};
window.umLogo=function(i){var f=i.getAttribute("data-fb");if(f){i.removeAttribute("data-fb");i.src=f;return}var p=i.closest(".logo,.footer__big,.intro__logo");if(p)p.classList.add("is-fallback");i.style.display="none"};
</script>
<script src="${p}assets/vendor/gsap.min.js" defer></script>
<script src="${p}assets/vendor/ScrollTrigger.min.js" defer></script>
<script src="${p}assets/vendor/lenis.min.js" defer></script>
<script src="${p}assets/app.js?v=${V.app}" defer></script>
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join("\n")}
</head>
<body${page === "booking" ? ' class="booking-page"' : ""}>
<a class="skip" href="#main">К содержанию</a>
<div class="demo-bar">Демонстрационный макет нового сайта стоматологии «Умная Медицина». Заявки из форм пока никуда не отправляются.</div>`;
}

function intro(depth) {
  return `<div class="intro" aria-hidden="true"><div class="intro__in">
  <div class="intro__logo">${logoImg(depth)}<span class="logo__text">Умная Медицина</span></div>
  <div class="intro__bar"><i></i></div>
  <p class="intro__word">Стоматология</p>
</div></div>`;
}

// кнопки-действия: открывают окно на сайте, без скриптов ведут на запись, телефон или Telegram
const fallbackHref = (kind, p, o = {}) => kind === "call" ? clinic.phoneHref
  : kind === "xray" || kind === "write" ? clinic.telegram
  : kind === "allon" ? `${p}zapis.html?service=all-on-4`
  : `${p}zapis.html${o.service ? `?service=${o.service}` : o.doctor ? `?doctor=${o.doctor}` : ""}`;
const act = (label, kind, p, o = {}) => `<a class="btn${o.cls ? " " + o.cls : ""}" href="${fallbackHref(kind, p, o)}" data-modal="${kind}"${o.reason ? ` data-reason="${esc(o.reason)}"` : ""}${o.doctor ? ` data-doctor="${o.doctor}"` : ""}${o.magnet ? " data-magnet" : ""}>${esc(label)}</a>`;
// единый хвост блока: оффер, кнопка (и ссылка), строка под кнопкой
const ctaBox = (offer, btn, link, note) => `<div class="cta-box" data-reveal>${offer ? `<p class="cta-box__offer">${esc(offer)}</p>` : ""}<div class="cta-box__row">${btn}${link || ""}</div>${note ? `<p class="cta-box__note">${esc(note)}</p>` : ""}</div>`;
const ext = ' target="_blank" rel="noopener"';

function header(depth, home = false) {
  const p = pre(depth);
  const href = (id) => (home ? `#${id}` : `${p}index.html#${id}`);
  const items = menuItems(p, href);
  return `
<header class="header"><div class="header__bar">
  <a class="logo" href="${p}index.html" aria-label="Умная Медицина. Стоматология, на главную">${phoneLogo(depth)}<span class="logo__text">Умная Медицина<small>стоматология</small></span><span class="logo__unit">Стоматология</span></a>
  <nav class="nav" aria-label="Разделы">
    <div class="nav__drop"><a href="${href("services")}">Услуги</a><div class="nav__panel">${homeOrder.map((k) => `<a href="${p}uslugi/${k}.html"><span>${esc(svc[k].menu)}</span><small>${esc(svc[k].from)}</small></a>`).join("")}</div></div>
    ${items.map(([t, h]) => `<a href="${h}">${t}</a>`).join("")}
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
    <details class="menu__svc"><summary>Услуги</summary><div class="menu__list">${homeOrder.map((k) => `<a href="${p}uslugi/${k}.html">${esc(svc[k].menu)}</a>`).join("")}</div></details>
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
  const msgr = `<div class="modal__msgr"><a class="btn btn--ghost" href="${clinic.telegram}"${ext}>Отправить в Telegram</a><a class="btn btn--ghost" href="${clinic.max}"${ext}>Отправить в MAX</a></div>`;
  const box = (id, title, inner, wide = false) => `<div class="modal modal--${id}" id="m-${id}" role="dialog" aria-modal="true" aria-labelledby="m-${id}-t" hidden><div class="modal__box${wide ? " modal__box--wide" : ""}" data-lenis-prevent>
  <button class="modal__x" type="button" aria-label="Закрыть" data-close>${icon.close}</button>
  <h2 id="m-${id}-t" tabindex="-1">${title}</h2>${inner}
</div></div>`;
  return `
<script type="application/json" id="um-docs">${JSON.stringify(Object.fromEntries(doctors.map((d) => [d.id, d.short])))}</script>
<div class="modals">
${box("book", "Запишитесь на бесплатную консультацию", `<p class="modal__sub">Перезвоним за 5 минут, подберём врача и удобное время.</p>
  <p class="modal__doc" hidden></p>
  <form class="form lead" data-lead="book">
    <input type="hidden" name="doctor">${name}${phone}
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
  <form class="form lead" data-lead="allon">${name}${phone}
    <fieldset class="reasons"><legend>Одна или обе челюсти</legend><div class="chips">${["Одна челюсть", "Обе челюсти"].map((r, i) => `<label class="chip chip--pick"><input type="radio" name="jaws" value="${r}"${i ? "" : " checked"}><span>${r}</span></label>`).join("")}</div></fieldset>
    <fieldset class="reasons"><legend>Носите ли съёмный протез</legend><div class="chips">${["Да, ношу", "Нет"].map((r) => `<label class="chip chip--pick"><input type="radio" name="denture" value="${r}"><span>${r}</span></label>`).join("")}</div></fieldset>
    <button class="btn btn--lg btn--wide">Записаться на консультацию</button>
    <p class="modal__note">Перезвоним за 5 минут. ${consent}</p>
  </form>`)}
${box("write", "Напишите нам", `<p class="modal__sub">Ответим за 5 минут, ежедневно с 9:00 до 21:00. Можно сразу прислать снимок, врач посмотрит его до визита.</p>
  <div class="modal__msgr"><a class="btn btn--lg" href="${clinic.telegram}"${ext}>Telegram</a><a class="btn btn--lg btn--ghost" href="${clinic.max}"${ext}>MAX</a></div>`)}
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
    <ul class="invite__docs">${o.who.map(([id, role]) => `<li><span class="invite__pic">${img(docPhoto(docById[id]), docById[id].short, depth)}</span><b>${esc(role)}</b><span>${esc(docById[id].short).replace(" ", "<br>")}</span></li>`).join("")}</ul>
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
  <div class="footer__cta">
    <div><h2 data-split>${esc(home.final[0])}</h2><p class="footer__lead">${esc(home.final[1])}</p></div>
    <div class="footer__form">
      <form class="cb" data-lead="final" novalidate>
        <label class="cb__label" for="cb-phone">Ваш телефон</label>
        <div class="cb__field"><input id="cb-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 ___ ___-__-__" required aria-describedby="cb-hint"><button class="cb__btn" type="submit">${esc(home.footForm.btn)}</button></div>
        <p class="cb__hint" id="cb-hint">Перезвоним ежедневно с 9:00 до 21:00. Оставите номер вечером, позвоним утром.</p>
        <p class="cb__consent">Отправляя номер, вы соглашаетесь на <a href="https://um-med.com/assets/files/pol.pdf"${ext}>обработку персональных данных</a>.</p>
        <div class="cb__alt"><p>Есть снимок или план из другой клиники?</p><a class="btn btn--ghost btn--sm" href="${fallbackHref("xray", p)}" data-modal="xray" data-reason="Сказали удалить">Прислать снимок врачу</a></div>
      </form>
      <div class="cb__done" role="status" tabindex="-1" hidden>
        <p class="cb__done-t">Спасибо, номер у нас</p>
        <p class="cb__done-s" data-done-s>Администратор перезвонит за 5 минут с номера ${esc(clinic.phone)}.</p>
        <div class="cb__alt"><p>Пока ждёте, можно прислать снимок.</p><a class="btn btn--ghost btn--sm" href="${fallbackHref("xray", p)}" data-modal="xray" data-reason="Сказали удалить">Прислать снимок врачу</a></div>
        <button class="way__link cb__again" type="button" data-again>Указать другой номер</button>
      </div>
    </div>
  </div>
  <div class="fstage">
    <div class="fstage__pin" aria-hidden="true"><div class="fstage__logo footer__big">${logoImg(depth, false).replace('class="logo__img"', 'class="footer__logo"')}<span class="footer__word">Умная Медицина</span></div></div>
    <div class="fstage__info">
      <div class="fstage__group">
        <h3>Контакты</h3>
        <a class="fstage__big" href="${clinic.phoneHref}">${esc(clinic.phone)}</a>
        <a class="fstage__big fstage__big--mail" href="mailto:${clinic.email}">${esc(clinic.email)}</a>
      </div>
      <div class="fstage__group">
        <h3>Адрес</h3>
        <p class="fstage__addr">${esc(clinic.address)}</p>
        <p class="fstage__links"><a href="https://yandex.ru/maps/?rtext=~${lat},${lon}"${ext}>Маршрут в Яндекс Картах</a><a href="${clinic.gis}"${ext}>Открыть в 2ГИС</a></p>
      </div>
      <div class="fstage__group">
        <h3>Часы работы</h3>
        <p class="fstage__text">${esc(clinic.hours)}</p>
      </div>
      <nav class="fstage__group" aria-label="Услуги">
        <h3>Услуги</h3>
        <p class="fstage__list fstage__list--2">${homeOrder.map((k) => `<a href="${p}uslugi/${k}.html">${esc(svc[k].menu)}</a>`).join("")}</p>
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
    </div>
  </div>
  <div class="footer__legal">
    <span>© 2026 ${esc(clinic.legal)}, ИНН ${clinic.inn}, ОГРН ${clinic.ogrn}. Лицензия на медицинскую деятельность.</span>
    <span>Имеются противопоказания, необходима консультация специалиста.</span>
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
  priceRange: "₽₽",
};
const crumbsLd = (items) => ({
  "@context": "https://schema.org", "@type": "BreadcrumbList",
  itemListElement: [["/", "Главная"], ...items].map(([href, name], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE + (href === "/" ? "" : "/" + href) })),
});
// ответ вопроса: [текст](окно) становится ссылкой, которая открывает окно записи, перезвона или снимка
// «All-on-4» не рвём по дефису
const nobr = (s) => s.replace(/All-on-4/g, '<span class="nobr">All-on-4</span>');
const faqA = (a, p) => esc(a).replace(/\[([^\]]+)\]\((xray|call|book)\)/g, (m, t, k) => `<a href="${fallbackHref(k, p)}" data-modal="${k}">${t}</a>`);
const faqLd = (faq) => ({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });

// ---------- блоки ----------
const plist = (keys, limit = 99) => `<ul class="plist">${keys.flatMap((k) => prices[k].items).slice(0, limit).map(([n, v]) => `<li><span>${esc(n)}</span><b>${priceText(v)}</b></li>`).join("")}</ul>`;

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
  <div class="doc__photo" data-ph><span class="doc__initials" aria-hidden="true">${initialsOf(d)}</span>${img(docPhoto(d), d.name, depth)}
    <a class="doc__cover" href="${p}vrachi/${d.id}.html" tabindex="-1" aria-hidden="true"></a>${o.lava ? `
    <a class="doc__go" href="${p}vrachi/${d.id}.html" aria-label="Страница врача: ${esc(d.short)}"><svg viewBox="0 0 60 60" aria-hidden="true"><path d="M24 36 36 24M27 24h9v9"/></svg></a>` : ""}</div>
  <h3><a href="${p}vrachi/${d.id}.html">${esc(d.name)}</a></h3>
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
  return `<a class="svc${kind}" href="${p}uslugi/${k}.html" data-reveal>${bg}
    <span><h3>${esc(s.title)}</h3>${kind.includes("wide") ? `<p class="svc__lead">${esc(s.lead)}</p>` : ""}</span>
  <span class="svc__meta"><span>${esc(s.short)}</span><span class="svc__from">${esc(s.from)}</span></span>
</a>`;
}

function svcRows(keys, depth, start = 0) {
  const p = pre(depth);
  return `<div class="svc-list">${keys.map((k, i) => {
    const s = svc[k];
    return `<a class="svc-row" href="${p}uslugi/${k}.html" data-reveal><h3>${esc(s.title)}</h3><span class="svc__from">${esc(s.from)}</span></a>`;
  }).join("")}</div>`;
}

function marquee(text) {
  const item = `<span class="marquee__item">${text}</span>`;
  return `<div class="marquee" aria-hidden="true"><div class="marquee__track">${item.repeat(4)}</div></div>`;
}

// контакты «дорога до двери»: слева адрес и что важно знать, справа фото пути от улицы до входа.
// На компьютере сцена закрепляется, и прокрутка ведёт от точки к точке; на телефоне фото листаются свайпом. Карта по кнопке
function place() {
  const { lat, lon } = clinic.geo;
  const W = v2.way;
  return `<section class="section way" id="contacts" aria-labelledby="ct-title">
  <div class="wrap way__stage">
    <div class="way__info">
      <span class="label way__label">${esc(W.label)}</span>
      <h2 id="ct-title" class="way__addr" data-split>${esc(W.title)}</h2>
      <p class="way__where">${esc(W.where)}</p>
      <div class="way__now"><p class="way__status" data-open-status>${esc(clinic.hours)}</p><a class="way__phone" href="${clinic.phoneHref}">${esc(clinic.phone)}</a></div>
      <ul class="way__facts">${W.facts.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
      <p class="way__towns">${esc(W.towns)}</p>
      <div class="way__apps">
        <a class="way__app" href="https://yandex.ru/maps/?rtext=~${lat},${lon}"${ext}><span class="rt-mark rt-mark--ya"><img src="${pick(["images/brand/yandex-maps.svg"], 0).src}" alt=""></span><span>Маршрут<small>Яндекс Карты</small></span></a>
        <a class="way__app" href="${clinic.gis}"${ext}><span class="rt-mark rt-mark--2gis"><img src="${pick(["images/brand/2gis.png"], 0).src}" alt=""></span><span>Маршрут<small>2ГИС</small></span></a>
      </div>
      <div class="way__more"><button class="way__link" type="button" data-share data-share-text="${esc(W.share)}" data-share-url="${clinic.yandex}">Отправить адрес</button><button class="way__link" type="button" data-map-toggle aria-expanded="false" aria-controls="way-map">Показать карту</button></div>
    </div>
    <div class="way__walk">
      <div class="way__frame" aria-label="Как пройти от улицы до входа">${W.stops.map((x) => `<figure class="way__shot" style="--op:${x.pos}"><span class="way__img">${img([x.img], x.alt, 0)}</span><figcaption><b>${esc(x.title)}</b><span>${esc(x.text)}</span></figcaption></figure>`).join("")}</div>
      <div class="way__cap"><div class="chips way__stops">${W.stops.map((x, i) => `<button class="chip${i ? "" : " is-on"}" type="button" aria-pressed="${!i}">${esc(x.title)}</button>`).join("")}</div><p class="way__text" aria-live="polite">${esc(W.stops[0].text)}</p></div>
    </div>
  </div>
  <div class="wrap way__mapwrap" id="way-map" hidden>
    <div class="way__map"><iframe title="Карта: стоматология на Громова, 10/2" data-src="https://yandex.ru/map-widget/v1/?ll=${lon}%2C${lat}&z=16&pt=${lon},${lat},pm2grm"></iframe><button class="place__unlock" type="button">Нажмите, чтобы двигать карту</button></div>
  </div>
</section>`;
}

// ---------- главная: порядок блоков Тридента ----------
// первый экран, услуги и цены вкладками, клиника и оборудование, путь пациента, врачи, отзывы, три вопроса, контакты
const rowPrice = ([, v, old]) => (v === 0 ? "Бесплатно" : typeof v === "number" ? rub(v) : priceText(v)) + (old ? ` <s>${rub(old)}</s>` : "");

function pageHome() {
  const depth = 0, p = "";
  const { rating } = home;
  const star = icon.star;
  const D = v2;
  // пояснение, факты и три врача первого экрана: на телефоне первый экран занимает ровно один экран и уходит под шторку
  // со слоганом, как у Лава Дент, а эти блоки идут после слогана (копия в .slogan__more, на компьютере скрыта)
  const heroSub = `<p class="hero__sub">${esc(D.sub)}</p>`;
  const heroFacts = `<ul class="hero__facts">${D.facts.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`;
  const heroNote = `<p class="hero__note">${D.note.map((t) => `<span>${esc(t)}</span>`).join("")}</p>`;
  const heroTrio = `<ul class="hero__trio" aria-label="Кто составляет план">${[["hludnevskiy", "Хирург"], ["solodukhin", "Ортопед"], ["chitaykin", "Терапевт"]].map(([id, role]) => `<li><a href="vrachi/${id}.html"><span class="hero__face">${img(docPhoto(docById[id]), docById[id].short, depth)}</span><b>${role}</b><span>${esc(docById[id].short).replace(" ", "<br>")}</span></a></li>`).join("")}</ul>`;
  const brandImg = (file, alt = "") => `<img src="${pick([`images/brand/${file}`], depth).src}" alt="${esc(alt)}" loading="lazy" decoding="async">`;

  return head({ title: D.seoTitle, desc: D.seoDesc, canonical: "/", depth, page: "home", jsonld: [dentistLd, faqLd(D.faq.flatMap(([, qs]) => qs).map(([q, a]) => [q, a.replace(/\[([^\]]+)\]\((\w+)\)/g, "$1")]))] })
  + intro(depth) + header(depth, true) + `
<main id="main">

<div class="opening">
<section class="hero hero--3d on-dark" aria-labelledby="h1"><div class="wrap hero__in">
  <div class="hero__text">
    <h1 id="h1"><span class="kicker">${esc(D.kicker)}</span> <span data-split>${esc(D.h1)}</span></h1>
    ${heroSub}
    <p class="hero__promo"><span class="hero__promo-tag">Акция</span><span>${esc(D.promo[0])} <b>${esc(D.promo[1])}</b> <s>${esc(D.promo[2])}</s></span></p>
    <div class="hero__actions">${act("Записаться на бесплатную консультацию", "book", p, { cls: "btn--lg", magnet: true })}</div>
    ${heroFacts}
    ${heroNote}
    ${heroTrio}
  </div>
  <div class="hero__3d" aria-hidden="true" data-seq="images/implant/l/" data-frames="96" data-crop="1000,1200,288,118,426,926" data-seq-s="images/implant/s/" data-frames-s="24" data-crop-s="1000,1200,288,118,426,926"><canvas></canvas></div>
</div></section>

<section class="slogan on-dark" aria-label="Сначала думаем. Потом лечим.">
  ${marquee("Сначала думаем. <em>Потом лечим.</em>")}
  <div class="slogan__head" aria-hidden="true"><p class="slogan__title"><span class="line">Сначала думаем.</span> <span class="line">Потом лечим.</span></p></div>
  <div class="slogan__more"><div class="wrap">${heroTrio}${heroSub}${heroFacts}${heroNote}</div></div>
</section>
</div>

<section class="section section--sage" id="services" aria-labelledby="sv-title"><div class="wrap">
  <div class="section__head"><div><span class="label">${esc(D.services.label)}</span><h2 id="sv-title" data-split>${esc(D.services.title)}</h2></div><div class="section__aside"><a class="link" href="ceny.html">Весь прайс</a></div></div>
  <div class="ptabs dirs__tabs" role="tablist" aria-label="Направления" data-tabs="dir">${D.dirs.map((d, i) => `<button class="chip" type="button" role="tab" data-tab="d${i}" aria-selected="${i === 0}">${esc(d.tab)}</button>`).join("")}</div>
  ${D.dirs.map((d, i) => `<div class="dir" data-panel="dir" data-key="d${i}"${i ? " hidden" : ""}>
    <aside class="offer dir__card">
      <span class="label label--light">${esc(d.promo.tag)}</span>
      <h3>${esc(d.promo.title)}</h3>
      ${d.promo.price ? `<p class="invite__price"><b>${esc(d.promo.price)}</b>${d.promo.old ? `<s>${esc(d.promo.old)}</s>` : ""}</p>` : ""}
      <p class="dir__promo">${esc(d.promo.text)}</p>
      ${act(d.btn[0], d.btn[1], p, { cls: "btn--light", reason: d.btn[2] })}
    </aside>
    <div class="dir__body">
      <h3 class="dir__title">${esc(d.title)}</h3>
      <p class="dir__lead">${esc(d.lead)}</p>
      <ul class="plist">${d.rows.map((r) => `<li><span>${esc(r[0])}</span><b>${rowPrice(r)}</b></li>`).join("")}</ul>
      <div class="dir__links">${d.links.map(([t, k]) => `<a class="link" href="uslugi/${k}.html">${esc(t)}</a>`).join("")}</div>
    </div>
  </div>`).join("")}
</div></section>

<section class="tour on-dark" id="clinic" aria-labelledby="tr-title">
  <div class="tour__pin">
    <div class="tour__frame">${img(D.clinic.frame, "Лечебный кабинет стоматологии «Умная Медицина»", depth)}</div>
    <div class="tour__title wrap"><span class="label label--light">${esc(D.clinic.label)}</span><h2 id="tr-title" data-split>${esc(D.clinic.title)}</h2><p>${esc(D.clinic.text)}</p><a class="btn btn--light" href="https://yandex.ru/maps/?rtext=~${clinic.geo.lat},${clinic.geo.lon}"${ext}>Построить маршрут</a></div>
  </div>
  <p class="tour__lead wrap">${esc(D.clinic.text)}</p>
  <div class="tour__rows" aria-label="Фото клиники">
    ${D.clinic.rows.map((row, r) => `<div class="tour__row" data-dir="${r ? 1 : -1}">${[...row, ...row].map(([f, cap, tall], j) => `<figure class="tfig${tall ? " tfig--tall" : ""}"${j >= row.length ? ' aria-hidden="true"' : ""}><span class="tfig__img">${img([f], cap, depth)}</span><figcaption>${esc(cap)}</figcaption></figure>`).join("")}</div>`).join("")}
  </div>
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
      <a class="rt-seal" href="${home.reviewsUrl}"${ext} data-goal="reviews_prodoctorov" aria-label="Нас рекомендуют на ПроДокторов: рейтинг 4,9, 199 отзывов">
        <span class="rt-badge"><span class="rt-badge__t"><b>нас рекомендуют</b> на сайте</span><span class="rt-badge__logo">${brandImg("prodoctorov.svg", "ПроДокторов")}</span></span>
      </a>
      <div class="rt-pd__text">
        <p class="rt-pd__quote">${esc(rating.pdText)}</p>
        <a class="link rt-pd__link" href="${home.reviewsUrl}"${ext} data-goal="reviews_prodoctorov">Рейтинг 4,9 и 199 отзывов на ПроДокторов</a>
      </div>
    </div>
  </div></div>
  <div class="rv__rows">
    ${[home.reviews.slice(0, 9), home.reviews.slice(9)].map((row, r) => `<div class="rv__row" data-dir="${r ? 1 : -1}">${[...row, ...row].map((q, j) => `<figure class="rv${q.length > 110 ? " rv--long" : q.length < 60 ? " rv--short" : ""}"${j >= row.length ? ' aria-hidden="true"' : ""}><blockquote>«${esc(q)}»</blockquote></figure>`).join("")}</div>`).join("")}
  </div>
</section>

<section class="section faqv" id="faq" aria-labelledby="fq-title"><div class="wrap">
  <h2 id="fq-title" class="section__title faqv__title" data-split>${esc(D.faqTitle)}</h2>
  <div class="faqv__main">${D.faq.map(([t, qs], i) => `<details class="faqt"${i ? "" : " open"} data-reveal><summary><h3>${nobr(esc(t))}</h3><i aria-hidden="true"></i></summary><div class="faqt__body"><div class="faqt__list">${qs.map(([q, a], k) => `<details class="faqq"${i || k ? "" : " open"}><summary><span>${nobr(esc(q))}</span><i aria-hidden="true"></i></summary><div class="faqq__a"><p>${nobr(faqA(a, p))}</p></div></details>`).join("")}</div></div></details>`).join("")}</div>
  <div class="faqv__ask" data-reveal><div><b>Не нашли ответ?</b><p>Позвоните <a href="${clinic.phoneHref}">${esc(clinic.phone)}</a> или оставьте номер, перезвоним за 5 минут.</p></div>${act("Перезвоните мне", "call", p, { cls: "btn--sm" })}</div>
</div></section>

${place()}
</main>` + footer(depth) + `\n<script type="module" src="assets/heroseq.js?v=${V.heroseq}"></script>` + end;
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
    <figure class="doc-hero__photo" data-ph data-clip data-parallax><span class="doc__initials" aria-hidden="true">${initialsOf(d)}</span>${img(docPhoto(d), d.name, depth, ' fetchpriority="high"').replace(' loading="lazy"', "")}</figure>
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

// ---------- прайс ----------
// ---------- все врачи ----------
function pageDoctors() {
  const depth = 0;
  const ld = { "@context": "https://schema.org", "@type": "ItemList", itemListElement: doctors.map((d, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/vrachi/${d.id}`, name: d.name })) };
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
  <aside class="booking__aside on-dark" aria-label="Ваша запись">
    <span class="label label--light">Ваша запись</span>
    <dl class="summary">
      <div><dt>Услуга</dt><dd data-sum="service" class="is-empty">не выбрано</dd></div>
      <div><dt>Врач</dt><dd data-sum="doctor" class="is-empty">не выбрано</dd></div>
      <div><dt>Дата и время</dt><dd data-sum="date" class="is-empty">не выбрано</dd></div>
      <div><dt>Адрес</dt><dd>${esc(clinic.addressShort)}</dd></div>
    </dl>
    <p class="note">Есть вопросы? Позвоните: <a href="${clinic.phoneHref}" style="color:#fff">${esc(clinic.phone)}</a>, ежедневно с 9:00 до 21:00.</p>
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
const out = (f, html) => writeFileSync(path.join(dist, f), f.endsWith(".html") ? typo(html) : html);
out("index.html", pageHome());
out("ceny.html", pagePrices());
out("vrachi.html", pageDoctors());
out("zapis.html", pageBooking());
for (const s of services) out(`uslugi/${s.slug}.html`, pageService(s));
for (const d of doctors) out(`vrachi/${d.id}.html`, pageDoctor(d));
for (const f of readdirSync(path.join(root, "src", "assets"))) copyFileSync(path.join(root, "src", "assets", f), path.join(dist, "assets", f));
const nm = (p) => path.join(root, "node_modules", p);
copyFileSync(nm("gsap/dist/gsap.min.js"), path.join(dist, "assets/vendor/gsap.min.js"));
copyFileSync(nm("gsap/dist/ScrollTrigger.min.js"), path.join(dist, "assets/vendor/ScrollTrigger.min.js"));
copyFileSync(nm("lenis/dist/lenis.min.js"), path.join(dist, "assets/vendor/lenis.min.js"));
copyFileSync(nm("three/build/three.module.min.js"), path.join(dist, "assets/vendor/three.module.min.js"));
writeFileSync(path.join(dist, "assets/vendor/RoomEnvironment.js"), readFileSync(nm("three/examples/jsm/environments/RoomEnvironment.js"), "utf8").replace("from 'three'", "from './three.module.min.js'"));
if (existsSync(path.join(root, "src", "images"))) cpSync(path.join(root, "src", "images"), path.join(dist, "images"), { recursive: true });
out("robots.txt", "User-agent: *\nDisallow: /\n");
out(".nojekyll", "");
out("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${["/", "/ceny", "/vrachi", "/zapis", ...services.map((s) => `/uslugi/${s.slug}`), ...doctors.map((d) => `/vrachi/${d.id}`)].map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>2026-10-15</lastmod></url>`).join("\n")}\n</urlset>\n`);
console.log("Собрано страниц:", 3 + services.length + doctors.length, "→", dist);
