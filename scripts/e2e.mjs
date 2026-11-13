// End-to-end checks in a real browser against a running build (npm run build && npm run preview).
// Run: CHROME_PATH=/path/to/chrome node scripts/e2e.mjs
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
// the version the app will report, read from the manifest instead of remembered here: a bump used to
// break this check on the tag build and nowhere else
const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
import { launch, BASE, sleep, clickText } from './browser.mjs';

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) failed++; };

const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
// the URL matters as much as the message: "Failed to load resource" says nothing on its own
page.on('console', m => { if (m.type() === 'error') errors.push(`${m.text()} @ ${m.location()?.url ?? ''}`); });

await page.goto(BASE, { waitUntil: 'networkidle0' });
await sleep(600);
// textContent, not innerText: .card uses content-visibility:auto, which hides off-screen text from innerText
const text = () => page.evaluate(() => document.body.textContent);
const norm = s => (s ?? '').replace(/\s+/g, ' ').trim();
// count the rendered move spans rather than splitting on whitespace
const tokens = () => page.evaluate(() => [...document.querySelectorAll('.scr span')].map(s => s.textContent.trim()));
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

// boot is not finished when the network is idle: poll rather than sample once
const waitGone = async (sel, ms = 8000) => {
  for (let i = 0; i < ms / 100; i++) {
    if (await page.evaluate(s => !document.querySelector(s), sel)) return true;
    await sleep(100);
  }
  return false;
};

// --- first launch
check('the web shell is the one that loaded', await page.evaluate(() => document.documentElement.dataset.platform === 'web'));
check('splash is removed', await waitGone('#splash'));
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
// Start the clock from the page's own clock: sleeps and round-trips stretch on a loaded machine.
const clockStart = await page.evaluate(() => performance.now() - (parseFloat(document.querySelector('.time').textContent) || 0) * 1000);
// a tab shortcut in the middle of a solve must not walk away from it
await page.keyboard.press('Digit2'); await sleep(250);
const stillSolving = await page.evaluate(() => document.querySelector('.big')?.textContent ?? '');
check('a tab shortcut does not abandon a running solve', /Tap to stop/.test(stillSolving), `(button says "${stillSolving.trim()}")`);
// the same with a real tap on the tab bar
await page.evaluate(() => [...document.querySelectorAll('nav[aria-label="Main"] button')].find(b => b.textContent.trim() === 'Library')?.click());
await sleep(250);
const afterTabTap = await page.evaluate(() => document.querySelector('.big')?.textContent ?? '');
check('tapping a tab does not abandon a running solve', /Tap to stop/.test(afterTabTap), `(button says "${afterTabTap.trim()}")`);
await sleep(400); await tap();
const ran = await page.evaluate(s => (performance.now() - s) / 1000, clockStart);   // read against the stop, not after it
await sleep(300);
const afterSolve = await text();
check('solve is recorded', /History · 1/.test(afterSolve));
const shown = await page.evaluate(() => document.querySelector('.time').textContent);
check('displayed time is about the elapsed time', Math.abs(parseFloat(shown) - ran) < 0.35, `(${shown}s vs ${ran.toFixed(2)}s run)`);
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

// --- phase splits (opt-in): a second surface that marks a phase instead of stopping the clock
await clickText(page, 'Settings', 'nav[aria-label="Main"] button'); await sleep(400);
await clickText(page, 'Split timing'); await sleep(200);
check('split timing can be switched on', await page.evaluate(() =>
  [...document.querySelectorAll('label')].some(l => /Split timing/.test(l.textContent) && l.querySelector('input').checked)));
