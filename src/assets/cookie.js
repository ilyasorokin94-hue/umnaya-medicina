// Уведомление о cookie и Яндекс Метрика (Ilya 19.10, формат Юкки Дент).
// Метрика грузится только после «Принять все»; «Только необходимые» её не загружает. Выбор в localStorage «um2-cookie»,
// поменять его можно ссылкой «Настройки cookie» в подвале. Плашка внизу, страницу не закрывает (фид «Врачи» не принимает модальные окна).
// Номер счётчика и адрес политики приходят из тега скрипта: data-ym, data-privacy.
(function () {
  var me = document.currentScript, ID = +(me && me.dataset.ym) || 0, privacy = (me && me.dataset.privacy) || "privacy/";
  var KEY = "um2-cookie";
  var get = function () { try { return localStorage.getItem(KEY); } catch (e) { return "necessary"; } };
  var set = function (v) { try { localStorage.setItem(KEY, v); } catch (e) {} };

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
    window.ym(ID, "init", { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true });
    if (/\/ceny(\/|\.html)?$/.test(location.pathname)) goal("prices");
  };
  // цели Метрики (Ilya 22.10): только после согласия и без имени и телефона. Список целей для кабинета:
  // /mnt/project-files/Заявки_с_сайта/цели_метрики.md
  var goal = function (name, params) { if (loaded && window.ym) window.ym(ID, "reachGoal", name, params); };
  // заявка: общая цель и отдельная по форме (событие um:lead шлёт app.js после отправки)
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
      bar.innerHTML = '<p class="cookie__t">Мы используем cookie: необходимые для работы сайта и, с вашего согласия, Яндекс Метрику, чтобы считать посещения и улучшать сайт. <a href="' + privacy + '">Подробнее в Политике конфиденциальности</a></p>'
        + '<div class="cookie__btns"><button class="btn btn--sm" type="button" data-ck="all">Принять все</button><button class="btn btn--sm btn--ghost" type="button" data-ck="necessary">Только необходимые</button></div>';
      bar.addEventListener("click", function (e) {
        var b = e.target.closest("[data-ck]");
        if (!b) return;
        var was = get(), v = b.getAttribute("data-ck");
        set(v);
        hide();
        if (v === "all") load();
        else if (was === "all") { forget(); location.reload(); }
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
