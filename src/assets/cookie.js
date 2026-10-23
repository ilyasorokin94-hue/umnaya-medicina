// Уведомление о cookie и Яндекс Метрика (Ilya 19.10, формат Юкки Дент; 23.10 схема как у Зубной Гармонии).
// Метрика грузится только после «Принять»; «Нет» её не загружает. Выбор в localStorage «um2-cookie»,
// поменять его можно ссылкой «Настройки cookie» в подвале. Плашка внизу, страницу не закрывает (фид «Врачи» не принимает модальные окна).
// До согласия источник визита и важные цели лежат только в браузере. После «Принять» Метрика получает визит с начала,
// поэтому заход из Яндекс Карт, Бизнеса или Директа не теряется, даже если человек согласился на третьей странице.
// Номер счётчика и адрес политики приходят из тега скрипта: data-ym, data-privacy.
(function () {
  var me = document.currentScript, ID = +(me && me.dataset.ym) || 0, privacy = (me && me.dataset.privacy) || "privacy/";
  var KEY = "um2-cookie";
  var get = function () { try { return localStorage.getItem(KEY); } catch (e) { return "necessary"; } };
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
  var load = function () {
    if (loaded || !ID) return;
    loaded = true;
    mask();
    (function (m, e, t, r, i, k, a) { m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); }; m[i].l = 1 * new Date(); k = e.createElement(t); a = e.getElementsByTagName(t)[0]; k.async = 1; k.src = r; a.parentNode.insertBefore(k, a); })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
    var opt = { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true };
    var here = location.pathname + location.search;
    if (!visit.ym && visit.landing && visit.landing !== here) {
      // согласие не на странице входа: визит начинается с неё, с исходным referrer и метками utm/yclid,
      // иначе Метрика запишет его как переход внутри сайта и не свяжет с Яндекс Картами, Бизнесом или Директом
      var first = location.origin + visit.landing;
      opt.defer = true;
      window.ym(ID, "init", opt);
      window.ym(ID, "hit", first, { referer: visit.ref || "", title: visit.lt || "" });
      window.ym(ID, "hit", location.href, { referer: first, title: document.title });
    } else window.ym(ID, "init", opt);
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
  // Пока человек не выбрал в плашке, заявка, звонок, мессенджер и маршрут ждут в браузере до конца визита
  // и уходят, если он нажмёт «Принять». После «Нет» ничего не копим.
  var WAIT = /^(lead|phone|messenger|route)/;
  var goal = function (name, params) {
    if (loaded && window.ym) return window.ym(ID, "reachGoal", name, params);
    if (!ID || get() || !WAIT.test(name)) return;
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
  // отказ после согласия: убираем cookie и записи Метрики
  var forget = function () {
    document.cookie.split(";").forEach(function (c) {
      var n = c.split("=")[0].trim();
      if (/^_ym|^yandexuid|^yuidss|^ymex|^i$/.test(n)) document.cookie = n + "=; Max-Age=0; path=/";
    });
    try { Object.keys(localStorage).forEach(function (k) { if (/^_ym/.test(k)) localStorage.removeItem(k); }); } catch (e) {}
  };

  var bar;
  var hide = function () { if (!bar) return; bar.classList.remove("is-on"); var b = bar; setTimeout(function () { b.hidden = true; }, 400); };
  var show = function () {
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "cookie";
      bar.setAttribute("role", "region");
      bar.setAttribute("aria-label", "Уведомление о cookie");
      bar.hidden = true;
      bar.innerHTML = '<p class="cookie__t">Мы используем cookie: необходимые для работы сайта и, с вашего согласия, Яндекс Метрику, чтобы считать посещения и улучшать сайт. <a href="' + privacy + '#p9">Подробнее в Политике конфиденциальности</a></p>'
        + '<div class="cookie__btns"><button class="btn btn--sm" type="button" data-ck="all">Принять</button><button class="btn btn--sm btn--ghost" type="button" data-ck="necessary">Нет</button></div>';
      bar.addEventListener("click", function (e) {
        var b = e.target.closest("[data-ck]");
        if (!b) return;
        var was = get(), v = b.getAttribute("data-ck");
        set(v);
        hide();
        if (v === "all") load();
        else {
          drop("sessionStorage", "um2-goals");
          if (was === "all") { forget(); location.reload(); }
        }
      });
      document.body.appendChild(bar);
    }
    bar.hidden = false;
    requestAnimationFrame(function () { requestAnimationFrame(function () { bar.classList.add("is-on"); }); });
  };
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-cookie-settings]")) { e.preventDefault(); show(); }
  });

  var start = function () {
    var v = get();
    if (v === "all") load();
    // плашка после заставки главной, чтобы не появляться поверх неё
    else if (v !== "necessary") setTimeout(show, document.documentElement.classList.contains("js-intro") ? 2600 : 900);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