await clickText(page, 'Solve', 'nav[aria-label="Main"] button'); await sleep(300);
await hold(450); await sleep(150);
const pillShown = !!(await page.$('.split-press'));
check('a split pill appears once the clock runs', pillShown);
if (pillShown) {
  const box = await (await page.$('.split-press')).boundingBox();
  const tapAt = async (b) => { await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.mouse.up(); await sleep(220); };
  const tapPill = () => tapAt(box);
  await sleep(150); await tapPill();
  await sleep(200); await tapPill();
  const count = await page.evaluate(() => document.querySelector('.split-press')?.textContent ?? '');
  check('tapping the pill marks a phase without stopping the clock', /2\/3/.test(count) && /Tap to stop/.test(await page.evaluate(() => document.querySelector('.big').textContent)), norm(count));
  // a mark on the wrong phase is undoable while the clock runs
  const undoBox = await (await page.$('.split-undo'))?.boundingBox();
  if (undoBox) { await tapAt(undoBox); await sleep(250); }
  const afterUndo = await page.evaluate(() => document.querySelector('.split-press')?.textContent ?? '');
  check('undo takes the last mark back', /1\/3/.test(afterUndo), norm(afterUndo));
  await tapPill(); await tapPill();   // three marks again: Cross, F2L, OLL, then the stop ends PLL
}
await tap(); await sleep(400);
const splitCard = await page.evaluate(() => {
  const c = [...document.querySelectorAll('main .card')].find(x => /Phases/.test(x.textContent));
  return c ? c.textContent.replace(/\s+/g, ' ').trim() : '';
});
check('the last solve shows its phases', /Cross/.test(splitCard) && /F2L/.test(splitCard) && /PLL/.test(splitCard), splitCard.slice(0, 80));
check('the phase bar is drawn', await page.evaluate(() => (document.querySelectorAll('.phbar > span').length ?? 0) >= 2));
// the phase that took the longest is one tap away from the set that trains it
const drill = await page.evaluate(() => [...document.querySelectorAll('button')].find(b => /^Drill /.test(b.textContent.trim()))?.textContent.trim() ?? '');
check('the phase card offers the matching trainer set', /^Drill (Cross|F2L|OLL|PLL)$/.test(drill), drill);
if (drill) {
  const wantSet = drill.replace('Drill ', '');
  await clickText(page, drill); await sleep(700);
  const trained = await text();
  check('that link opens a session on that set', new RegExp(`Recognition · ${wantSet}`).test(trained) || new RegExp(`Execution · ${wantSet}`).test(trained), wantSet);
  await clickText(page, 'Solve', 'nav[aria-label="Main"] button'); await sleep(400);
}
// and it survives the reload, through normalize(), which validates every field of a stored solve
await sleep(600); await page.reload({ waitUntil: 'networkidle0' }); await sleep(800);
await page.keyboard.press('KeyD'); await sleep(400);
await page.evaluate(() => document.querySelector('main .card button.row')?.click()); await sleep(400);
const reloaded = await page.evaluate(() => {
  const c = [...document.querySelectorAll('main .card')].find(x => x.querySelector('[aria-expanded=true]'));
  return c ? c.textContent.replace(/\s+/g, ' ') : '';
});
check('a phase split is saved and read back', /Cross|CROSS/.test(reloaded), reloaded.slice(0, 80));
await page.keyboard.press('Escape'); await sleep(300);
await clickText(page, 'Settings', 'nav[aria-label="Main"] button'); await sleep(300);
await clickText(page, 'Split timing'); await sleep(200);   // leave it off, as shipped
await clickText(page, 'Solve', 'nav[aria-label="Main"] button'); await sleep(300);

// --- 2x2: its own session, its own scrambles, no 3x3 history mixed in
const before = await page.evaluate(() => document.querySelector('.history-btn')?.textContent.match(/\d+/)?.[0] ?? '0');
await page.evaluate(() => [...document.querySelectorAll('.seg[aria-label="Puzzle"] button')].find(b => b.textContent.trim() === '2x2')?.click());
await sleep(900);
check('the puzzle switch moves to a 2x2 session', await page.evaluate(() =>
  document.querySelector('.seg[aria-label="Puzzle"] button[aria-pressed="true"]')?.textContent.trim() === '2x2'
  && /2x2/.test(document.querySelector('.chip')?.textContent ?? '')),
  await page.evaluate(() => document.querySelector('.chip')?.textContent.trim() ?? ''));
check('the 2x2 session starts empty', await page.evaluate(() => /History · 0/.test(document.querySelector('.history-btn')?.textContent ?? '')));
const sq = await waitForScramble(6000);
check('a 2x2 scramble arrives and stays 2x2-sized', sq.length > 3 && sq.length <= 14 && !sq.some(t => /^[DB]/.test(t)), `(${sq.length} moves)`);
await hold(450); await sleep(400); await tap(); await sleep(500);
check('the 2x2 solve lands in the 2x2 session', await page.evaluate(() => /History · 1/.test(document.querySelector('.history-btn')?.textContent ?? '')));
await page.evaluate(() => [...document.querySelectorAll('.seg[aria-label="Puzzle"] button')].find(b => b.textContent.trim() === '3x3')?.click());
await sleep(900);
check('switching back leaves the 3x3 history exactly as it was', await page.evaluate((n) => new RegExp(`History · ${n}`).test(document.querySelector('.history-btn')?.textContent ?? ''), before), `(${before} solves)`);

