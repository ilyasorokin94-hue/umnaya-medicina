// Снимки сайтов для аудита: компьютер 1440 и телефон 390, кадры прокрутки и замеры.
import { chromium, devices } from './node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [shard = 0, total = 1] = process.argv.slice(2).map(Number);
const lines = fs.readFileSync(new URL('./sites.txt', import.meta.url), 'utf8')
  .split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));
const sites = lines.map(l => { const [slug, url, mode] = l.split('|').map(s => s.trim()); return { slug, url, deep: mode === 'deep' }; })
  .filter((_, i) => i % total === shard);

const ACCEPT = /^(accept|accept all|allow all|agree|i agree|ok|okay|got it|piekrītu|pieņemt|pieņemt visus|apstiprināt|nõustun|nõustu|luba kõik|sutinku|priimti|priimti visus|alle akzeptieren|akzeptieren|zustimmen|einverstanden|alle zulassen|принять|принять все|согласен|согласна|хорошо|понятно|прийняти|прийняти все|погоджуюсь|zgadzam się|akceptuję|accepter|aceptar|accetta)/i;

async function dismiss(page) {
  try {
    const els = await page.$$('button, a, [role=button], div[class*=cookie] span');
    for (const el of els.slice(0, 400)) {
      const t = ((await el.innerText().catch(() => '')) || '').trim();
      if (t.length < 30 && ACCEPT.test(t) && await el.isVisible().catch(() => false)) {
        await el.click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(600);
        break;
      }
    }
  } catch {}
}

