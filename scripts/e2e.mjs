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
// textContent, not innerText: .card uses content-visibility:auto, which hides off-screen text from innerText
const text = () => page.evaluate(() => document.body.textContent);
const norm = s => (s ?? '').replace(/\s+/g, ' ').trim();
// count the rendered move spans rather than splitting on whitespace
const tokens = () => page.evaluate(() => [...document.querySelectorAll('.scr span')].map(s => s.textContent.trim()));
const scramble = () => page.evaluate(() => document.querySelector('.scr')?.textContent ?? '');
/** wait until the scramble line really carries a scramble */
async function waitForScramble(ms = 8000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const t = await tokens();
    if (t.length >= 18 && !t.some(x => /Generating/.test(x))) return t;
    await sleep(150);
  }
  return tokens();
}
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
const firstScr = await waitForScramble();
check('scramble is generated', firstScr.length >= 18, `(${firstScr.length} moves)`);
check('scramble moves are separated so it is readable', await page.evaluate(() => {
  const s = [...document.querySelectorAll('.scr span')];
  return s.length > 1 && s[1].getBoundingClientRect().left - s[0].getBoundingClientRect().right > 1;
}));
await hold(120); await sleep(100);
check('a too-short hold does not start the timer', /Hold to start/.test(await page.evaluate(() => document.querySelector('.big').textContent)));
await hold(450); await sleep(150);
check('long hold starts the timer', /Tap to stop/.test(await page.evaluate(() => document.querySelector('.big').textContent)));
// a tab shortcut in the middle of a solve must not walk away from it
await page.keyboard.press('Digit2'); await sleep(250);
const stillSolving = await page.evaluate(() => document.querySelector('.big')?.textContent ?? '');
check('a tab shortcut does not abandon a running solve', /Tap to stop/.test(stillSolving), `(button says "${stillSolving.trim()}")`);
await sleep(1300); await tap(); await sleep(300);
const afterSolve = await text();
check('solve is recorded', /History · 1/.test(afterSolve));
const shown = await page.evaluate(() => document.querySelector('.time').textContent);
check('displayed time is about the elapsed time', Math.abs(parseFloat(shown) - 1.3) < 0.5, `(${shown}s)`);
// Esc stops the clock instead of navigating away, and an abandoned solve is not recorded
await hold(450); await sleep(200); await page.keyboard.press('Escape'); await sleep(250);
check('Escape cancels a running solve without recording it',
  /Hold to start/.test(await page.evaluate(() => document.querySelector('.big').textContent)) && /History · 1/.test(await text()));

// --- persistence across a reload (IndexedDB)
await sleep(500); // store saves after a short debounce
await page.reload({ waitUntil: 'networkidle0' }); await sleep(600);
check('solve survives a reload', /History · 1/.test(await text()));
check('intro does not come back', await page.evaluate(() => !document.querySelector('[role=dialog]')));

// --- keyboard: +2 then DNF (defaults are Z and X)
await page.keyboard.press('KeyZ'); await sleep(100);
check('Z key applies +2', await page.evaluate(() => document.querySelector('.btn.on')?.textContent.trim() === '+2'));
await page.keyboard.press('KeyX'); await sleep(100);
check('X key switches to DNF', await page.evaluate(() => document.querySelector('.btn.on')?.textContent.trim() === 'DNF'));

// --- retry a scramble from History
await page.keyboard.press('KeyD'); await sleep(300);
check('history opens', /Best ao5/.test(await text()));
await page.evaluate(() => document.querySelector('main .card button.row')?.click()); await sleep(250);
const storedScr = await page.evaluate(() => {
  const row = [...document.querySelectorAll('main .card')].find(c => c.querySelector('button[aria-expanded=true]'));
  return row?.querySelector('.mono[style*=break-word]')?.textContent ?? '';
});
await clickText(page, 'Retry this scramble'); await sleep(500);
const retried = await waitForScramble(4000);
check('retry this scramble loads that solve\'s scramble', norm(storedScr).length > 0 && retried.join(' ') === norm(storedScr), `(${retried.length} moves)`);

