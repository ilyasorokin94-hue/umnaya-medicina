// Страницы услуг нового формата (Ilya 17.10): адреса как в плане сайта (/implantaciya/, /implantaciya/all-on-4/),
// первый экран со своей картинкой и крупными ценами, как на главной.
// Здесь шапка страницы: адрес, крошки, картинка, цифры первого экрана и ссылки «В разделе». Title, Description, H1 и весь
// текст — в src/service-texts/<slug>.md (тексты SEO-треда, раскладывает scripts/import-service-texts.mjs).
// Цены только с um-med.com (прайс на 17.10.2026). Картинка первого экрана: images/svc-hero/<slug>.png (ChatGPT).

const hero = (slug) => [`images/svc-hero/${slug}.png`];

export const servicePriceDate = "17.10.2026";

// цены, которые до ответа клиники не показываем: в тексте и прайсе вместо них плашка «цена уточняется»,
// с PUBLISH=1 сборка не пройдёт. Плашкой заменяется только сама цена в найденном куске. Когда клиника ответит — убрать строку здесь
// (и поправить текст, если цифра другая)
export const servicePriceHold = [
  [/(?:от )?(?:32 900|35 100) ₽/g, "цельноциркониевая коронка на имплант: на um-med.com 32 900 ₽ («Ортопедия») и 35 100 ₽ («Имплантация»)"],
  // «Консультация … — 500 ₽», «консультации (500 ₽)», «— **500 ₽**», «приём ортопеда … стоит 500 ₽»; «4 500 ₽» и снимки за 500 ₽ не трогаем
  [/(?:консультаци|при[её]м (?:врача-)?(?:ортопеда|хирурга|имплантолога))[^.;|\n[\]()₽]{0,90}?(?<!\d)(?:\s*—\s*|\s+|\s*\()(?:\*\*)?500 ₽/gi, "консультация: 0 или 500 ₽"],
];

export const servicePages = [
  {
    slug: "implantaciya", path: "implantaciya/", old: "implantaciya", crumb: "Имплантация зубов", procedure: "Имплантация зубов", hero: hero("implantaciya"),
    facts: [["от 19 300 ₽","установка импланта"], ["4 500 ₽","КТ двух челюстей"], ["4 системы","Osstem, Dentium, Straumann, Riellen's"], ["3 врача","хирург, ортопед и терапевт составляют план"]],
    nav: [["All-on-4","implantaciya/all-on-4/"], ["All-on-6","implantaciya/all-on-6/"], ["Вся челюсть на имплантах","implantaciya/vsya-chelyust/"], ["Коронка на имплант","implantaciya/koronka-na-implant/"], ["Синус-лифтинг","implantaciya/sinus-lifting/"], ["Костная пластика","implantaciya/kostnaya-plastika/"]],
  },
  {
    slug: "all-on-4", path: "implantaciya/all-on-4/", old: "all-on-4", parent: "implantaciya", crumb: "All-on-4", procedure: "All-on-4", hero: hero("all-on-4"),
    facts: [["от 114 000 ₽","хирургический этап"], ["от 77 000 ₽","временный протез по акции"], ["КТ и 3D-план","до операции, при необходимости шаблон"], ["3 врача","хирург, ортопед и терапевт составляют план"]],
    factsNote: "[УТОЧНИТЬ У КЛИНИКИ: срок акции на временный протез]",
  },
  {
    slug: "all-on-6", path: "implantaciya/all-on-6/", parent: "implantaciya", crumb: "All-on-6", procedure: "All-on-6", hero: hero("all-on-6"),
    facts: [["от 166 100 ₽","хирургический этап"], ["от 77 000 ₽","временный протез по акции"], ["от 148 500 ₽","постоянный протез"], ["3 врача","хирург, ортопед и терапевт составляют план"]],
    factsNote: "[УТОЧНИТЬ У КЛИНИКИ: срок акции на временный протез]",
  },
  {
    slug: "vsya-chelyust", path: "implantaciya/vsya-chelyust/", parent: "implantaciya", crumb: "Протез на имплантах", procedure: "Протез на имплантах", hero: hero("vsya-chelyust"),
    facts: [["4, 6 или 8","имплантов на челюсть, решает хирург по КТ"], ["от 114 000 ₽","хирургический этап All-on-4"], ["от 77 000 ₽","временный протез по акции"], ["3 врача","хирург, ортопед и терапевт составляют план"]],
    nav: [["All-on-4","implantaciya/all-on-4/"], ["All-on-6 и All-on-8","implantaciya/all-on-6/"], ["Коронка на имплант","implantaciya/koronka-na-implant/"]],
  },
  {
    slug: "koronka-na-implant", path: "implantaciya/koronka-na-implant/", parent: "implantaciya", crumb: "Коронка на имплант", procedure: "Коронка на имплант", hero: hero("koronka-na-implant"),
    facts: [["от 27 400 ₽","металлокерамическая коронка на имплант"], ["от 13 000 ₽","временная коронка CAD/CAM"], ["2 200 ₽","3D-сканирование челюстей"], ["3 врача","хирург, ортопед и терапевт составляют план"]],
  },
  {
    slug: "sinus-lifting", path: "implantaciya/sinus-lifting/", parent: "implantaciya", crumb: "Синус-лифтинг", procedure: "Синус-лифтинг", hero: hero("sinus-lifting"),
    facts: [["от 22 000 ₽","закрытый синус-лифтинг"], ["от 33 000 ₽","открытый синус-лифтинг"], ["4 500 ₽","КТ челюстей и пазух"], ["3 врача","хирург, ортопед и терапевт составляют план"]],
  },
  {
    slug: "kostnaya-plastika", path: "implantaciya/kostnaya-plastika/", parent: "implantaciya", crumb: "Костная пластика", procedure: "Костная пластика", hero: hero("kostnaya-plastika"),
    facts: [["от 55 000 ₽","пластика блоками: работа, анестезия, материал и 2 винта"], ["от 19 700 ₽","подсадка Bio-Oss"], ["4 500 ₽","КТ двух челюстей"], ["3 врача","хирург, ортопед и терапевт составляют план"]],
  },
  {
    slug: "protezirovanie", path: "protezirovanie/", old: "protezirovanie", crumb: "Протезирование зубов", procedure: "Протезирование зубов", hero: hero("protezirovanie"),
    facts: [["от 26 400 ₽","металлокерамическая коронка"], ["от 31 900 ₽","съёмный протез"], ["от 58 300 ₽","бюгельный протез"], ["3 врача","хирург, ортопед и терапевт составляют план"]],
    nav: [["Коронки","protezirovanie/koronki/"], ["Циркониевые коронки","protezirovanie/koronki/cirkoniy/"], ["Съёмные протезы","protezirovanie/semnye-protezy/"], ["Бюгельный протез","protezirovanie/byugelnyj-protez/"], ["Протез на имплантах","implantaciya/vsya-chelyust/"], ["Коронка на имплант","implantaciya/koronka-na-implant/"]],
  },
  {
    slug: "semnye-protezy", path: "protezirovanie/semnye-protezy/", parent: "protezirovanie", crumb: "Съёмные протезы", procedure: "Съёмные зубные протезы", hero: hero("semnye-protezy"),
    facts: [["от 31 900 ₽","частичный или полный съёмный протез"], ["от 22 550 ₽","иммедиат-протез на 1–3 зуба"], ["от 53 900 ₽","эластичный протез Acry Free"], ["от 13 750 ₽","починка и перебазировка"]],
    nav: [["Бюгельный протез","protezirovanie/byugelnyj-protez/"], ["Протез на имплантах","implantaciya/vsya-chelyust/"]],
  },
  {
    slug: "byugelnyj-protez", path: "protezirovanie/byugelnyj-protez/", parent: "protezirovanie", crumb: "Бюгельный протез", procedure: "Бюгельный протез", hero: hero("byugelnyj-protez"),
    facts: [["от 58 300 ₽","бюгельный протез простой"], ["2 вида","крепления: кламмеры или замки"], ["от 13 750 ₽","починка и перебазировка"], ["3 врача","хирург, ортопед и терапевт составляют план"]],
  },
  {
    slug: "koronki", path: "protezirovanie/koronki/", parent: "protezirovanie", crumb: "Коронки", procedure: "Коронки на зубы", hero: hero("koronki"),
    facts: [["от 26 400 ₽","металлокерамическая коронка"], ["от 34 100 ₽","цирконий и E.max"], ["от 2 750 ₽","временная коронка"], ["3 врача","хирург, ортопед и терапевт составляют план"]],
    nav: [["Циркониевые коронки","protezirovanie/koronki/cirkoniy/"], ["Коронка на имплант","implantaciya/koronka-na-implant/"]],
  },
  {
    slug: "cirkonievye-koronki", path: "protezirovanie/koronki/cirkoniy/", parent: "koronki", crumb: "Циркониевые коронки", procedure: "Циркониевые коронки", hero: hero("cirkonievye-koronki"),
    facts: [["от 34 100 ₽","цельноциркониевая коронка на свой зуб"], ["Без металла","для передних и жевательных зубов"], ["2 200 ₽","3D-сканирование челюстей"], ["3 врача","хирург, ортопед и терапевт составляют план"]],
  },
  // ---------- гео-страницы Жуковского (план SEO-треда: гео-страницы_и_редиректы, лист «Гео-страницы»). Первый экран — картинка по смыслу,
// как у услуг (hero-zhukovskiy-*.png от SEO-треда; пока её нет — фото входа), фото входа с подписью — в блоке дороги, чтобы клинику легко найти ----------
  {
    slug: "zhukovskiy-implantaciya", path: "goroda/zhukovskiy/implantaciya/", geo: "Жуковский", crumb: "Имплантация для жителей Жуковского", procedure: "Имплантация зубов",
    hero: [...hero("zhukovskiy-implantaciya"), "images/clinic/yandex-08.jpg"], photo: "images/clinic/yandex-08.jpg", photoPos: "38% 50%", photoCap: "Вход в стоматологию: Громова, 10/2, Удельная",
    facts: [["от 19 300 ₽","установка импланта"], ["4 500 ₽","КТ двух челюстей, томограф в клинике"], ["3 врача","хирург, ортопед и терапевт составляют план"], ["Парковка","своя, у входа в клинику"]],
    links: [["Имплантация зубов","implantaciya/"], ["All-on-4","implantaciya/all-on-4/"], ["All-on-6","implantaciya/all-on-6/"], ["Вся челюсть на имплантах","implantaciya/vsya-chelyust/"], ["Коронка на имплант","implantaciya/koronka-na-implant/"], ["Синус-лифтинг","implantaciya/sinus-lifting/"], ["Костная пластика","implantaciya/kostnaya-plastika/"]],
  },
  {
    slug: "zhukovskiy-protezirovanie", path: "goroda/zhukovskiy/protezirovanie/", geo: "Жуковский", crumb: "Протезирование для жителей Жуковского", procedure: "Протезирование зубов",
    hero: [...hero("zhukovskiy-protezirovanie"), "images/clinic/2gis-14.jpg"], photo: "images/clinic/2gis-14.jpg", photoPos: "30% 50%", photoCap: "Вход в стоматологию: Громова, 10/2, Удельная",
    facts: [["от 26 400 ₽","металлокерамическая коронка"], ["от 31 900 ₽","съёмный протез"], ["2 200 ₽","3D-сканирование челюстей"], ["Парковка","своя, у входа в клинику"]],
    links: [["Протезирование зубов","protezirovanie/"], ["Коронки","protezirovanie/koronki/"], ["Циркониевые коронки","protezirovanie/koronki/cirkoniy/"], ["Съёмные протезы","protezirovanie/semnye-protezy/"], ["Бюгельный протез","protezirovanie/byugelnyj-protez/"], ["Протез на имплантах","implantaciya/vsya-chelyust/"], ["Коронка на имплант","implantaciya/koronka-na-implant/"]],
  },
];
