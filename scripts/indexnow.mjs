// IndexNow: после выкладки боевой сборки сообщает Яндексу (и через него Bing и другим) о новых, изменённых и удалённых страницах.
// Список готовит сборка с PUBLISH=1 (indexnow-pending.json), файл ключа <ключ>.txt она кладёт в корень сайта.
// Запуск после выкладки: INDEXNOW_KEY=<тот же ключ> npm run indexnow
import { readFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pend = path.join(root, "indexnow-pending.json");
const key = process.env.INDEXNOW_KEY;
const endpoint = process.env.INDEXNOW_ENDPOINT || "https://yandex.com/indexnow";
if (!existsSync(pend)) { console.log("IndexNow: отправлять нечего"); process.exit(0); }
if (!key) { console.error("IndexNow: нужен INDEXNOW_KEY, тот же, что при сборке"); process.exit(1); }
const { site, urls } = JSON.parse(readFileSync(pend, "utf8"));
// до 10 000 адресов в одном запросе
for (let i = 0; i < urls.length; i += 10000) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: new URL(site).host, key, keyLocation: `${site}/${key}.txt`, urlList: urls.slice(i, i + 10000) }),
  });
  if (res.status !== 200 && res.status !== 202) { console.error(`IndexNow: ответ ${res.status} ${await res.text()}`); process.exit(1); }
}
rmSync(pend);
console.log(`IndexNow: отправлено адресов ${urls.length}`);
