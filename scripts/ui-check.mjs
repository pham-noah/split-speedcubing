// Renders the real app in the bundled headless Chromium and reports what is on screen.
// Run from the project root: node scripts/ui-check.mjs   (dev server must be on :5173)
import puppeteer from 'puppeteer-core';
const exe = '/home/noah/.hermes/tools/chromium-1208/chrome-linux64/chrome';
const b = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 950 });
await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2000));
for (let i = 0; i < 4; i++) {
  const ok = await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find(y => ['Next','Get started','Skip'].includes(y.textContent.trim())); if (x) { x.click(); return true; } return false; });
  if (!ok) break; await new Promise(r => setTimeout(r, 300));
}
await p.evaluate(() => [...document.querySelectorAll('nav button')].find(x => x.textContent.trim() === 'Library').click());
await p.waitForFunction(() => document.querySelectorAll('.grid .cell').length > 0, { timeout: 20000 });
const t0 = Date.now();
await p.evaluate(() => [...document.querySelectorAll('.seg button')].find(x => x.textContent.trim() === 'F2L').click());
await p.waitForFunction(() => document.querySelectorAll('.grid .cell').length > 0, { timeout: 20000 });
const firstMs = Date.now() - t0;
const firstCount = await p.evaluate(() => document.querySelectorAll('.grid .cell').length);
await new Promise(r => setTimeout(r, 2500));
const all = await p.evaluate(() => ({ cells: document.querySelectorAll('.grid .cell').length, faces: document.querySelectorAll('.grid .face').length }));
console.log('F2L first paint:', firstMs, 'ms with', firstCount, 'cells; after idle', all.cells, 'cells,', all.faces, 'faces');
const counts = await p.evaluate(() => {
  const t = document.body.innerText;
  const m = t.match(/(\d+) mastered · (\d+) learning · (\d+) new/);
  return m ? m[0] : 'none';
});
console.log('library F2L line:', counts);
await b.close();
