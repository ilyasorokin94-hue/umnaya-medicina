# Умная Медицина. Стоматология

Макет нового сайта стоматологии «Умная Медицина» (Удельная, ул. Громова, 10/2). Версия 2 повторяет механику одностраничника Lava Dental (lavadental.lv): заставка, анимации при прокрутке, горизонтальная лента преимуществ, работы «до/после», услуги с номерами, команда, прайс по вкладкам, FAQ по темам и отдельная пошаговая онлайн-запись.

- Превью: https://ilyasorokin94-hue.github.io/umnaya-medicina/ (GitHub Pages из ветки `gh-pages`)
- Исходники: `src/data.mjs` (услуги, цены, врачи, тексты), `src/assets/` (стили и скрипты), `src/images/` (логотип, фото, сгенерированные картинки), `scripts/build.mjs` (сборка)
- Анимации: GSAP + ScrollTrigger и Lenis из `node_modules`, копируются в `assets/vendor` при сборке

## Сборка и публикация

```
npm install
npm run build              # → dist/
rm -rf docs && cp -r dist docs && git add -A docs && git commit -m "Превью"
git push origin main
git branch -D gh-pages; git subtree split --prefix docs -b gh-pages && git push origin gh-pages
```

Картинки: если файл из `pics` в `src/data.mjs` лежит в `src/images/`, сборка берёт его, иначе подставляет фото с um-med.com или ПроДокторов.

Цены перенесены с um-med.com/prices/ на 15.10.2026. Акции и сроки ждут согласования с клиникой. Страницы закрыты от индексации (noindex).
