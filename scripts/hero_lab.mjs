// Превью вариантов первого экрана для сравнения: копии собранной главной (dist/index.html),
// в которых у .hero__3d другая картинка. Запуск после сборки: node scripts/build.mjs && node scripts/hero_lab.mjs
// Картинки лежат в src/images/lab/<вариант>/: кадры Blender с meta.json (frames_to_webp.py)
// или слои и spec.json (gpt_layers.py). Вариант без картинок пропускается.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const lab = path.join(root, "src/images/lab");
const attr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const json = (f) => JSON.parse(readFileSync(f, "utf8"));

const variants = [
  { file: "hero-bone.html", dir: "bone", kind: "frames" },
  { file: "hero-tooth.html", dir: "tooth", kind: "frames", intro: "fade" },
  { file: "hero-gpt-bone.html", dir: "gpt-bone", kind: "layers" },
  { file: "hero-gpt-tooth.html", dir: "gpt-tooth", kind: "reveal", intro: "fade" },
  { file: "hero-gpt-tooth-section.html", dir: "gpt-tooth-section", kind: "reveal", intro: "fade" },
];

const home = readFileSync(path.join(dist, "index.html"), "utf8");
const heroRe = /<div class="hero__3d"[^>]*>/;
if (!heroRe.test(home)) throw new Error("в dist/index.html нет .hero__3d");
const made = [];
for (const v of variants) {
  const d = path.join(lab, v.dir);
  let a = "";
  if (v.kind === "frames") {
    if (!existsSync(path.join(d, "meta.json"))) continue;
    const m = json(path.join(d, "meta.json"));
    a = `data-seq="images/lab/${v.dir}/l/" data-frames="${m.frames}" data-crop="${m.crop}" data-seq-s="images/lab/${v.dir}/s/" data-frames-s="${m.framesS}" data-crop-s="${m.crop}" data-shrink="0"`;
  } else {
    if (!existsSync(path.join(d, "spec.json"))) continue;
    const s = json(path.join(d, "spec.json"));
    // пути в spec.json относительно папки варианта
    const fix = (p) => `images/lab/${v.dir}/${p}`;
    if (v.kind === "layers") s.items.forEach((it) => { it.src = fix(it.src); });
    else { s.base = fix(s.base); s.top = fix(s.top); }
    a = `data-${v.kind}="${attr(JSON.stringify(s))}"`;
  }
  if (v.intro) a += ` data-intro="${v.intro}"`;
  const html = home.replace(heroRe, `<div class="hero__3d" aria-hidden="true" ${a}>`)
    .replace(/<link rel="canonical"[^>]*>/, "")
    .replace("</head>", '<meta name="robots" content="noindex">\n</head>');
  writeFileSync(path.join(dist, v.file), html);
  made.push(v.file);
}
console.log("Превью первого экрана:", made.join(", ") || "нет картинок");
