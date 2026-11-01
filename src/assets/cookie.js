// Уведомление о cookie и Яндекс Метрика (Ilya 19.10, формат Юкки Дент; 23.10 схема как у Зубной Гармонии).
// Текст плашки без названия сервиса, общими словами (Ilya 31.10); сервис назван в Политике, раздел 9.
// Одна кнопка «Принять» (Ilya 23.10): до неё Метрика не грузится и к Яндексу запросов нет, плашка видна на каждой странице.
// Согласие в localStorage «um2-cookie» = "all"; отозвать его можно ссылкой «Настройки cookie» в подвале.
// Плашка внизу, страницу не закрывает (фид «Врачи» не принимает модальные окна) и не закрывает кнопки записи.
// До согласия источник визита и важные цели лежат только в браузере. После «Принять» Метрика получает визит с начала,
// поэтому заход из Яндекс Карт, Бизнеса или Директа не теряется, даже если человек согласился на третьей странице.
// Номер счётчика и адрес политики приходят из тега скрипта: data-ym, data-privacy. Сам код счётчика стоит в <head> неактивным
// (script type="text/plain" id="um-ym", чтобы проверка Яндекс Бизнеса, если она читает HTML, видела счётчик), запускает его load() после «Принять».
(function () {
  var me = document.currentScript, ID = +(me && me.dataset.ym) || 0, privacy = (me && me.dataset.privacy) || "privacy/";
  var KEY = "um2-cookie";
  var get = function () { try { return localStorage.getItem(KEY); } catch (e) { return ""; } };
  var set = function (v) { try { localStorage.setItem(KEY, v); } catch (e) {} };
  // хранилища браузера: в приватном режиме или при запрете данных сайтов чтение и запись бросают ошибку
  var read = function (kind, k) { try { return JSON.parse(window[kind].getItem(k) || "null"); } catch (e) { return null; } };
  var write = function (kind, k, v) { try { window[kind].setItem(k, JSON.stringify(v)); } catch (e) {} };
  var drop = function (kind, k) { try { window[kind].removeItem(k); } catch (e) {} };

  // ---------- откуда пришёл ----------
  // Визит вкладки (sessionStorage «um2-src»): первая страница, сайт, с которого пришли, метки. Заход с метками или с другого сайта
  // начинает визит заново. Такой заход ещё 30 дней лежит в localStorage «um2-src30»: если человек вернётся по закладке и оставит
  // заявку, в amoCRM будет видно, откуда он пришёл (как «последний значимый переход» в Метрике). Без заявки и согласия никуда не уходит.
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

  // поля заявок и набранный номер в подвале не попадают в запись Вебвизора
  var mask = function () {
    document.querySelectorAll("input, textarea").forEach(function (el) { el.classList.add("ym-disable-keys"); });
    document.querySelectorAll(".big__ghost, .modal__doc").forEach(function (el) { el.classList.add("ym-hide-content"); });
  };
  var loaded = false;
  // Код счётчика стоит в <head> каждой страницы неактивным: <script type="text/plain" id="um-ym"> (scripts/build.mjs, Яндекс Бизнес 01.11).
  // Браузер такой блок не исполняет: до «Принять» tag.js не грузится и cookie Метрики нет, а проверка, которая читает HTML, видит код счётчика.
  // После согласия запускаем копию блока; defer для init передаём через window.umYmDefer. Если блока нет на странице
  // или он не выполнился (CSP без 'unsafe-inline'), грузим tag.js отсюда, как раньше, с теми же параметрами
  var run = function (opt) {
    var code = document.getElementById("um-ym");
    window.umYmDefer = !!opt.defer;
    if (code && !window.ym) {
      var s = document.createElement("script");
      s.text = code.text;
      code.parentNode.insertBefore(s, code.nextSibling);
      if (window.ym) return;
    }
    (function (m, e, t, r, i, k, a) { m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); }; m[i].l = 1 * new Date(); k = e.createElement(t); a = e.getElementsByTagName(t)[0]; k.async = 1; k.src = r; a.parentNode.insertBefore(k, a); })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js?id=" + ID, "ym");
    window.ym(ID, "init", opt);
  };
  var load = function () {
    if (loaded || !ID) return;
    loaded = true;
    mask();
    // параметры те же, что в блоке um-ym (scripts/build.mjs, ymCode): нужны запасному пути и для defer
    var opt = { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true };
    var here = location.pathname + location.search;
    if (!visit.ym && visit.landing && visit.landing !== here) {
      // согласие не на странице входа: визит начинается с неё, с исходным referrer и метками utm/yclid,
      // иначе Метрика запишет его как переход внутри сайта и не свяжет с Яндекс Картами, Бизнесом или Директом
      var first = location.origin + visit.landing;
      opt.defer = true;
      run(opt);
      window.ym(ID, "hit", first, { referer: visit.ref || "", title: visit.lt || "" });
      window.ym(ID, "hit", location.href, { referer: first, title: document.title });
    } else run(opt);
    // со следующих страниц визита Метрика ведёт его сама, по своим cookie
    if (!visit.ym) { visit.ym = 1; write("sessionStorage", "um2-src", visit); }
    if (/\/ceny(\/|\.html)?$/.test(location.pathname)) goal("prices");
    // цели, которые случились в этом визите до согласия
    var wait = read("sessionStorage", "um2-goals") || [];
    drop("sessionStorage", "um2-goals");
    wait.forEach(function (g) { goal(g[0], g[1] || undefined); });
  };
  // цели Метрики (Ilya 22.10): только после согласия и без имени и телефона. Список целей для кабинета:
  // /mnt/project-files/Заявки_с_сайта/цели_метрики.md
  // Пока человек не нажал «Принять», заявка, звонок, мессенджер и маршрут ждут в браузере до конца визита
  // и уходят, если он нажмёт «Принять» на этой или следующей странице.
  var WAIT = /^(lead|phone|messenger|route)/;
  var goal = function (name, params) {
    if (loaded && window.ym) return window.ym(ID, "reachGoal", name, params);
    if (!ID || !WAIT.test(name)) return;
    var wait = read("sessionStorage", "um2-goals") || [];
    if (wait.length < 20) { wait.push([name, params || null]); write("sessionStorage", "um2-goals", wait); }
  };
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
  // отказ после согласия: убираем cookie и записи Метрики. Метрика ставит cookie на домен сайта (.smartmed.clinic),
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
  var show = function () {
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
        if (v === "all") { set("all"); load(); }
        // отзыв согласия из «Настроек cookie»: Метрика выключается, её cookie удаляются, плашка снова на каждой странице
        else if (v === "off") { set("off"); drop("sessionStorage", "um2-goals"); forget(); location.reload(); }
      });
      addEventListener("resize", room);
      document.body.appendChild(bar);
    }
    // на телефоне короткий текст в две строки (Ilya 01.11): плашка не закрывает кнопку «Записаться» на странице записи
    var on = get() === "all", more = '<a href="' + privacy + '#p9">Подробнее<span class="cookie__full"> в Политике конфиденциальности</span></a>';
    bar.innerHTML = on
      ? '<p class="cookie__t">Аналитические cookie включены с вашего согласия. Отключить их можно здесь. ' + more + '</p>'
        + '<div class="cookie__btns"><button class="btn btn--sm btn--ghost" type="button" data-ck="off">Отключить аналитику</button><button class="btn btn--sm" type="button" data-ck="keep">Оставить</button></div>'
      : '<p class="cookie__t"><span class="cookie__full">Сайт использует технические cookie, а с вашего согласия также аналитические, чтобы делать сайт удобнее для пациентов. </span><span class="cookie__short">Сайт использует cookie, аналитические только с вашего согласия. </span>' + more + '</p>'
        + '<div class="cookie__btns"><button class="btn btn--sm" type="button" data-ck="all">Принять</button></div>';
    bar.hidden = false;
    room();
    requestAnimationFrame(function () { requestAnimationFrame(function () { bar.classList.add("is-on"); }); });
  };
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-cookie-settings]")) { e.preventDefault(); show(); }
  });

  var start = function () {
    if (get() === "all") return load();
    // без согласия cookie Метрики быть не должно: подчищаем то, что осталось после отзыва прежней версией сайта
    forget();
    // плашка после заставки главной, чтобы не появляться поверх неё
    setTimeout(show, root.classList.contains("js-intro") ? 2600 : 900);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
