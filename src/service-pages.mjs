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
  [/(?:от )?(?:32 900|35 100) ₽/g, "цельноциркониевая коронка на имплант: два варианта цены, уточняем у клиники"],
];

export const servicePages = [
  {
    slug: "implantaciya", path: "implantaciya/", old: "implantaciya", crumb: "Имплантация зубов", procedure: "Имплантация зубов", hero: hero("implantaciya"),
    facts: [["от 19 300 ₽","установка импланта"], ["4 500 ₽","КТ двух челюстей"], ["4 системы","Osstem, Dentium, Straumann, Riellen's"], ["3 врача","хирург, ортопед и терапевт составляют план"]],
    nav: [["All-on-4","implantaciya/all-on-4/"], ["All-on-6","implantaciya/all-on-6/"], ["Вся челюсть на имплантах","implantaciya/vsya-chelyust/"], ["Коронка на имплант","implantaciya/koronka-na-implant/"], ["Синус-лифтинг","implantaciya/sinus-lifting/"], ["Костная пластика","implantaciya/kostnaya-plastika/"], ["Какие импланты","implantaciya/implanty/"]],
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
    nav: [["Коронки","protezirovanie/koronki/"], ["Циркониевые коронки","protezirovanie/koronki/cirkoniy/"], ["Съёмные протезы","protezirovanie/semnye-protezy/"], ["Бюгельный протез","protezirovanie/byugelnyj-protez/"], ["Протез на имплантах","implantaciya/vsya-chelyust/"], ["Коронка на имплант","implantaciya/koronka-na-implant/"], ["Мост","protezirovanie/most/"], ["Вкладки","protezirovanie/vkladki/"], ["Нейлоновый протез","protezirovanie/nejlonovyj-protez/"], ["Акриловый протез","protezirovanie/akrilovyj-protez/"]],
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
    nav: [["Металлокерамика","protezirovanie/koronki/metallokeramika/"], ["Циркониевые коронки","protezirovanie/koronki/cirkoniy/"], ["Коронка на имплант","implantaciya/koronka-na-implant/"], ["Коронки E.max","protezirovanie/koronki/emax/"]],
  },
  {
    slug: "cirkonievye-koronki", path: "protezirovanie/koronki/cirkoniy/", parent: "koronki", crumb: "Циркониевые коронки", procedure: "Циркониевые коронки", hero: hero("cirkonievye-koronki"),
    facts: [["от 34 100 ₽","цельноциркониевая коронка на свой зуб"], ["Без металла","для передних и жевательных зубов"], ["2 200 ₽","3D-сканирование челюстей"], ["3 врача","хирург, ортопед и терапевт составляют план"]],
  },
  // ---------- вторая очередь (18.10, слово Ilya: у каждой услуги своя страница и картинка по смыслу). Тексты SEO-треда: тексты_7_страниц_услуг.md ----------
  {
    slug: "diagnostika", path: "diagnostika/", old: "diagnostika", crumb: "Комплексная диагностика", procedure: "Диагностика зубов", hero: hero("diagnostika"),
    facts: [["0 ₽","осмотр и консультация с планом лечения"], ["500 ₽","прицельный снимок"], ["1 700 ₽","панорамный снимок (ОПТГ)"], ["от 2 000 ₽","КТ на своём томографе в клинике"]],
    nav: [["КТ зубов","diagnostika/kt/"], ["Панорамный снимок","diagnostika/rentgen/"]],
  },
  {
    slug: "lechenie-zubov", path: "lechenie/", old: "lechenie-zubov", crumb: "Лечение зубов", procedure: "Лечение зубов", hero: hero("lechenie-zubov"),
    facts: [["0 ₽","консультация терапевта"], ["от 4 000 ₽","лечение кариеса"], ["от 11 000 ₽","лечение пульпита"], ["от 8 550 ₽","композитная реставрация зуба"]],
    nav: [["Кариес","lechenie/karies/"], ["Пульпит","lechenie/pulpit/"], ["Каналы","lechenie/kanaly/"], ["Реставрация","lechenie/restavraciya/"], ["Под микроскопом","lechenie/pod-mikroskopom/"], ["Киста зуба","lechenie/kista/"]],
  },
  {
    slug: "mikroskop", path: "lechenie/pod-mikroskopom/", old: "mikroskop", parent: "lechenie-zubov", crumb: "Под микроскопом", procedure: "Лечение зубов под микроскопом", hero: hero("mikroskop"),
    facts: [["25–40 раз","увеличение микроскопа"], ["от 11 000 ₽","лечение пульпита"], ["от 20 000 ₽","лечение периодонтита"], ["0 ₽","консультация терапевта"]],
  },
  {
    slug: "hirurgiya", path: "hirurgiya/", old: "hirurgiya", crumb: "Удаление зубов", procedure: "Удаление зуба", hero: hero("hirurgiya"),
    facts: [["0 ₽","консультация хирурга"], ["от 2 100 ₽","простое удаление зуба"], ["от 4 400 ₽","удаление зуба мудрости"], ["от 8 500 ₽","сложное удаление пьезоскальпелем"]],
    nav: [["Зуб мудрости","hirurgiya/udalenie-zuba-mudrosti/"]],
  },
  {
    slug: "ortodontiya", path: "ortodontiya/", old: "ortodontiya", crumb: "Исправление прикуса", procedure: "Ортодонтическое лечение", hero: hero("ortodontiya"),
    facts: [["1 700 ₽","консультация ортодонта"], ["от 28 500 ₽","брекеты на одну челюсть"], ["от 215 000 ₽","курс элайнеров"], ["от 26 800 ₽","пластинка для ребёнка"]],
    nav: [["Брекеты","ortodontiya/brekety/"], ["Элайнеры","ortodontiya/elajnery/"], ["Ретейнеры","ortodontiya/retejnery/"]],
  },
  {
    slug: "detskaya", path: "detskaya-stomatologiya/", old: "detskaya", crumb: "Детская стоматология", procedure: "Детская стоматология", hero: hero("detskaya"),
    facts: [["2 500 ₽","первичная консультация с планом лечения"], ["7 000 ₽","лечение кариеса молочного зуба"], ["2 650 ₽","удаление молочного зуба"], ["от 450 ₽","фтор-лак на один зуб"]],
  },
  {
    slug: "gigiena", path: "gigiena/", old: "gigiena", crumb: "Профессиональная гигиена", procedure: "Профессиональная гигиена полости рта", hero: hero("gigiena"),
    facts: [["0 ₽","консультация терапевта"], ["6 300 ₽","чистка с брекетами"], ["от 5 100 ₽","чистка детям до 6 лет"], ["от 15 000 ₽","отбеливание FLASH"]],
    nav: [["Отбеливание","gigiena/otbelivanie/"]],
  },
  // ---------- вторая очередь, пачка 2 (18.10): дочерние страницы. Тексты SEO-треда: тексты_16_страниц_услуг_2.md ----------
  {
    slug: "kt", path: "diagnostika/kt/", parent: "diagnostika", crumb: "КТ зубов", procedure: "КТ зубов и челюстей", hero: hero("kt"),
    facts: [["2 000 ₽","КТ участка 5×5 см"], ["4 500 ₽","КТ двух челюстей"], ["Vatech","свой 3D-томограф в клинике"], ["0 ₽","разбор снимка на консультации"]],
  },
  {
    slug: "rentgen", path: "diagnostika/rentgen/", parent: "diagnostika", crumb: "Панорамный снимок", procedure: "Панорамный снимок зубов (ОПТГ)", hero: hero("rentgen"),
    facts: [["1 700 ₽","панорамный снимок (ОПТГ)"], ["500 ₽","прицельный снимок зуба"], ["от 2 000 ₽","КТ, если нужен 3D-снимок"], ["0 ₽","разбор снимков на консультации"]],
  },
  {
    slug: "zub-mudrosti", path: "hirurgiya/udalenie-zuba-mudrosti/", parent: "hirurgiya", crumb: "Удаление зуба мудрости", procedure: "Удаление зуба мудрости", hero: hero("zub-mudrosti"),
    facts: [["от 4 400 ₽","удаление зуба мудрости"], ["от 10 890 ₽","ретинированный зуб, пьезоскальпель"], ["2 000 ₽","КТ участка перед операцией"], ["0 ₽","консультация хирурга"]],
  },
  {
    slug: "brekety", path: "ortodontiya/brekety/", parent: "ortodontiya", crumb: "Брекеты", procedure: "Лечение брекет-системой", hero: hero("brekety"),
    facts: [["от 28 500 ₽","металлические 3M, одна челюсть"], ["от 32 570 ₽","самолигирующие Damon Q2"], ["от 50 500 ₽","керамические Damon Clear"], ["1 700 ₽","консультация ортодонта"]],
  },
  {
    slug: "elajnery", path: "ortodontiya/elajnery/", parent: "ortodontiya", crumb: "Элайнеры", procedure: "Выравнивание зубов элайнерами", hero: hero("elajnery"),
    facts: [["от 215 000 ₽","курс FLEXILIGNER"], ["от 290 400 ₽","курс STARSMILE"], ["от 295 000 ₽","курс EUROKAPPA"], ["1 700 ₽","консультация ортодонта"]],
  },
  {
    slug: "karies", path: "lechenie/karies/", parent: "lechenie-zubov", crumb: "Лечение кариеса", procedure: "Лечение кариеса", hero: hero("karies"),
    facts: [["от 4 000 ₽","лечение кариеса с пломбой"], ["0 ₽","консультация терапевта"], ["500 ₽","прицельный снимок"], ["от 8 550 ₽","композитная реставрация"]],
  },
  {
    slug: "pulpit", path: "lechenie/pulpit/", parent: "lechenie-zubov", crumb: "Лечение пульпита", procedure: "Лечение пульпита", hero: hero("pulpit"),
    facts: [["от 11 000 ₽","лечение пульпита"], ["от 20 000 ₽","лечение периодонтита"], ["от 5 500 ₽","культевая вкладка"], ["0 ₽","консультация терапевта"]],
  },
  {
    slug: "kanaly", path: "lechenie/kanaly/", parent: "lechenie-zubov", crumb: "Лечение каналов", procedure: "Эндодонтическое лечение корневых каналов", hero: hero("kanaly"),
    facts: [["от 11 000 ₽","лечение пульпита"], ["от 20 000 ₽","лечение периодонтита"], ["2 000 ₽","КТ участка 5×5 см"], ["0 ₽","консультация терапевта"]],
  },
  {
    slug: "restavraciya", path: "lechenie/restavraciya/", parent: "lechenie-zubov", crumb: "Художественная реставрация", procedure: "Художественная реставрация зубов", hero: hero("restavraciya"),
    facts: [["от 8 550 ₽","композитная реставрация зуба"], ["от 34 100 ₽","винир или вкладка E.max"], ["от 15 000 ₽","отбеливание FLASH"], ["0 ₽","консультация терапевта"]],
  },
  {
    slug: "otbelivanie", path: "gigiena/otbelivanie/", parent: "gigiena", crumb: "Отбеливание", procedure: "Профессиональное отбеливание зубов", hero: hero("otbelivanie"),
    facts: [["от 15 000 ₽","отбеливание FLASH в клинике"], ["от 8 550 ₽","композитная реставрация"], ["от 34 100 ₽","винир E.max"], ["0 ₽","консультация терапевта"]],
  },
  {
    slug: "most", path: "protezirovanie/most/", parent: "protezirovanie", crumb: "Мост на зубы", procedure: "Мостовидный протез", hero: hero("most"),
    facts: [["от 26 400 ₽","металлокерамическая коронка, единица"], ["от 34 100 ₽","цирконий или E.max, единица"], ["2 200 ₽","3D-сканирование челюстей"], ["0 ₽","консультация ортопеда"]],
  },
  {
    slug: "metallokeramika", path: "protezirovanie/koronki/metallokeramika/", parent: "koronki", crumb: "Металлокерамика", procedure: "Металлокерамические коронки", hero: hero("metallokeramika"),
    facts: [["от 26 400 ₽","коронка на свой зуб"], ["от 27 400 ₽","коронка на имплант"], ["от 5 500 ₽","культевая вкладка"], ["0 ₽","консультация ортопеда"]],
  },
  {
    slug: "vkladki", path: "protezirovanie/vkladki/", parent: "protezirovanie", crumb: "Вкладки", procedure: "Культевые и керамические вкладки", hero: hero("vkladki"),
    facts: [["от 5 500 ₽","культевая вкладка"], ["от 34 100 ₽","керамическая вкладка E.max"], ["2 200 ₽","3D-сканирование челюстей"], ["0 ₽","консультация ортопеда"]],
  },
  {
    slug: "nejlonovyj-protez", path: "protezirovanie/nejlonovyj-protez/", parent: "protezirovanie", crumb: "Нейлоновый протез", procedure: "Эластичный съёмный протез", hero: hero("nejlonovyj-protez"),
    facts: [["от 53 900 ₽","эластичный протез Acry Free"], ["от 31 900 ₽","съёмный протез на 3–13 зубов"], ["от 22 550 ₽","иммедиат-протез на 1–3 зуба"], ["0 ₽","консультация ортопеда"]],
  },
  {
    slug: "akrilovyj-protez", path: "protezirovanie/akrilovyj-protez/", parent: "protezirovanie", crumb: "Акриловый протез", procedure: "Акриловый съёмный протез", hero: hero("akrilovyj-protez"),
    facts: [["от 31 900 ₽","частичный или полный протез"], ["от 22 550 ₽","иммедиат-протез на 1–3 зуба"], ["от 13 750 ₽","перебазировка и починка"], ["0 ₽","консультация ортопеда"]],
  },
  {
    slug: "implanty", path: "implantaciya/implanty/", parent: "implantaciya", crumb: "Какие импланты", procedure: "Выбор системы имплантов", hero: hero("implanty"),
    facts: [["от 19 300 ₽","установка импланта"], ["4 системы","Osstem, Dentium, Straumann, Riellen's"], ["4 500 ₽","КТ двух челюстей"], ["от 24 200 ₽","хирургический шаблон"]],
  },
  // ---------- пачка C (18.10). Тексты SEO-треда: тексты_5_страниц_услуг_3.md. Резекции нет в прайсе: страница есть, но вне меню, разделов и sitemap (hidden), пока клиника не подтвердит ----------
  {
    slug: "kista", path: "lechenie/kista/", parent: "lechenie-zubov", crumb: "Киста зуба", procedure: "Лечение кисты зуба", hero: hero("kista"),
    facts: [["от 20 000 ₽","лечение через канал"], ["от 9 900 ₽","удаление кисты с зубом"], ["2 000 ₽","КТ участка 5×5 см"], ["0 ₽","консультация врача"]],
  },
  {
    slug: "emax", path: "protezirovanie/koronki/emax/", parent: "koronki", crumb: "Коронки E.max", procedure: "Керамические коронки E.max", hero: hero("emax"),
    facts: [["от 34 100 ₽","коронка E.max на свой зуб"], ["от 6 600 ₽","временная коронка CAD/CAM"], ["2 200 ₽","3D-сканирование челюстей"], ["0 ₽","консультация ортопеда"]],
  },
  {
    slug: "retejnery", path: "ortodontiya/retejnery/", parent: "ortodontiya", crumb: "Ретейнеры", procedure: "Ретенция после ортодонтического лечения", hero: hero("retejnery"),
    facts: [["11 000 ₽","несъёмный ретейнер"], ["от 7 500 ₽","ретенционная каппа"], ["от 10 400 ₽","удерживающее кольцо"], ["1 700 ₽","консультация ортодонта"]],
  },
  {
    slug: "rezekciya", path: "hirurgiya/rezekciya/", parent: "hirurgiya", hidden: true, crumb: "Резекция верхушки корня", procedure: "Резекция верхушки корня", hero: hero("rezekciya"),
    facts: [["0 ₽","консультация хирурга"], ["2 000 ₽","КТ участка 5×5 см"], ["500 ₽","прицельный снимок"], ["от 20 000 ₽","лечение периодонтита"]],
  },
  {
    slug: "konsultaciya", path: "konsultaciya/", crumb: "Консультация", procedure: "Консультация стоматолога", hero: hero("konsultaciya"),
    facts: [["0 ₽","терапевт, хирург и ортопед с планом лечения"], ["1 700 ₽","консультация ортодонта"], ["2 500 ₽","консультация детского стоматолога"], ["3 врача","составляют план лечения вместе"]],
  },
  // дорога из Жуковского — слово Ilya 18.10 08:56: «рядом с Жуковским», без времени в пути и километров
// ---------- гео-страницы Жуковского (план SEO-треда: гео-страницы_и_редиректы, лист «Гео-страницы»). Первый экран — картинка по смыслу,
// как у услуг (hero-zhukovskiy-*.png от SEO-треда), фото входа с подписью — в блоке дороги, чтобы клинику легко найти ----------
  {
    slug: "zhukovskiy-implantaciya", path: "goroda/zhukovskiy/implantaciya/", geo: "Жуковский", crumb: "Имплантация для жителей Жуковского", procedure: "Имплантация зубов",
    hero: hero("zhukovskiy-implantaciya"), photo: "images/clinic/yandex-08.jpg", photoPos: "38% 50%", photoCap: "Вход в стоматологию: Громова, 10/2, Удельная",
    facts: [["Рядом","с Жуковским, в соседней Удельной"], ["от 19 300 ₽","установка импланта"], ["4 500 ₽","КТ двух челюстей, томограф в клинике"], ["3 врача","хирург, ортопед и терапевт составляют план"]],
    links: [["Имплантация зубов","implantaciya/"], ["All-on-4","implantaciya/all-on-4/"], ["All-on-6","implantaciya/all-on-6/"], ["Вся челюсть на имплантах","implantaciya/vsya-chelyust/"], ["Коронка на имплант","implantaciya/koronka-na-implant/"], ["Синус-лифтинг","implantaciya/sinus-lifting/"], ["Костная пластика","implantaciya/kostnaya-plastika/"]],
  },
  {
    slug: "zhukovskiy-protezirovanie", path: "goroda/zhukovskiy/protezirovanie/", geo: "Жуковский", crumb: "Протезирование для жителей Жуковского", procedure: "Протезирование зубов",
    hero: hero("zhukovskiy-protezirovanie"), photo: "images/clinic/2gis-14.jpg", photoPos: "30% 50%", photoCap: "Вход в стоматологию: Громова, 10/2, Удельная",
    facts: [["Рядом","с Жуковским, в соседней Удельной"], ["от 26 400 ₽","металлокерамическая коронка"], ["от 31 900 ₽","съёмный протез"], ["2 200 ₽","3D-сканирование челюстей"]],
    links: [["Протезирование зубов","protezirovanie/"], ["Коронки","protezirovanie/koronki/"], ["Циркониевые коронки","protezirovanie/koronki/cirkoniy/"], ["Съёмные протезы","protezirovanie/semnye-protezy/"], ["Бюгельный протез","protezirovanie/byugelnyj-protez/"], ["Протез на имплантах","implantaciya/vsya-chelyust/"], ["Коронка на имплант","implantaciya/koronka-na-implant/"]],
  },
];
