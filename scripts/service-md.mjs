// Разбор текстов страниц услуг (src/service-texts/<slug>.md, их пишет SEO-тред) в простую структуру для build.mjs.
// Формат: шапка «Ключ: значение» (Title, Description, H1, URL, Проверил, Alt картинки…), затем «# H1», вступление,
// разделы «## H2» с подразделами «### H3». Внутри: абзацы, списки «- » и «1. », таблицы, цитаты «> ».
// Квадратные скобки в верхнем регистре ([УТОЧНИТЬ …], [КНОПКА …], [КАРТА]) — пометки и места под элементы вёрстки.

const metaKeys = [["Title", "title"], ["Description", "desc"], ["H1", "h1"], ["URL", "url"], ["Проверил", "reviewer"], ["Обновлено", "updated"], ["Цены актуальны на", "pricesDate"], ["Alt", "alt"]];

function blocks(lines) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim() || /^---+$/.test(l.trim())) { i++; continue; }
    const take = (re) => { const a = []; while (i < lines.length && re.test(lines[i])) a.push(lines[i++]); return a; };
    if (/^\|/.test(l)) {
      const rows = take(/^\|/).filter((r) => !/^\|[\s:|-]+\|$/.test(r.trim())).map((r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
      out.push({ t: "table", head: rows[0], rows: rows.slice(1) });
    } else if (/^- /.test(l)) out.push({ t: "ul", items: take(/^- /).map((x) => x.slice(2).trim()) });
    else if (/^\d+\. /.test(l)) out.push({ t: "ol", items: take(/^\d+\. /).map((x) => x.replace(/^\d+\. /, "").trim()) });
    else if (/^>/.test(l)) {
      const text = take(/^>/).map((x) => x.replace(/^>\s?/, "")).filter(Boolean).join("\n");
      out.push({ t: "quote", text });
    } else {
      const p = take(/^(?!\s*$)(?!\||- |\d+\. |>|#)/);
      if (p.length) out.push({ t: "p", text: p.join("\n") });
      else i++;
    }
  }
  return out;
}

export function parseServiceMd(src) {
  const lines = src.replace(/\r/g, "").split("\n");
  const h1At = lines.findIndex((l) => /^# /.test(l));
  if (h1At < 0) throw new Error("в тексте нет строки «# H1»");
  const meta = {};
  for (const l of lines.slice(0, h1At)) {
    const m = /^\*{0,2}([^:*]+?)(?:\s*\([^)]*\))?:\*{0,2}\s*(.*)$/.exec(l.trim());
    if (!m || /^Примечание/.test(m[1])) continue;
    const k = metaKeys.find(([name]) => m[1] === name || (name === "Alt" && m[1].startsWith("Alt")));
    if (k && !(k[1] in meta)) meta[k[1]] = m[2].trim();
  }
  meta.h1 ||= lines[h1At].slice(2).trim();
  // вступление до первого H2, дальше разделы
  const sections = [];
  let cur = { intro: true, lines: [] };
  const intro = cur;
  for (const l of lines.slice(h1At + 1)) {
    // «### 1. Консультация» → «Консультация»: нумерацию на сайте не показываем (правило Ilya)
    const h = /^(##|###) (?:\d{1,2}\.\s+)?(.+?)(?:\s*\{#([\w-]+)\})?\s*$/.exec(l);
    if (h && h[1] === "##") { cur = { title: h[2], id: h[3], lines: [], subs: [] }; sections.push(cur); }
    else if (h && cur.subs) { const s = { title: h[2], id: h[3], lines: [] }; cur.subs.push(s); cur.cur = s; }
    else (cur.cur || cur).lines.push(l);
  }
  const done = (s) => ({ title: s.title, id: s.id, nodes: blocks(s.lines), subs: (s.subs || []).map((x) => ({ title: x.title, id: x.id, nodes: blocks(x.lines) })) });
  return { meta, intro: blocks(intro.lines), sections: sections.map(done) };
}
