// Отзывы на телефоне (до 760px). Компьютер не трогаем: там ленты из app.js.
// Вариант 5. Мозаика: карточки поднимаются группами по мере прокрутки, затем маркер проводит по главной фразе.
// «Ещё отзывы» открывает следующие.
(() => {
  const box = document.querySelector(".rvm--mosaic");
  if (!box) return;
  const G = window.gsap, ST = window.ScrollTrigger;
  const anim = !!(G && ST) && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const more = box.querySelector(".rvx__more");
  const STEP = 8;
  const rise = (els) => G.fromTo(els, { opacity: 0, y: 46, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: "power3.out", stagger: 0.12, overwrite: true, onStart() { els.forEach((c) => c.classList.add("is-in")); } });
  const watch = (els) => {
    if (!anim) return els.forEach((c) => c.classList.add("is-in"));
    G.set(els, { opacity: 0 });
    ST.batch(els, { start: "top 90%", once: true, onEnter: rise });
  };
  if (anim) {
    const mm = G.matchMedia();
    mm.add("(max-width: 760px)", () => {
      watch([...box.querySelectorAll(".rvx__card:not([hidden])")]);
      return () => G.set(box.querySelectorAll(".rvx__card"), { clearProps: "all" });
    });
  } else watch([...box.querySelectorAll(".rvx__card")]);
  const rest = () => [...box.querySelectorAll(".rvx__card[hidden]")];
  if (!rest().length) more.hidden = true;
  more.addEventListener("click", () => {
    const add = rest().slice(0, STEP);
    add.forEach((c) => { c.hidden = false; });
    if (!rest().length) more.hidden = true;
    if (ST) ST.refresh();
    watch(add);
  });
})();
