// Train home: the Progress card, desktop and phone. node scripts/ui-check-train.mjs
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
await p.evaluate(() => [...document.querySelectorAll('nav button')].find(x => x.textContent.trim().startsWith('Train')).click());
await p.waitForFunction(() => document.body.innerText.includes('Progress'), { timeout: 20000 });
console.log('desktop:', (await p.evaluate(() => document.body.innerText.match(/Progress[\s\S]{0,150}/)?.[0] ?? 'none')).replace(/\n/g, ' | '));
await p.screenshot({ path: '/home/noah/.hermes/cache/scratch/train-progress.png' });
const bars = await p.evaluate(() => [...document.querySelectorAll('[aria-label="Progress by set"] div[style*="height:100%"]')].map(d => d.style.width));
console.log('bars:', bars.join(' '));
await p.setViewport({ width: 360, height: 800, isMobile: true, deviceScaleFactor: 2 });
await new Promise(r => setTimeout(r, 700));
console.log('phone overflow:', await p.evaluate(() => document.scrollingElement.scrollHeight - innerHeight));
await p.screenshot({ path: '/home/noah/.hermes/cache/scratch/train-progress-phone.png' });
await b.close();
