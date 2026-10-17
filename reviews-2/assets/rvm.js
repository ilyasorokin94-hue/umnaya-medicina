// Отзывы на телефоне (до 760px). Компьютер не трогаем: там ленты из app.js.
// Вариант 2. Крупные цитаты: пока цитата проходит экран, её слова по очереди проявляются из бледных.
// «Ещё отзывы» открывает следующие шесть.
(() => {
  const box = document.querySelector(".rvm--words");
  if (!box) return;
  const G = window.gsap, ST = window.ScrollTrigger;
  const anim = !!(G && ST) && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const more = box.querySelector(".rvw__more");
  const STEP = 6;

  // слова в span, выделенная фраза <em> сохраняется; неразрывные пробелы не трогаем
  const split = (el) => {
    const walk = (node) => [...node.childNodes].forEach((n) => {
      if (n.nodeType !== 3) return walk(n);
      const f = document.createDocumentFragment();
      n.textContent.split(/([ \t\n]+)/).forEach((part) => {
        if (!part) return;
        if (/^[ \t\n]+$/.test(part)) return f.append(part);
        const s = document.createElement("span");
        s.className = "rvw__w"; s.textContent = part; f.append(s);
      });
      n.replaceWith(f);
    });
    walk(el);
    return el.querySelectorAll(".rvw__w");
  };
  const mm = anim ? G.matchMedia() : null;
  const play = (q) => {
    if (!anim || q.dataset.rvw) return;
    q.dataset.rvw = "1";
    const words = split(q);
    mm.add("(max-width: 760px)", () => {
      G.fromTo(words, { opacity: 0.14, y: 6 }, { opacity: 1, y: 0, stagger: 0.12, ease: "none", scrollTrigger: { trigger: q, start: "top 86%", end: "bottom 56%", scrub: true } });
    });
  };
  const shown = () => [...box.querySelectorAll(".rvw:not([hidden])")];
  shown().forEach(play);
  const rest = () => box.querySelectorAll(".rvw[hidden]").length;
  if (!rest()) more.hidden = true;
  more.addEventListener("click", () => {
    [...box.querySelectorAll(".rvw[hidden]")].slice(0, STEP).forEach((q) => { q.hidden = false; play(q); });
    if (!rest()) more.hidden = true;
    if (ST) ST.refresh();
  });
})();
