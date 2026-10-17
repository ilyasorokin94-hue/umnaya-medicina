// Отзывы на телефоне (до 760px). Компьютер не трогаем: там ленты из app.js.
// Вариант 3. Переписка: сообщения всплывают по одному, когда доходят до экрана; «Ещё отзывы» присылает следующие.
(() => {
  const box = document.querySelector(".rvc");
  if (!box) return;
  const G = window.gsap, ST = window.ScrollTrigger;
  const anim = !!(G && ST) && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const more = box.querySelector(".rvc__more");
  const STEP = 5;
  const pop = (els, delay = 0) => G.fromTo(els, { opacity: 0, y: 26, scale: 0.86 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: "back.out(1.7)", stagger: 0.32, delay, overwrite: true });
  if (anim) {
    const mm = G.matchMedia();
    mm.add("(max-width: 760px)", () => {
      const msgs = [...box.querySelectorAll(".rvc__msg:not([hidden])")];
      G.set(msgs, { opacity: 0 });
      ST.batch(msgs, { start: "top 92%", once: true, onEnter: (els) => pop(els) });
      return () => G.set(box.querySelectorAll(".rvc__msg"), { clearProps: "all" });
    });
  }
  const rest = () => [...box.querySelectorAll(".rvc__msg[hidden]")];
  if (!rest().length) more.hidden = true;
  more.addEventListener("click", () => {
    const add = rest().slice(0, STEP);
    add.forEach((m) => { m.hidden = false; });
    if (!rest().length) more.hidden = true;
    if (anim) pop(add, 0.1);
    if (ST) ST.refresh();
  });
})();