const probe = () => {
  const cs = el => el ? getComputedStyle(el) : null;
  const pick = sel => { const el = document.querySelector(sel); const s = cs(el); return s ? { family: s.fontFamily, size: s.fontSize, weight: s.fontWeight, lh: s.lineHeight, ls: s.letterSpacing, color: s.color, transform: s.textTransform } : null; };
  const fams = new Set(); const sizes = {};
  for (const el of Array.from(document.querySelectorAll('h1,h2,h3,h4,p,a,button,li,span')).slice(0, 3000)) {
    if (!el.offsetParent && el.tagName !== 'BODY') continue;
    const s = getComputedStyle(el); fams.add(s.fontFamily.split(',')[0].replace(/["']/g, '').trim());
    if (el.childNodes.length && Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim())) sizes[s.fontSize] = (sizes[s.fontSize] || 0) + 1;
  }
  const bgs = {};
  for (const el of Array.from(document.querySelectorAll('body, section, header, footer, main > div, div')).slice(0, 2500)) {
    const r = el.getBoundingClientRect(); if (r.width < 300 || r.height < 120) continue;
    const c = getComputedStyle(el).backgroundColor; if (c === 'rgba(0, 0, 0, 0)') continue;
    bgs[c] = (bgs[c] || 0) + Math.round(r.width * r.height / 1e4);
  }
  const src = Array.from(document.scripts).map(s => s.src).join(' ') + ' ' + Array.from(document.querySelectorAll('link[rel=stylesheet]')).map(l => l.href).join(' ');
  const has = re => re.test(src);
  const w = window;
  return {
    title: document.title,
    lang: document.documentElement.lang,
    h1: pick('h1'), h2: pick('h2'), body: pick('p') || pick('body'), btn: pick('button, a[class*=btn], a[class*=button]'),
    families: Array.from(fams).slice(0, 12),
    sizes: Object.entries(sizes).sort((a, b) => b[1] - a[1]).slice(0, 14),
    bgs: Object.entries(bgs).sort((a, b) => b[1] - a[1]).slice(0, 8),
    libs: {
      gsap: !!w.gsap || has(/gsap|greensock|TweenMax/i), scrollTrigger: !!w.ScrollTrigger || has(/ScrollTrigger/i),
      lenis: !!w.lenis || !!w.Lenis || has(/lenis/i) || document.documentElement.classList.contains('lenis'),
      locomotive: has(/locomotive/i) || !!document.querySelector('[data-scroll-container]'),
      three: !!w.THREE || has(/three(\.min)?\.js|three\.module/i), swiper: !!w.Swiper || has(/swiper/i),
      lottie: !!w.lottie || has(/lottie|bodymovin/i), barba: !!w.barba || has(/barba/i), aos: !!w.AOS || has(/aos/i),
      webflow: !!w.Webflow || /webflow/i.test(document.documentElement.outerHTML.slice(0, 3000)),
      tilda: has(/tildacdn/i), wordpress: has(/wp-content|wp-includes/i), framer: has(/framer/i) || !!document.querySelector('[data-framer-component-type]'),
      next: !!w.__NEXT_DATA__ || has(/_next\//), nuxt: !!w.__NUXT__ || has(/_nuxt\//), splide: has(/splide/i), spline: has(/spline/i) || !!document.querySelector('spline-viewer'),
    },
    canvas: document.querySelectorAll('canvas').length, video: document.querySelectorAll('video').length,
    imgs: document.images.length, height: document.documentElement.scrollHeight,
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
    sections: document.querySelectorAll('section').length,
    navLinks: Array.from(document.querySelectorAll('header a, nav a')).map(a => a.innerText.trim()).filter(Boolean).slice(0, 20),
  };
};

// уменьшить кадр, чтобы снимки помещались в git
async function shrink(file, width, maxH) {
  try {
    const buf = fs.readFileSync(file);
    let img = sharp(buf, { limitInputPixels: false }).resize({ width, withoutEnlargement: true });
    const meta = await sharp(buf, { limitInputPixels: false }).metadata();
    if (maxH) { const h = Math.round(meta.height * width / meta.width); if (h > maxH) img = sharp(await img.toBuffer()).extract({ left: 0, top: 0, width: Math.min(width, meta.width), height: maxH }); }
    fs.writeFileSync(file, await img.jpeg({ quality: 62, mozjpeg: true }).toBuffer());
  } catch (e) { console.log('shrink', file, String(e).slice(0, 80)); }
}

// лист кадров прокрутки: компьютер 4 в ряд, телефон 7 в ряд
async function sheet(files, out, kind) {
  try {
    const cols = kind === 'd' ? 4 : 7, w = kind === 'd' ? 480 : 180, h = kind === 'd' ? 300 : 390, gap = 6;
    const n = Math.min(files.length, kind === 'd' ? 12 : 14), rows = Math.ceil(n / cols);
    const comps = [];
    for (let i = 0; i < n; i++) {
      const input = await sharp(fs.readFileSync(files[i])).resize({ width: w, height: h, fit: 'cover', position: 'top' }).toBuffer();
      comps.push({ input, left: (i % cols) * (w + gap), top: Math.floor(i / cols) * (h + gap) });
    }
    await sharp({ create: { width: cols * (w + gap) - gap, height: rows * (h + gap) - gap, channels: 3, background: '#888' } })
      .composite(comps).jpeg({ quality: 70, mozjpeg: true }).toFile(out);
  } catch (e) { console.log('sheet', out, String(e).slice(0, 120)); }
}

async function run(browser, site, kind) {
  const dir = path.join('out', site.slug); fs.mkdirSync(dir, { recursive: true });
  const ctxOpt = kind === 'd'
    ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'ru-RU' }
    : { ...devices['iPhone 13'], deviceScaleFactor: 2, locale: 'ru-RU' };
  const ctx = await browser.newContext(ctxOpt);
  const page = await ctx.newPage();
  const res = { kind, ok: false };
  let bytes = 0, reqs = 0;
  page.on('response', async r => { reqs++; const l = Number(r.headers()['content-length'] || 0); bytes += l; });
  const t0 = Date.now();
  try {
    const r = await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    res.status = r && r.status(); res.finalUrl = page.url();
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    res.loadMs = Date.now() - t0;
    await page.waitForTimeout(2500);
    await dismiss(page);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${dir}/${kind}-00.jpg`, type: 'jpeg', quality: 80 });
    const vh = kind === 'd' ? 900 : 844;
    // медленная прокрутка, чтобы сработали анимации и ленивые картинки
    const H = await page.evaluate(() => document.documentElement.scrollHeight);
    let frame = 1; const shots = [`${dir}/${kind}-00.jpg`];
    for (let y = vh; y < Math.min(H, vh * 16) && frame <= 14; y += vh) {
      for (let k = 1; k <= 6; k++) { await page.mouse.wheel(0, vh / 6); await page.waitForTimeout(120); }
      await page.waitForTimeout(900);
      const f = `${dir}/${kind}-${String(frame).padStart(2, '0')}.jpg`;
      await page.screenshot({ path: f, type: 'jpeg', quality: 80 });
      shots.push(f);
      frame++;
    }
    res.frames = frame;
    await sheet(shots, `${dir}/${kind}-sheet.jpg`, kind);
    for (const f of shots.slice(1)) { if (site.deep) await shrink(f, kind === 'd' ? 1200 : 585); else fs.rmSync(f); }
    Object.assign(res, await page.evaluate(probe));
    res.cls = await page.evaluate(() => new Promise(ok => { let v = 0; try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) v += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch {} setTimeout(() => ok(+v.toFixed(3)), 300); }));
    // полная страница сверху
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(600);
    await page.screenshot({ path: `${dir}/${kind}-full.jpg`, type: 'jpeg', quality: 80, fullPage: true, timeout: 30000 })
      .then(() => shrink(`${dir}/${kind}-full.jpg`, kind === 'd' ? 720 : 390, kind === 'd' ? 7000 : 9000))
      .catch(e => res.fullErr = String(e).slice(0, 120));
    if (kind === 'm') {
      // попытка открыть меню
      const burger = await page.$('[class*=burger], [class*=hamburger], [aria-label*=enu], [class*=menu-toggle], [class*=menu-btn], [class*=nav-toggle], button[class*=menu], .menu-button');
      if (burger && await burger.isVisible().catch(() => false)) {
        await burger.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `${dir}/m-menu.jpg`, type: 'jpeg', quality: 80 });
        await shrink(`${dir}/m-menu.jpg`, 585);
        res.menu = true;
      }
    }
    await shrink(`${dir}/${kind}-00.jpg`, kind === 'd' ? 1200 : 585);
    res.ok = true;
  } catch (e) { res.error = String(e).slice(0, 300); }
  res.bytes = bytes; res.requests = reqs;
  await ctx.close();
  return res;
}

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
for (const site of sites) {
  const meta = { slug: site.slug, url: site.url };
  for (const kind of ['d', 'm']) {
    meta[kind] = await Promise.race([run(browser, site, kind), new Promise(ok => setTimeout(() => ok({ kind, error: 'timeout 150s' }), 150000))]);
    console.log(site.slug, kind, meta[kind].ok ? 'ok' : meta[kind].error);
  }
  fs.mkdirSync(path.join('out', site.slug), { recursive: true });
  fs.writeFileSync(path.join('out', site.slug, 'meta.json'), JSON.stringify(meta, null, 1));
}
await browser.close();