// --- training flow
await clickText(page, 'Train', 'nav[aria-label="Main"] button'); await sleep(300);
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

// --- the F2L library: 41 cases once, a group filter, and the four slots inside the case
await clickText(page, 'Library', 'nav[aria-label="Main"] button'); await sleep(400);
await page.evaluate(() => { const b = [...document.querySelectorAll('.seg button')].find(x => x.textContent.trim() === 'F2L'); b.click(); });
await sleep(1500);
const groups = await page.evaluate(() => [...document.querySelectorAll('.seg.groups button')]
  .map(b => ({ label: b.getAttribute('aria-label') || '', total: document.querySelectorAll('.grid .cell').length })));
check('the F2L tab lists the 41 front-right cases once',
  await page.evaluate(() => document.querySelectorAll('.grid .cell').length) === 41);
check('its filter is speedcubedb\'s six groups with counts',
  groups.length === 7 && /^Connected Pairs, 0 of 10/.test(groups[1].label) && /^Pieces In Slot, 0 of 5/.test(groups[6].label),
  `${groups.length - 1} groups`);
const cornerCells = await page.evaluate(async () => {
  const b = [...document.querySelectorAll('.seg.groups button')].find(x => (x.getAttribute('aria-label') || '').startsWith('Corner In Slot'));
  b.click();
  await new Promise(r => setTimeout(r, 700));
  return document.querySelectorAll('.grid .cell').length;
});
check('picking a single group narrows the grid to that group', cornerCells === 6, `(${cornerCells} cells)`);
const slots = await page.evaluate(async () => {
  const all = [...document.querySelectorAll('.seg.groups button')].find(x => (x.getAttribute('aria-label') || '') === 'All groups');
  all.click();
  await new Promise(r => setTimeout(r, 600));
  document.querySelector('.grid .cell').click();
  await new Promise(r => setTimeout(r, 900));
  const panel = document.querySelector('#case-panel');
  if (!panel) return null;
  const tabs = [...panel.querySelectorAll('.seg[aria-label="Slot for this case"] button')].map(b => b.textContent.trim());
  const alg = () => panel.querySelector('[role=radio] .mono')?.textContent.trim();
  const first = alg();
  [...panel.querySelectorAll('.seg[aria-label="Slot for this case"] button')].find(b => b.textContent.trim() === 'FL').click();
  await new Promise(r => setTimeout(r, 700));
  return { tabs, first, fl: alg(), title: panel.textContent.includes('· FL') };
});
check('the opened F2L case offers FR / FL / BL / BR', !!slots && slots.tabs.join(',') === 'FR,FL,BL,BR', slots ? slots.tabs.join(',') : 'no panel');
check('choosing FL shows that slot\'s rotated algorithm', !!slots && slots.fl !== slots.first && slots.title, slots ? `${slots.first} -> ${slots.fl}` : '');
await page.keyboard.press('Escape'); await sleep(500);
check('no update check on the web build', await page.evaluate(() => !document.body.textContent.includes('Check for updates')));
await clickText(page, 'Solve', 'nav[aria-label="Main"] button'); await sleep(300);

// --- Settings: About credits the author and links the source
await clickText(page, 'Settings', 'nav[aria-label="Main"] button'); await sleep(400);
check('About names the author and links GitHub', await page.evaluate(() => {
  const a = [...document.querySelectorAll('a[href]')].find(x => x.getAttribute('href') === 'https://github.com/pham-noah');
  const about = document.body.textContent.includes('Built by Noah Pham');
  return !!a && about && a.getAttribute('target') === '_blank';
}));
check('About offers a pre-filled issue report', await page.evaluate((version) => {
  const link = (label) => [...document.querySelectorAll('a[href]')].find(a => a.textContent.trim() === label);
  const report = link('Report a problem'), list = link('Open issues');
  if (!report || !list) return false;
  const href = decodeURIComponent(report.getAttribute('href') || '');
  return report.getAttribute('href').startsWith('https://github.com/pham-noah/split-speedcubing/issues/new?')
    && href.includes('What happened') && href.includes('What you expected') && href.includes(`Split ${version}`)
    && list.getAttribute('href') === 'https://github.com/pham-noah/split-speedcubing/issues';
}, VERSION));

