// Capturas de revisão: node scripts/shots.mjs <rota> [rota...]  (desktop 1440 + mobile 390)
import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const routes = process.argv.slice(2).length ? process.argv.slice(2) : ['/'];
const theme = process.env.THEME; // 'night' para modo noite
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
for (const [label, w, h, mobile] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true]]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await page.goto('http://localhost:5180/inicio', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(async () => {
    if (typeof window.rumoSeed !== 'function') return false;
    const req = indexedDB.open('rumo');
    const db = await new Promise((r) => (req.onsuccess = () => r(req.result)));
    const tx = db.transaction(['meta'], 'readonly');
    const meta = await new Promise((r) => (tx.objectStore('meta').get('vault').onsuccess = (e) => r(e.target.result)));
    return !!meta;
  }, { timeout: 20000 });
  await page.evaluate(async () => {
    await window.rumoSeed();
  });
  await page.waitForFunction(() => location.pathname === '/' && !location.search, { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 600));
  if (theme) await page.evaluate((t) => (document.documentElement.dataset.chart = t), theme);
  for (const r of routes) {
    await page.goto('http://localhost:5180' + r, { waitUntil: 'networkidle0' });
    await new Promise((res) => setTimeout(res, 1400));
    if (theme) await page.evaluate((t) => (document.documentElement.dataset.chart = t), theme);
    const name = (r === '/' ? 'hoje' : r.replace(/[/?=&]+/g, '-').replace(/^-|-$/g, '')) + `-${label}${theme ? '-' + theme : ''}.png`;
    await page.screenshot({ path: `.impeccable/review/${name}`, fullPage: true });
    console.log(name);
  }
  await page.close();
}
await browser.close();
