# Умная Медицина. Стоматология

Макет нового сайта стоматологии «Умная Медицина» (Удельная, ул. Громова, 10/2). Версия 2 повторяет механику одностраничника Lava Dental (lavadental.lv): заставка, анимации при прокрутке, горизонтальная лента преимуществ, работы «до/после», услуги с номерами, команда, прайс по вкладкам, FAQ по темам и отдельная пошаговая онлайн-запись.

- Превью: https://ilyasorokin94-hue.github.io/umnaya-medicina/ (GitHub Pages из ветки `gh-pages`)
- Исходники: `src/data.mjs` (услуги, цены, врачи, тексты), `src/assets/` (стили и скрипты), `src/images/` (логотип, фото, сгенерированные картинки), `scripts/build.mjs` (сборка)
- Анимации: GSAP + ScrollTrigger и Lenis из `node_modules`, копируются в `assets/vendor` при сборке

## Ветка variant-2: главная по образцу Тридента

Отдельный вариант главной, старый сайт в `main` не трогает. Порядок из 9 блоков взят с trydentspb.ru, вид и механика прежние (Lava Dental): первый экран с тремя фактами и акцией, услуги вкладками с ценами «от», клиника и оборудование, путь пациента, врачи, отзывы, три вопроса, контакты. Тексты главной лежат в `v2` в `src/data.mjs`.

- Превью: https://ilyasorokin94-hue.github.io/umnaya-medicina/variant-2/ (папка `variant-2/` в ветке `gh-pages`)
- Сборка та же: `node scripts/build.mjs` → `dist/`, затем содержимое `dist/` кладётся в `variant-2/` поверх `gh-pages` отдельным коммитом, без `push -f`.

## Сборка и публикация

Перед первой сборкой нужен `npm install`: сборка переводит фото в WebP (sharp) и сжимает стили и скрипты (esbuild). В `dist/` попадают только картинки, на которые ссылаются страницы, шрифты лежат в `src/fonts` (без Google Fonts). Обычная сборка даёт демо (noindex, полоса «демонстрационный макет»); для боевого домена `PUBLISH=1 SITE_URL=https://домен npm run build` открывает страницы поисковикам и пишет robots.txt с картой сайта.

```
npm install
npm run build              # → dist/
rm -rf docs && cp -r dist docs && git add -A docs && git commit -m "Превью"
git push origin main
git branch -D gh-pages; git subtree split --prefix docs -b gh-pages && git push origin gh-pages
```

Картинки: если файл из `pics` в `src/data.mjs` лежит в `src/images/`, сборка берёт его, иначе подставляет фото с um-med.com или ПроДокторов.

Цены перенесены с um-med.com/prices/ на 15.10.2026. Акции и сроки ждут согласования с клиникой. Страницы закрыты от индексации (noindex).
