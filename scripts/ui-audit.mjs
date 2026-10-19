// Walks every screen at desktop and phone size and reports console errors, overflow and layout.
// Node scripts/ui-audit.mjs   (dev server on :5173)
import puppeteer from 'puppeteer-core';
const exe = '/home/noah/.hermes/tools/chromium-1208/chrome-linux64/chrome';
const b = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader'] });
const errors = [];
const p = await b.newPage();
p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 160)); });
p.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 160)));

async function ready() {
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1500));
  for (let i = 0; i < 4; i++) {
    const ok = await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find(y => ['Next', 'Get started', 'Skip'].includes(y.textContent.trim())); if (x) { x.click(); return true; } return false; });
    if (!ok) break; await new Promise(r => setTimeout(r, 300));
  }
}
const tab = async (name) => {
  await p.evaluate(n => [...document.querySelectorAll('nav button')].find(x => x.textContent.trim().startsWith(n))?.click(), name);
  await new Promise(r => setTimeout(r, 700));
};
const report = async (label) => {
  const r = await p.evaluate(() => ({
    overflow: document.scrollingElement.scrollHeight - innerHeight,
    sideways: document.scrollingElement.scrollWidth - innerWidth,
    h1: document.querySelector('h1')?.textContent ?? '',
  }));
  console.log(`${label}: ${r.h1} | vOverflow ${r.overflow} | hOverflow ${r.sideways}`);
};

for (const [w, h, isMobile, tag] of [[1280, 950, false, 'desktop'], [360, 800, true, 'phone']]) {
  await p.setViewport({ width: w, height: h, isMobile, deviceScaleFactor: 1 });
  await ready();
  for (const name of ['Solve', 'Train', 'Library', 'Drills', 'Settings']) {
    await tab(name);
    await report(`${tag} ${name}`);
  }
  // Library: open a case (sheet on phone)
  await tab('Library');
  await p.evaluate(() => document.querySelector('.grid .cell')?.click());
  await new Promise(r => setTimeout(r, 500));
  const sheet = await p.evaluate(() => {
    const el = document.getElementById('case-panel');
    if (!el) return 'no panel';
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return `${s.position} top=${Math.round(r.top)} bottom=${Math.round(r.bottom)} of ${innerHeight}`;
  });
  console.log(`${tag} Library case panel: ${sheet}`);
  // Train: start a session
  await tab('Train');
  for (let i = 0; i < 3; i++) {           // the first click after a tab switch can land before the screen mounts
    await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Start session')?.click());
    await new Promise(r => setTimeout(r, 500));
    if (await p.evaluate(() => document.body.textContent.includes('End session'))) break;
  }
  await report(`${tag} Train session`);
  await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'End session')?.click());
  await new Promise(r => setTimeout(r, 400));
}
console.log('errors:', errors.length ? [...new Set(errors)].join('\n  ') : 'none');
await b.close();
