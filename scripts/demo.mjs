// Демо для показа клинике: из готовой сборки dist/ делает dist-demo/.
// Главная остаётся целиком, у остальных страниц только первый экран и ниже «Страница в разработке» с возвратом на главную.
// Адреса страниц те же, что в dist/, поэтому все внутренние ссылки остаются внутри демо. Запуск: node scripts/build.mjs && node scripts/demo.mjs
import { cpSync, rmSync, readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const out = path.join(root, "dist-demo");
if (!existsSync(path.join(dist, "index.html"))) throw new Error("Сначала node scripts/build.mjs");
if (/name="robots" content="index/.test(readFileSync(path.join(dist, "index.html"), "utf8"))) throw new Error("Демо собирается только из обычной сборки, без PUBLISH=1");

rmSync(out, { recursive: true, force: true });
// карта сайта и robots.txt с домена-примера демо не нужны
cpSync(dist, out, { recursive: true, filter: (f) => !/[\\/](sitemap\.xml|robots\.txt|indexnow[^\\/]*)$/.test(f) });

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const htmlFiles = walk(out).filter((f) => f.endsWith(".html"));

// конец тега с учётом вложенных тегов того же имени
function closeOf(html, start, tag) {
  const re = new RegExp(`<${tag}\\b|</${tag}>`, "g");
  re.lastIndex = start;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    depth += m[0][1] === "/" ? -1 : 1;
    if (!depth) return m.index + m[0].length;
  }
  throw new Error(`не закрыт <${tag}>`);
}

const soon = (home) => `<section class="section section--sage dev-soon" id="dev" aria-labelledby="dev-t"><div class="wrap dev-soon__in" data-reveal>
  <span class="label">Страница в разработке</span>
  <h2 id="dev-t">Здесь скоро будет вся страница</h2>
  <p>Мы наполняем этот раздел. Пока вернитесь на главную: там уже работает всё, что готово.</p>
  <a class="btn btn--lg" href="${home}">Вернуться на главную</a>
</div></section>`;
const soonCss = `<style>.dev-soon__in{display:grid;justify-items:start;gap:22px}.dev-soon h2{max-width:18ch;font:600 var(--fs-4)/1.05 var(--display);letter-spacing:-.03em}.dev-soon p{max-width:40ch;font-size:var(--fs-0);color:var(--muted)}.dev-soon .btn{margin-top:10px}</style>`;

let stubs = 0;
for (const f of htmlFiles) {
  const rel = path.relative(out, f).split(path.sep).join("/");
  if (rel === "index.html") continue;
  let html = readFileSync(f, "utf8");
  const heroAt = html.search(/<section class="page-hero\b/);
  if (heroAt < 0) continue; // перенаправления и пошаговая запись zapis.html остаются как есть
  const home = "../".repeat(rel.split("/").length - 1) + "index.html";
  const heroEnd = closeOf(html, heroAt, "section");
  const mainEnd = html.indexOf("</main>", heroEnd);
  html = html.slice(0, heroEnd) + "\n" + soon(home) + "\n" + html.slice(mainEnd);
  // подвал страницы не нужен: под первым экраном только заглушка
  const footAt = html.search(/<footer class="footer\b/);
  if (footAt > 0) html = html.slice(0, footAt) + html.slice(closeOf(html, footAt, "footer"));
  // ссылки на разделы, которых в демо нет, ведут к заглушке
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  html = html.replace(/href="#([^"]+)"/g, (m, id) => (ids.has(id) ? m : 'href="#dev"'));
  html = html.replace("</head>", `${soonCss}\n</head>`);
  writeFileSync(f, html);
  stubs++;
}

// проверка: каждая внутренняя ссылка ведёт на файл внутри демо
const bad = [];
for (const f of walk(out).filter((x) => x.endsWith(".html"))) {
  const html = readFileSync(f, "utf8");
  for (const [, href] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    if (/^(https?:|mailto:|tel:|#|data:|javascript:)/.test(href)) continue;
    let target = path.resolve(path.dirname(f), href.replace(/[?#].*$/, ""));
    if (href.replace(/[?#].*$/, "").endsWith("/") || href === "") target = path.join(target, "index.html");
    if (!target.startsWith(out) || !existsSync(target)) bad.push(`${path.relative(out, f)} → ${href}`);
  }
  for (const [, url] of html.matchAll(/http-equiv="refresh" content="\d+;\s*url=([^"]+)"/gi)) {
    if (!existsSync(path.resolve(path.dirname(f), url.endsWith("/") ? url + "index.html" : url))) bad.push(`${path.relative(out, f)} ⇒ ${url}`);
  }
}
if (bad.length) throw new Error("Ссылки уводят из демо:\n" + [...new Set(bad)].join("\n"));
console.log(`Демо: главная целиком, заглушек ${stubs} → ${out}`);
