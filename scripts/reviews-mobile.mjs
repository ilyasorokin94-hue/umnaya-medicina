// Отзывы на телефоне (до 760px): вместо двух лент свой блок. Компьютер показывает прежние ленты.
// Тексты отзывов не меняем: только порядок и выделение главной фразы в каждом.

// порядок на телефоне: первыми самые убедительные (номера в home.reviews)
export const ORDER = [1, 14, 4, 3, 13, 10, 5, 7, 11, 0, 2, 6, 9, 12, 15, 16, 17, 8];
// главная фраза отзыва, дословно из текста
export const KEYS = {
  0: "зафиксировали стоимость", 1: "только тут взялись за лечение", 2: "всегда вовремя", 3: "золотые руки",
  4: "страха не осталось", 5: "всей семьей", 6: "быстро приняли", 7: "персональный куратор лечения",
  8: "очень боялся стоматологов", 9: "на месте", 10: "прошла безболезненно", 11: "Любые вопросы решают быстро и качественно.",
  12: "легким движением руки", 13: "ни разу не пришлось ждать", 14: "Меня вели два доктора", 15: "Чисто, аккуратно и быстро.",
  16: "аккуратно и безболезненно", 17: "безболезненно",
};
// «цитата» с главной фразой в <mark> (tag задаёт обёртку)
export const quote = (reviews, i, esc, tag = "mark") => {
  const q = reviews[i], k = KEYS[i], at = k ? q.indexOf(k) : -1;
  if (at < 0) return `«${esc(q)}»`;
  return `«${esc(q.slice(0, at))}<${tag}>${esc(k)}</${tag}>${esc(q.slice(at + k.length))}»`;
};
export const size = (q) => (q.length > 110 ? "long" : q.length < 60 ? "short" : "mid");

// Вариант 1. Стопка карточек: верхнюю смахивают пальцем, она улетает и уходит под низ стопки
const TONES = ["ink", "green", "sage", "white"];
export const reviewsMobile = (reviews, esc) => `<div class="rvm rvm--stack">
    <div class="rvs" role="group" aria-label="Отзывы пациентов">
      ${ORDER.map((i, n) => `<figure class="rvs__card rvs__card--${size(reviews[i])}" data-tone="${TONES[n % TONES.length]}"><blockquote>${quote(reviews, i, esc, "b")}</blockquote></figure>`).join("\n      ")}
    </div>
    <div class="rvs__bar"><p class="rvs__hint">Смахните отзыв, чтобы прочитать следующий</p><button class="btn btn--sm rvs__next" type="button">Следующий</button></div>
  </div>`;
