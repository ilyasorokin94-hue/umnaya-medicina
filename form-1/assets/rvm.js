// Отзывы на телефоне (до 760px). Компьютер не трогаем: там ленты из app.js.
// Вариант 1. Стопка карточек: верхнюю смахивают пальцем влево или вправо (или кнопкой «Следующий»),
// она улетает и ложится под низ стопки, следующая поднимается на её место.
(() => {
  const deck = document.querySelector(".rvs");
  if (!deck) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const next = document.querySelector(".rvs__next");
  const cards = [...deck.children];
  const DEPTH = 3, STEP = 17, SHRINK = 0.055;
  let busy = false;
  deck.classList.add("rvs--on");

  const pose = (c, k) => { c.style.transform = `translateY(${k * STEP}px) scale(${1 - k * SHRINK})`; };
  const place = (skip) => cards.forEach((c, i) => {
    if (c === skip) return;
    c.style.zIndex = String(100 - i);
    c.style.opacity = i < DEPTH ? "1" : "0";
    c.setAttribute("aria-hidden", i ? "true" : "false");
    pose(c, Math.min(i, DEPTH));
  });
  place();

  const fly = (dir) => {
    if (busy) return;
    busy = true;
    const c = cards.shift();
    cards.push(c);
    c.classList.remove("is-drag");
    c.style.transition = "transform .5s cubic-bezier(.3,.5,.3,1), opacity .5s";
    c.style.transform = `translate(${dir * (innerWidth + 60)}px, -30px) rotate(${dir * 16}deg)`;
    c.style.opacity = "0";
    place(c);
    setTimeout(() => {
      c.style.transition = "none";
      place();
      void c.offsetWidth;
      c.style.transition = "";
      busy = false;
    }, reduce ? 0 : 480);
  };

  // перетаскивание: по горизонтали карточка идёт за пальцем, по вертикали страница прокручивается как обычно
  let x0 = 0, dx = 0, drag = false;
  deck.addEventListener("pointerdown", (e) => {
    if (busy || !e.isPrimary || !cards[0].contains(e.target)) return;
    drag = true; x0 = e.clientX; dx = 0;
    cards[0].classList.add("is-drag"); cards[1].classList.add("is-drag");
    try { deck.setPointerCapture(e.pointerId); } catch (_) {}
  });
  deck.addEventListener("pointermove", (e) => {
    if (!drag) return;
    dx = e.clientX - x0;
    cards[0].style.transform = `translateX(${dx}px) rotate(${dx * 0.05}deg)`;
    const k = Math.min(1, Math.abs(dx) / 170);
    pose(cards[1], 1 - k);
  });
  const up = () => {
    if (!drag) return;
    drag = false;
    cards[0].classList.remove("is-drag"); cards[1].classList.remove("is-drag");
    if (Math.abs(dx) > 70) fly(Math.sign(dx)); else place();
  };
  deck.addEventListener("pointerup", up);
  deck.addEventListener("pointercancel", up);
  next && next.addEventListener("click", () => fly(-1));

  // при первом показе верхняя карточка чуть отъезжает и возвращается: видно, что её можно смахнуть
  if (!reduce && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      setTimeout(() => {
        if (busy || drag) return;
        cards[0].style.transform = "translateX(-54px) rotate(-4deg)";
        pose(cards[1], 0.6);
        setTimeout(() => { if (!drag) place(); }, 520);
      }, 350);
    }, { threshold: 0.7 });
    io.observe(deck);
  }
})();
