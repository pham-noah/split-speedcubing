// End-to-end checks in a real browser against a running build (npm run build && npm run preview).
// Run: CHROME_PATH=/path/to/chrome node scripts/e2e.mjs
import { writeFileSync } from 'node:fs';
import { launch, BASE, sleep, clickText } from './browser.mjs';

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) failed++; };

const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(BASE, { waitUntil: 'networkidle0' });
await sleep(600);
const text = () => page.evaluate(() => document.body.innerText);
const hold = async (ms = 450) => {
  const b = await (await page.$('.big')).boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down(); await sleep(ms); await page.mouse.up();
};
const tap = async () => { const b = await (await page.$('.big')).boundingBox(); await page.mouse.move(b.x + 20, b.y + 20); await page.mouse.down(); await page.mouse.up(); };

// --- first launch
check('splash is removed', await page.evaluate(() => !document.getElementById('splash')));
check('intro dialog shows', await page.evaluate(() => !!document.querySelector('[role=dialog]')));
await clickText(page, 'Next'); await clickText(page, 'Next'); await clickText(page, 'Get started'); await sleep(200);
check('intro can be completed', await page.evaluate(() => !document.querySelector('[role=dialog]')));
check('timer button present', !!(await page.$('.big')));

// --- timing a solve with real pointer input
await sleep(2500); // let the first scramble arrive
const scr = await page.evaluate(() => document.querySelector('.scr').textContent.trim());
check('scramble is generated', scr.split(/\s+/).length >= 18, `(${scr.split(/\s+/).length} moves)`);
await hold(120); await sleep(100);
check('a too-short hold does not start the timer', /Hold to start/.test(await page.evaluate(() => document.querySelector('.big').textContent)));
await hold(450); await sleep(150);
check('long hold starts the timer', /Tap to stop/.test(await page.evaluate(() => document.querySelector('.big').textContent)));
await sleep(1300); await tap(); await sleep(300);
const afterSolve = await text();
check('solve is recorded', /History · 1/.test(afterSolve));
const shown = await page.evaluate(() => document.querySelector('.time').textContent);
check('displayed time is about the elapsed time', Math.abs(parseFloat(shown) - 1.3) < 0.5, `(${shown}s)`);

// --- persistence across a reload (IndexedDB)
await sleep(500); // store saves after a short debounce
await page.reload({ waitUntil: 'networkidle0' }); await sleep(600);
check('solve survives a reload', /History · 1/.test(await text()));
check('intro does not come back', await page.evaluate(() => !document.querySelector('[role=dialog]')));

// --- keyboard: +2 then DNF
await page.keyboard.press('KeyP'); await sleep(100);
check('P key applies +2', await page.evaluate(() => document.querySelector('.btn.on')?.textContent.trim() === '+2'));
await page.keyboard.press('KeyD'); await sleep(100);
check('D key switches to DNF', await page.evaluate(() => document.querySelector('.btn.on')?.textContent.trim() === 'DNF'));

// --- training flow
await clickText(page, 'Train', 'nav button'); await sleep(300);
check('Train opens on the Today screen', /Due for review/.test(await text()));
await clickText(page, 'Start session'); await sleep(400);
check('trainer shows a case scramble', (await page.evaluate(() => document.querySelector('.scr')?.textContent.trim().length)) > 10);
await hold(450); await sleep(900); await tap(); await sleep(1100); await tap(); await sleep(400);
const res = await text();
check('trainer reveals the case and asks for a grade', /How did it go/.test(res) && /Recog/.test(res));
check('case diagram is drawn', await page.evaluate(() => document.querySelectorAll('svg[role=img] rect').length >= 21));
await page.keyboard.press('Digit3'); await sleep(300);
check('grading with a key moves to the next case', !/How did it go/.test(await text()));
await page.keyboard.press('Escape'); await sleep(300);
check('Back returns to Today', /Due for review/.test(await text()));
check('Today now shows reviews', /Start session/.test(await text()));

// --- csTimer import
const cs = { session1: [[[0, 12340], "R U R' U'", '', 1700000000], [[2000, 10500], 'F B', '', 1700000100], [[-1, 20000], 'L D', '', 1700000200]], properties: { sessionData: JSON.stringify({ 1: { name: 'Main', opt: {} } }) } };
writeFileSync('/tmp/cstimer-export.txt', JSON.stringify(cs));
await clickText(page, 'Settings', 'nav button'); await sleep(300);
await (await page.$('input[type=file][accept*=".txt"]')).uploadFile('/tmp/cstimer-export.txt'); await sleep(500);
check('csTimer file is recognised', /csTimer: 3 solves/.test(await text()));
await clickText(page, 'Import'); await sleep(400);
check('import reports success', /Imported 3 solves/.test(await text()));

// --- themes and extra-large text must not overflow sideways
await clickText(page, 'Extra large'); await sleep(200);
const overflow = [];
for (const tab of ['Settings', 'Train', 'Library', 'Drills', 'Solve']) {
  await clickText(page, tab, 'nav button'); await sleep(400);
  const w = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
  if (w.s > w.c + 1) overflow.push(`${tab} (${w.s}>${w.c})`);
}
check('no sideways overflow at Extra large text on a 360px phone', overflow.length === 0, overflow.join(', '));
await clickText(page, 'Settings', 'nav button'); await clickText(page, 'Normal');

// --- offline web version
await clickText(page, 'Solve', 'nav button');
const sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
check('service worker is active', sw);
await sleep(1500);
await page.setOfflineMode(true);
await page.reload({ waitUntil: 'networkidle0' }); await sleep(800);
check('app loads while offline', !!(await page.$('.big')));
await sleep(2500);
const offlineScr = await page.evaluate(() => document.querySelector('.scr')?.textContent.trim());
check('scrambles still work offline', offlineScr && offlineScr.split(/\s+/).length >= 18 && !/Generating/.test(offlineScr));
await page.setOfflineMode(false);

check('no page or console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll end-to-end checks passed');
process.exit(failed ? 1 : 0);
