// Раскладывает общий файл текстов SEO-треда по страницам: node scripts/import-service-texts.mjs <тексты_страниц_услуг_A.md>
// Каждая страница начинается с «<!-- pid: … -->», адрес берётся из строки «URL:». Результат: src/service-texts/<slug>.md
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { servicePages } from "../src/service-pages.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const from = process.argv[2];
if (!from) throw new Error("укажите файл: node scripts/import-service-texts.mjs <тексты.md>");
const dir = path.join(root, "src", "service-texts");
mkdirSync(dir, { recursive: true });
const chunks = readFileSync(from, "utf8").replace(/\r/g, "").split(/^(?=<!-- pid:)/m).slice(1);
const seen = new Set();
for (const c of chunks) {
  const url = /^\**URL:\**\s*(\S+)/m.exec(c)?.[1];
  const page = servicePages.find((p) => "/" + p.path === url);
  if (!page) { console.log("пропущено, нет страницы с адресом", url); continue; }
  writeFileSync(path.join(dir, `${page.slug}.md`), c.replace(/\n+(---\n*)?$/, "") + "\n");
  seen.add(page.slug);
}
const left = servicePages.filter((p) => !seen.has(p.slug)).map((p) => p.slug);
console.log(`Тексты разложены: ${seen.size}${left.length ? `; без текста: ${left.join(", ")}` : ""}`);