// --- training flow
await clickText(page, 'Train', 'nav button'); await sleep(300);
check('Train opens on the Today screen', /Due for review/.test(await text()));
await clickText(page, 'Start session'); await sleep(400);
check('trainer shows a case scramble', (await tokens()).length > 3);
await hold(450); await sleep(900); await tap(); await sleep(1100); await tap(); await sleep(400);
const res = await text();
check('trainer reveals the attempt afterwards', /Last/.test(res) && /recog/.test(res));
check('case diagram is drawn', await page.evaluate(() => {
  const svg = document.querySelector('svg[role=img]');
  return !!svg && svg.querySelectorAll('rect').length >= 9 && svg.querySelectorAll('path').length >= 1;
}));
await page.keyboard.press('KeyW'); await sleep(300);
check('the next-case key moves to a new case', !/· recog/.test(await page.evaluate(() => document.querySelector('main').textContent)));
await page.keyboard.press('Escape'); await sleep(300);
check('Back returns to Today', /Due for review/.test(await text()));

// --- csTimer import
const cs = { session1: [[[0, 12340], "R U R' U'", '', 1700000000], [[2000, 10500], 'F B', '', 1700000100], [[-1, 20000], 'L D', '', 1700000200]], properties: { sessionData: JSON.stringify({ 1: { name: 'Main', opt: {} } }) } };
writeFileSync('/tmp/cstimer-export.txt', JSON.stringify(cs));
await clickText(page, 'Settings', 'nav button'); await sleep(300);
await (await page.$('input[type=file][accept*=".txt"]')).uploadFile('/tmp/cstimer-export.txt'); await sleep(500);
check('csTimer file is recognised', /csTimer: 3 solves/.test(await text()));
await clickText(page, 'Import'); await sleep(400);
check('import reports success', /Imported 3 solves/.test(await text()));

// --- themes and extra-large text must not overflow sideways
await clickText(page, 'Extra large'); await sleep(300);
const overflow = [];
for (const tab of ['Settings', 'Train', 'Library', 'Drills', 'Solve']) {
  await clickText(page, tab, 'nav button'); await sleep(400);
  const w = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
  if (w.s > w.c + 1) overflow.push(`${tab} (${w.s}>${w.c})`);
}
check('no sideways overflow at Extra large text on a 360px phone', overflow.length === 0, overflow.join(', '));
await clickText(page, 'Settings', 'nav button'); await sleep(200);
await clickText(page, 'Normal'); await sleep(200);

// --- offline web version (a build made with VITE_SW=1 registers the worker on a localhost preview)
await clickText(page, 'Solve', 'nav button'); await sleep(200);
const sw = await page.evaluate(async () => Promise.race([
  navigator.serviceWorker.ready.then(r => !!r.active),
  new Promise(res => setTimeout(() => res(false), 8000)),
]));
check('service worker is active', sw);
if (!sw) {
  // no worker means no offline answer: report it rather than silently skipping the checks
  check('app loads while offline', false, '(build with VITE_SW=1 to test this)');
  check('scrambles still work offline', false);
} else {
  await sleep(1500);
  // cut the network at the request layer: puppeteer's setOfflineMode is broken against this Chromium
  await page.setRequestInterception(true);
  const cut = r => { r.abort().catch(() => {}); };
  page.on('request', cut);
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(1500);
  check('app loads while offline', !!(await page.$('.big')));
  const offline = await waitForScramble(8000);
  check('scrambles still work offline', offline.length >= 18, `(${offline.length} moves)`);
  page.off('request', cut);
  await page.setRequestInterception(false);
}

check('no page or console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll end-to-end checks passed');
process.exit(failed ? 1 : 0);
