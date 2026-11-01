// Уведомление о cookie и Яндекс Метрика (Ilya 19.10, формат Юкки Дент; 23.10 схема как у Зубной Гармонии; 01.11 Метрика сразу).
// Текст плашки без названия сервиса, общими словами (Ilya 31.10); сервис назван в Политике, раздел 9.
// Ilya 01.11 (карточка «Метрика без согласия»): Яндекс Бизнес видит для целей подписки 55923423 только счётчик, который пишет визит
// при открытии страницы. Поэтому код счётчика в <head> каждой страницы (scripts/build.mjs, ymCode) запускается сразу, а правило
// 23.10 «Метрика только после «Принять»» отменено. Тексты плашки и «Настроек cookie» Ilya оставил слово в слово (01.11, скрин).
// «Принять» скрывает плашку: localStorage «um2-cookie» = "all". «Настройки cookie» в подвале → «Отключить аналитику»:
// «um2-cookie» = "off", cookie Метрики стираются, с перезагрузки счётчик не запускается (проверка "off" первой строкой
// в коде счётчика), плашка больше не появляется; «Принять» в «Настройках cookie» включает аналитику обратно.
// Отказ на плашках 22–23.10 («Только необходимые», «Нет»: "necessary") тоже считается отключением аналитики.
// Плашка внизу, страницу не закрывает (фид «Врачи» не принимает модальные окна) и не закрывает кнопки записи.
// Номер счётчика и адрес политики приходят из тега скрипта: data-ym, data-privacy.
(function () {
  var me = document.currentScript, ID = +(me && me.dataset.ym) || 0, privacy = (me && me.dataset.privacy) || "privacy/";
  var KEY = "um2-cookie", OFF = /^(off|necessary)$/;
  // выбор посетителя: localStorage «um2-cookie». Если браузер не даёт сайту localStorage (встроенный браузер приложения
  // без хранилища, запрет данных сайтов), тот же выбор пишем в cookie «um2-cookie» на год: её читает и код счётчика в <head>,
  // иначе «Отключить аналитику» в таком браузере не сохранялось бы
  var ck = function () { try { return (document.cookie.match(/(?:^|; )um2-cookie=([^;]*)/) || [])[1] || ""; } catch (e) { return ""; } };
  var get = function () { var v = ""; try { v = localStorage.getItem(KEY) || ""; } catch (e) {} return v || ck(); };
  var set = function (v) {
    try { localStorage.setItem(KEY, v); return; } catch (e) {}
    try { document.cookie = KEY + "=" + v + "; path=/; max-age=31536000; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : ""); } catch (e) {}
  };
  // хранилища браузера: в приватном режиме или при запрете данных сайтов чтение и запись бросают ошибку
  var read = function (kind, k) { try { return JSON.parse(window[kind].getItem(k) || "null"); } catch (e) { return null; } };
  var write = function (kind, k, v) { try { window[kind].setItem(k, JSON.stringify(v)); } catch (e) {} };
  var drop = function (kind, k) { try { window[kind].removeItem(k); } catch (e) {} };

  // ---------- откуда пришёл ----------
  // Визит вкладки (sessionStorage «um2-src»): первая страница, сайт, с которого пришли, метки. Заход с метками или с другого сайта
  // начинает визит заново. Такой заход ещё 30 дней лежит в localStorage «um2-src30»: если человек вернётся по закладке и оставит
  // заявку, в amoCRM будет видно, откуда он пришёл (как «последний значимый переход» в Метрике). Без заявки на сервер не уходит.
  var MARKS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "yclid", "gclid"];
  var DAYS30 = 30 * 864e5;
  var marked = function (v) { return MARKS.some(function (k) { return v[k]; }); };
  var visit = (function () {
    var v = read("sessionStorage", "um2-src"), q = new URLSearchParams(location.search), ref = "", m = {};
    try { if (document.referrer && new URL(document.referrer).origin !== location.origin) ref = document.referrer.slice(0, 500); } catch (e) {}
    MARKS.forEach(function (k) { if (q.get(k)) m[k] = q.get(k).slice(0, 200); });
    var old = read("localStorage", "um2-src30");
    if (old && !(Date.now() - (old.at || 0) < DAYS30)) drop("localStorage", "um2-src30");
    // «назад» с внешнего сайта приносит тот же referrer: это не новый заход
    if (!v || marked(m) || (ref && ref !== v.ref)) {
      v = { landing: (location.pathname + location.search).slice(0, 500), lt: document.title.slice(0, 200), ref: ref, at: Date.now() };
      MARKS.forEach(function (k) { if (m[k]) v[k] = m[k]; });
      write("sessionStorage", "um2-src", v);
      if (ref || marked(m)) write("localStorage", "um2-src30", v);
    }
    return v;
  })();
  // источник для заявки (app.js кладёт его в форму): визит вкладки, а если это прямой заход, то последний значимый за 30 дней
  window.umSource = function () {
    var s = visit;
    if (!s.ref && !marked(s)) {
      var old = read("localStorage", "um2-src30");
      if (old && Date.now() - (old.at || 0) < DAYS30) s = old;
    }
    var out = { landing: s.landing || "", ref: s.ref || "", src_at: s.at ? String(Math.round(s.at / 1000)) : "" };
    MARKS.forEach(function (k) { if (s[k]) out[k] = s[k]; });
    return out;
  };

  // поля заявок и набранный номер в подвале не попадают в запись Вебвизора. Метрика запускается раньше этого файла, поэтому
  // классы стоят уже в вёрстке (scripts/build.mjs, ymMask) и у ловушки для ботов (app.js); здесь их получают поля, появившиеся позже
  var mask = function () {
    document.querySelectorAll("input, textarea").forEach(function (el) { el.classList.add("ym-disable-keys"); });
    document.querySelectorAll(".big__ghost, .modal__doc").forEach(function (el) { el.classList.add("ym-hide-content"); });
  };
  // отказ на плашках 22–23.10 переписываем в "off": дальше он работает как «Отключить аналитику»
  if (get() === "necessary") set("off");
  var off = OFF.test(get()), loaded = false;
  // Счётчик запускает код в <head> (id="um-ym"). Если он не выполнился (CSP без 'unsafe-inline') или не запускался, потому что
  // аналитику отключали, а теперь в «Настройках cookie» нажали «Принять», грузим tag.js отсюда тем же кодом и с теми же параметрами
  var load = function () {
    if (loaded || off || !ID) return;
    loaded = true;
    mask();
    if (!window.ym) {
      (function (m, e, t, r, i, k, a) { m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); }; m[i].l = 1 * new Date(); k = e.createElement(t); a = e.getElementsByTagName(t)[0]; k.async = 1; k.src = r; a.parentNode.insertBefore(k, a); })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js?id=" + ID, "ym");
      // параметры те же, что в блоке um-ym (scripts/build.mjs, ymCode)
      window.ym(ID, "init", { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true });
    }
    if (/\/ceny(\/|\.html)?$/.test(location.pathname)) goal("prices");
  };
  // цели Метрики (Ilya 22.10): без имени и телефона, у отключивших аналитику не уходят. Список целей для кабинета:
  // /mnt/project-files/Заявки_с_сайта/цели_метрики.md
  var goal = function (name, params) {
    if (loaded && !off && window.ym) window.ym(ID, "reachGoal", name, params);
  };
  // работает ли аналитика у посетителя: app.js кладёт номер посетителя в Метрике (ym_uid) в заявку только тогда
  window.umAnalytics = function () { return loaded && !off; };
  // заявка: общая цель и отдельная по форме (событие um:lead шлёт app.js после того, как сервер принял заявку)
  document.addEventListener("um:lead", function (e) {
    var f = (e.detail && e.detail.form) || "";
    goal("lead", { form: f });
    if (f) goal("lead_" + f);
  });
  // открытие окна записи, звонка, снимка, All-on-4, рамки «Три врача» (событие um:goal шлёт app.js)
  document.addEventListener("um:goal", function (e) { if (e.detail) goal(e.detail); });
  var mapDone = false;
  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target : e.target.parentElement;
    if (!t) return;
    if (!mapDone && t.closest(".ctmap")) { mapDone = true; goal("map"); }
    if (t.closest("[data-share]")) return goal("share_address");
    var a = t.closest("a[href]");
    // ссылка, которая открывает окно (запись, звонок), считается целью open_… из app.js
    if (!a || a.hasAttribute("data-modal")) return;
    var h = a.getAttribute("href");
    if (/^tel:/.test(h)) goal("phone");
    else if (/^https?:\/\/([a-z.]*\.)?(t\.me|max\.ru|vk\.com|wa\.me|whatsapp\.com)\//.test(h)) goal("messenger");
    else if (/reviews/.test(h)) goal("reviews_out");
    else if (/yandex\.ru\/maps|2gis\.ru/.test(h)) goal("route");
  });
  // «Отключить аналитику»: убираем cookie и записи Метрики. Метрика ставит cookie на домен сайта (.smartmed.clinic),
  // такую cookie удаляет только запись с тем же domain, поэтому стираем и без domain, и на каждый родительский домен
  var forget = function () {
    var h = location.hostname.split("."), doms = [""];
    for (var i = 0; i < h.length - 1; i++) doms.push("; domain=." + h.slice(i).join("."));
    document.cookie.split(";").forEach(function (c) {
      var n = c.split("=")[0].trim();
      if (/^_ym|^yandexuid|^yuidss|^ymex|^i$/.test(n)) doms.forEach(function (d) { document.cookie = n + "=; Max-Age=0; path=/" + d; });
    });
    // записи Метрики в хранилищах браузера (список в справке Метрики: _ym*, ytm_*, zz)
    try { Object.keys(localStorage).forEach(function (k) { if (/^_ym|^ytm_|^zz$/.test(k)) localStorage.removeItem(k); }); } catch (e) {}
    try { Object.keys(sessionStorage).forEach(function (k) { if (/^_ym/.test(k)) sessionStorage.removeItem(k); }); } catch (e) {}
  };

  // плашка: пока она видна, низ подвала можно докрутить из-под неё (--ck-h), на телефоне она стоит над нижней панелью
  var bar, root = document.documentElement;
  var room = function () {
    if (bar && !bar.hidden) { root.classList.add("has-ck"); root.style.setProperty("--ck-h", bar.offsetHeight + 16 + "px"); }
    else { root.classList.remove("has-ck"); root.style.removeProperty("--ck-h"); }
  };
  var hide = function () { if (!bar) return; bar.classList.remove("is-on"); var b = bar; setTimeout(function () { b.hidden = true; room(); }, 400); };
  var show = function (settings) {
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "cookie";
      bar.setAttribute("role", "region");
      bar.setAttribute("aria-label", "Уведомление о cookie");
      bar.hidden = true;
      bar.addEventListener("click", function (e) {
        var b = e.target.closest("[data-ck]");
        if (!b) return;
        var v = b.getAttribute("data-ck");
        hide();
        // «Принять» скрывает плашку; если аналитику отключали, включает её обратно без перезагрузки
        if (v === "all") { set("all"); off = false; load(); }
        // «Отключить аналитику» из «Настроек cookie»: счётчик выключается, его cookie удаляются, на этой странице он уже
        // работал, поэтому перезагружаем её без счётчика; плашка больше не появляется
        else if (v === "off") { set("off"); forget(); location.reload(); }
      });
      addEventListener("resize", room);
      document.body.appendChild(bar);
    }
    // на телефоне короткий текст в две строки (Ilya 01.11): плашка не закрывает кнопку «Записаться» на странице записи
    // «Настройки cookie»: у кого аналитика работает (все, кроме отключивших), кнопка «Отключить аналитику»; «Оставить» скрывает
    // плашку, а если «Принять» ещё не нажимали, засчитывается как «Принять». Тексты слово в слово как до 01.11 (Ilya 01.11)
    var choice = get(), on = settings && loaded && !off, more = '<a href="' + privacy + '#p9">Подробнее<span class="cookie__full"> в Политике конфиденциальности</span></a>';
    bar.innerHTML = on
      ? '<p class="cookie__t">Аналитические cookie включены с вашего согласия. Отключить их можно здесь. ' + more + '</p>'
        + '<div class="cookie__btns"><button class="btn btn--sm btn--ghost" type="button" data-ck="off">Отключить аналитику</button><button class="btn btn--sm" type="button" data-ck="' + (choice === "all" ? "keep" : "all") + '">Оставить</button></div>'
      : '<p class="cookie__t"><span class="cookie__full">Сайт использует технические cookie, а с вашего согласия также аналитические, чтобы делать сайт удобнее для пациентов. </span><span class="cookie__short">Сайт использует cookie, аналитические только с вашего согласия. </span>' + more + '</p>'
        + '<div class="cookie__btns"><button class="btn btn--sm" type="button" data-ck="all">Принять</button></div>';
    bar.hidden = false;
    room();
    requestAnimationFrame(function () { requestAnimationFrame(function () { bar.classList.add("is-on"); }); });
  };
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-cookie-settings]")) { e.preventDefault(); show(true); }
  });
  // выбор в другой вкладке. «Отключить аналитику»: здесь цели и номер посетителя в заявке больше не уходят, а скрытая вкладка,
  // где в полях ничего не набрано, перезагружается без счётчика. «Принять» после отключения включает аналитику и здесь
  var typed = function () {
    return [].some.call(document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not(.hp), textarea"), function (el) { return el.value; });
  };
  addEventListener("storage", function (e) {
    if (e.key !== KEY) return;
    if (OFF.test(e.newValue || "")) { off = true; if (loaded && document.hidden && !typed()) location.reload(); }
    else if (e.newValue === "all" && off) { off = false; load(); }
  });
  // страница, которую кнопка «Назад» достала из кеша вкладки уже после «Отключить аналитику», перезагружается без счётчика
  addEventListener("pageshow", function (e) { if (e.persisted && loaded && OFF.test(get())) location.reload(); });

  var start = function () {
    // очередь целей до согласия из версии сайта до 01.11 больше не нужна
    drop("sessionStorage", "um2-goals");
    // отключившим аналитику: cookie Метрики быть не должно, плашку больше не показываем
    if (off) return forget();
    load();
    // плашка-уведомление, пока не нажали «Принять»; после заставки главной, чтобы не появляться поверх неё
    // если до этого человек сам открыл «Настройки cookie», плашка их не подменяет
    if (get() !== "all") setTimeout(function () { if (get() !== "all" && !off && (!bar || bar.hidden)) show(false); }, root.classList.contains("js-intro") ? 2600 : 900);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
