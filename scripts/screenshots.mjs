// Takes real screenshots of the running app (with demo data from scripts/seed-demo.ts) for the store listings.
// Run: npx vite-node scripts/seed-demo.ts > /tmp/seed.json && CHROME_PATH=... node scripts/screenshots.mjs
import { readFileSync, mkdirSync } from 'node:fs';
import { launch, BASE, sleep, clickText, seedData } from './browser.mjs';

const OUT = 'fastlane/metadata/android/en-US/images';
mkdirSync(`${OUT}/phoneScreenshots`, { recursive: true });
const seed = readFileSync(process.env.SEED ?? '/tmp/seed.json', 'utf8');
const browser = await launch();

async function fresh(viewport) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await seedData(page, seed);
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(2500);               // fonts, saved data and the first scramble
  return page;
}
const tab = (page, t) => clickText(page, t, 'nav button').then(() => sleep(500));
const press = async (page, ms) => { const b = await (await page.$('.big')).boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await sleep(ms); await page.mouse.up(); };
const tapDown = async page => { const b = await (await page.$('.big')).boundingBox(); await page.mouse.move(b.x + 20, b.y + 20); await page.mouse.down(); await page.mouse.up(); };

// ---- phone, 1080x2160
const phone = await fresh({ width: 360, height: 720, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const shot = async name => { await phone.screenshot({ path: `${OUT}/phoneScreenshots/${name}.png` }); console.log('wrote', name); };

await shot('1-solve');                                    // timer, stats, last solves
await clickText(phone, 'History'); await sleep(600); await shot('2-history');
await clickText(phone, 'Back'); await sleep(300);
await tab(phone, 'Train'); await shot('3-today');
await clickText(phone, 'Start session'); await sleep(500);
await press(phone, 450); await sleep(800); await tapDown(phone); await sleep(1300); await tapDown(phone); await sleep(500);
await shot('4-trainer');                                  // case revealed with diagram and grading
await phone.keyboard.press('Digit3'); await sleep(300); await phone.keyboard.press('Escape'); await sleep(300);
await tab(phone, 'Library');
await shot('5-library');
await clickText(phone, 'F2L', '.seg button'); await sleep(400);
await phone.evaluate(() => document.querySelectorAll('.grid .cell')[7]?.click()); await sleep(500);
await phone.evaluate(() => { const c = [...document.querySelectorAll('.card')].pop(); window.scrollTo(0, c.getBoundingClientRect().top + window.scrollY - 24); }); await sleep(300);
await shot('6-f2l');

// ---- desktop (for the README), 1280x800
const desk = await fresh({ width: 1280, height: 800, deviceScaleFactor: 1 });
await tab(desk, 'Train'); await clickText(desk, 'Start session'); await sleep(500);
await press(desk, 450); await sleep(800); await tapDown(desk); await sleep(1300); await tapDown(desk); await sleep(500);
mkdirSync('docs', { recursive: true });
await desk.screenshot({ path: 'docs/desktop-trainer.png' }); console.log('wrote desktop');

// ---- feature graphic 1024x500 and icon, rendered with the app's own bundled font
const g = await browser.newPage();
await g.setViewport({ width: 1024, height: 500, deviceScaleFactor: 1 });
await g.goto(BASE, { waitUntil: 'networkidle0' });
await g.evaluate(() => {
  document.getElementById('splash')?.remove();
  document.body.innerHTML = `<div style="position:fixed;inset:0;background:radial-gradient(circle at 24% 50%,#2a2f3f 0,#0F1115 62%);display:flex;align-items:center;gap:56px;padding:0 90px;font-family:Manrope,sans-serif;color:#E8EAF0">
    <img src="./logo.png" width="300" height="300" alt="">
    <div><div style="font-size:112px;font-weight:800;letter-spacing:-3px;line-height:1">Split</div>
    <div style="font-size:34px;font-weight:600;color:#A3ACBA;margin-top:18px;line-height:1.3">Time your solves.<br>Train your algorithms.<br><span style="color:#F5B83D">Fully offline.</span></div></div></div>`;
});
await g.evaluate(() => document.fonts.ready); await sleep(500);
await g.screenshot({ path: `${OUT}/featureGraphic.png` }); console.log('wrote featureGraphic');
await browser.close();
