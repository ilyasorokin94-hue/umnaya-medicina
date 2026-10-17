// Отзывы на телефоне (до 760px). Компьютер не трогаем: там ленты из app.js.
// Вариант 4. Карусель: карточка в центре крупная, соседние уменьшаются, наклоняются и бледнеют
// пропорционально расстоянию до центра.
(() => {
  const row = document.querySelector(".rvf");
  if (!row) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cards = [...row.children];
  let raf = 0;
  const upd = () => {
    raf = 0;
    const mid = row.scrollLeft + row.clientWidth / 2;
    cards.forEach((c) => {
      const w = c.offsetWidth + 12;
      const d = Math.max(-1.6, Math.min(1.6, (c.offsetLeft + c.offsetWidth / 2 - mid) / w));
      const a = Math.min(1, Math.abs(d));
      c.style.transform = `translateY(${a * 14}px) rotate(${d * 3}deg) scale(${1 - a * 0.08})`;
      c.firstElementChild.style.opacity = String(1 - a * 0.55);
    });
  };
  const ask = () => { if (!raf) raf = requestAnimationFrame(upd); };
  if (!reduce) {
    row.addEventListener("scroll", ask, { passive: true });
    addEventListener("resize", ask);
    upd();
  }
  // при первом показе лента сама переходит ко второму отзыву: видно, что её листают
  if (!reduce && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      setTimeout(() => { if (row.scrollLeft < 10) row.scrollTo({ left: cards[1].offsetLeft + cards[1].offsetWidth / 2 - row.clientWidth / 2, behavior: "smooth" }); }, 600);
    }, { threshold: 0.75 });
    io.observe(row);
  }
})();