await clickText(page, 'Solve', 'nav[aria-label="Main"] button'); await sleep(300);

// --- csTimer import
const cs = { session1: [[[0, 12340], "R U R' U'", '', 1700000000], [[2000, 10500], 'F B', '', 1700000100], [[-1, 20000], 'L D', '', 1700000200]], properties: { sessionData: JSON.stringify({ 1: { name: 'Main', opt: {} } }) } };
// a path Chrome and node both understand: /tmp does not mean the same directory on Windows
const csFile = join(tmpdir(), 'cstimer-export.txt');
writeFileSync(csFile, JSON.stringify(cs));
await clickText(page, 'Settings', 'nav[aria-label="Main"] button'); await sleep(300);
await (await page.$('input[type=file][accept*=".txt"]')).uploadFile(csFile); await sleep(500);
check('csTimer file is recognised', /csTimer: 3 solves/.test(await text()));
await clickText(page, 'Import'); await sleep(400);
check('import reports success', /Imported 3 solves/.test(await text()));

// --- themes and extra-large text must not overflow sideways
await clickText(page, 'Extra large'); await sleep(300);
const overflow = [];
for (const tab of ['Settings', 'Train', 'Library', 'Drills', 'Solve']) {
  await clickText(page, tab, 'nav[aria-label="Main"] button'); await sleep(400);
  // Two questions, because they fail differently: does the document scroll sideways (measured against the
  // viewport, not the client area, so a classic scrollbar's 2px is not counted as overflow), and is there
  // any element inside the page that sticks out of the box that would have to clip it.
  const w = await page.evaluate(() => {
    const de = document.documentElement;
    const clipped = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const st = getComputedStyle(p);
        if (['hidden', 'auto', 'scroll'].includes(st.overflowX) || st.position === 'fixed') return true;
      }
      return false;
    };
    const out = [...document.querySelectorAll('main *')].filter((el) => el.getBoundingClientRect().right > de.clientWidth + 0.5 && !clipped(el));
    return { s: de.scrollWidth, c: de.clientWidth, i: innerWidth, out: out.length, first: out[0] ? `${out[0].tagName}.${String(out[0].className).slice(0, 20)}` : '' };
  });
  if (w.s > Math.max(w.c, w.i) + 1 || w.out) overflow.push(`${tab} (${w.s}>${Math.max(w.c, w.i)}${w.out ? `, ${w.out} element(s) out: ${w.first}` : ''})`);
}
check('no sideways overflow at Extra large text on a 360px phone', overflow.length === 0, overflow.join(', '));
await clickText(page, 'Settings', 'nav[aria-label="Main"] button'); await sleep(200);
await clickText(page, 'Normal'); await sleep(200);

// --- offline web version (a build made with VITE_SW=1 registers the worker on a localhost preview)
await clickText(page, 'Solve', 'nav[aria-label="Main"] button'); await sleep(200);
const sw = await page.evaluate(async () => Promise.race([
  navigator.serviceWorker.ready.then(r => !!r.active),
  new Promise(done => setTimeout(() => done(false), 8000)),
]));
// A normal build never registers the worker (main.ts gates it on VITE_SW=1 outside localhost), so these
// three cannot pass there: skip them rather than report a FAIL that hides a real offline regression.
// EXPECT_SW=1 is set by `npm run e2e:offline`.
if (!sw && process.env.EXPECT_SW !== '1') {
  for (const name of ['service worker is active', 'app loads while offline', 'scrambles still work offline']) {
    console.log(`SKIP  ${name}  (needs an offline build: npm run test:e2e:offline)`);
  }
} else {
check('service worker is active', sw);
if (!sw) {
  check('app loads while offline', false, '(VITE_SW=1 build expected but no worker registered)');
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
}

check('no page or console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll end-to-end checks passed');
process.exit(failed ? 1 : 0);
