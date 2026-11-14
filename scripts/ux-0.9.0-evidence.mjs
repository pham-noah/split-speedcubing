// 0.9.0 UX evidence pack + the C24 fit proof, in a real browser against a running dev/preview build.
// Run: CHROME_PATH=... BASE_URL=http://localhost:5173/ node scripts/ux-0.9.0-evidence.mjs
// Writes docs/ux/evidence/*.png (one or two per change) and docs/ux/evidence/measurements.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch, BASE, sleep, clickText } from './browser.mjs';

const OUT = 'docs/ux/evidence';
mkdirSync(OUT, { recursive: true });
const shots = [];
const log = { sizes: {}, states: {}, checks: {} };

/** Seed the app's own IndexedDB (v3: meta in kv['app'], solves in 'solves', cards in 'cards').
 *  scripts/browser.mjs still opens v2, and a v2 open throws VersionError against the live v3 store. */
async function seed(page, json) {
  await page.evaluate(async (j) => {
    const data = JSON.parse(j);
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('cube-trainer');   // no version: whatever the app already made
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const { solves = [], cards = {}, ...meta } = data;
    await new Promise((res, rej) => {
      const tx = db.transaction(['kv', 'solves', 'cards'], 'readwrite');
      tx.objectStore('kv').put(meta, 'app');
      const sv = tx.objectStore('solves');
      sv.clear();
      for (const s of solves) sv.put(s);
      const cd = tx.objectStore('cards');
      cd.clear();
      for (const [id, c] of Object.entries(cards)) cd.put({ ...c, id });
      tx.oncomplete = () => { db.close(); res(); };
      tx.onerror = () => rej(tx.error);
    });
  }, json);
}

const SIZES = [
  { w: 390, h: 844, tag: '390' },
  { w: 360, h: 640, tag: '360' },
];

/** a solve list: three split solves (comparable deltas), one plain, the last one on screen */
function seedData_(over = {}) {
  const now = Date.now();
  const mk = (i, ms, splits) => ({ id: `s${i}`, ms, pen: '', scramble: 'R U2 F D2 L B2 R2 U F2 D L2 U2 B2 R F2 L U\'' , event: '333', ts: now - (10 - i) * 60000, session: 'default', ...(splits ? { splits } : {}) });
  const solves = [
    mk(1, 20400, [1700, 7200, 3100, 8400]),
    mk(2, 19800, [1600, 7000, 3000, 8200]),
    mk(3, 18900, [1500, 6700, 2900, 7800]),
    mk(4, 18420, [1320, 6400, 3100, 7600]),
  ];
  return JSON.stringify({
    v: 1,
    cards: {},
    drills: [],
    sessions: [{ id: 'default', name: 'Session 1' }],
    session: 'default',
    zbll: [],
    settings: {
      theme: 'midnight', textSize: 100, holdMs: 300, tapStart: false, inspection: false, beeps: false,
      hideTime: false, retention: 0.9, keys: {}, hidden: {}, introSeen: true, coverOn: true, coverColor: '',
      accent: '', walkAutoplay: false, walkSpeed: 900, cubeColors: [], swapRO: false, autoBackup: false,
      splits: true, splitNudgeSeen: true, ...(over.settings ?? {}),
    },
    solves: over.solves ?? solves,
  });
}

const browser = await launch();

async function open(viewport, seedJson) {
  const page = await browser.newPage();
  await page.setViewport({ ...viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
  await seed(page, seedJson);
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('.page', { timeout: 20000 });
  await sleep(900); // fonts
  // a real scramble, not "Generating scramble…": the placeholder is one line, the scramble is two or
  // three, and at 130 % that difference is the whole fit budget
  for (let i = 0; i < 60; i++) {
    if ((await page.evaluate(() => document.querySelectorAll('.scr span').length)) >= 15) break;
    await sleep(150);
  }
  await sleep(400);
  return page;
}

async function shot(page, name) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path });
  shots.push(name);
  return name;
}

const boxOf = (page, sel) =>
  page.evaluate((s) => {
    const e = document.querySelector(s);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom), top: Math.round(r.top) };
  }, sel);

/** the four numbers C24 asks for, in one place */
const fit = (page) =>
  page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Main"]').getBoundingClientRect();
    const stats = document.querySelector('.stats-bar')?.getBoundingClientRect() ?? null;
    const card = [...document.querySelectorAll('.card')]
      .map((c) => c.getBoundingClientRect())
      .sort((a, b) => b.bottom - a.bottom)[0];
    return {
      doc: document.documentElement.scrollHeight,
      view: innerHeight,
      navTop: Math.round(nav.top),
      statsBottom: stats ? Math.round(stats.bottom) : null,
      statsH: stats ? Math.round(stats.height) : null,
      phaseStripH: (() => { const p = document.querySelector('.phases-card'); return p ? Math.round(p.getBoundingClientRect().height) : null; })(),
      lowestCardBottom: card ? Math.round(card.bottom) : null,
      clearance: Math.round(nav.top - (card ? card.bottom : nav.top)),
      scrH: Math.round(document.querySelector('.scr')?.getBoundingClientRect().height ?? 0),
      stack: [...document.querySelectorAll('.col.solve-col > *')].map((e) => ({
        tag: (e.className || e.tagName).toString().slice(0, 26),
        h: Math.round(e.getBoundingClientRect().height),
      })),
    };
  });

/** the worst case for the bottom of the stack: a three-line scramble at 130 % is ~40 px taller than a
 *  two-line one, and the scramble is random, so sample several and keep the lowest clearance.
 *  With `shotName` the *worst* frame is written (buffered, not the last one sampled) — C24 has to prove
 *  the fit in the case that fails, not in the case that happens to be on screen at the end. */
async function worstFit(page, tries = 8, shotName = null) {
  let worst = await fit(page);
  let worstPng = shotName ? await page.screenshot() : null;
  for (let i = 0; i < tries; i++) {
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'New scramble')?.click());
    await sleep(900);
    const m = await fit(page);
    if (m.clearance < worst.clearance) {
      worst = m;
      if (shotName) worstPng = await page.screenshot();
    }
  }
  if (shotName && worstPng) {
    writeFileSync(`${OUT}/${shotName}.png`, worstPng);
    shots.push(shotName);
  }
  return worst;
}

// ---------------------------------------------------------------- Solve, post-solve, 100 % and 130 %
for (const size of SIZES) {
  for (const text of [100, 130]) {
    const page = await open({ width: size.w, height: size.h }, seedData_({ settings: { textSize: text } }));
    // the worst frame of the sample, so the pack carries the case that is closest to failing
    const m = text === 130 ? await worstFit(page, 8, `c24-worst-${size.tag}-130`) : await fit(page);
    log.sizes[`${size.tag}@${text}`] = m;
    if (text === 100) {
      await shot(page, `c02-c03-c05-c06-c07-solve-${size.tag}`);
      await shot(page, `c04-setup-row-${size.tag}`);
    } else {
      await shot(page, `c06-c07-solve-130-${size.tag}`);
    }
    await page.close();
  }
}

// ---------------------------------------------------------------- C24.5: the two other themes
// Every rule has to read on `--bg #000` with `--line #fff` (contrast) and on the amoled card: the pill's
// tokens and the stats bar's hairlines are the two things that can vanish there.
for (const theme of ['contrast', 'amoled']) {
  const page = await open({ width: 390, height: 844 }, seedData_({ settings: { theme } }));
  log.states[`theme-${theme}`] = await fit(page);
  log.states[`theme-${theme}`].tokens = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return ['--pill', '--pill-edge', '--on-pill', '--line', '--card'].map((t) => `${t}=${s.getPropertyValue(t).trim()}`).join(' | ');
  });
  await shot(page, `c00-theme-${theme}-390`);
  if (theme === 'contrast') {
    // the pill over the flood on the theme with the loudest `--line`: the rail dashes are the only
    // non-text indicator in the whole change set, and this is where they can disappear
    const big = await boxOf(page, '.big');
    await page.mouse.move(big.x + big.w / 2, big.y + big.h / 2);
    await page.mouse.down();
    await sleep(450);
    await page.mouse.up();
    await sleep(350);
    await page.evaluate(() => document.querySelector('.split-press').click());
    await sleep(250);
    log.states['pill-contrast'] = await page.evaluate(() => {
      const e = document.querySelector('.split-press');
      const on = document.querySelector('.sp-rail i.on');
      const off = document.querySelector('.sp-rail i');
      const cs = (n) => getComputedStyle(n).backgroundColor;
      return { label: e.querySelector('.sp-label').textContent.trim(), filled: on ? cs(on) : null, empty: cs(off) };
    });
    await shot(page, 'c13-pill-contrast-390');
  }
  await page.close();
}

// ---------------------------------------------------------------- C8: short phone (360x640) @130 %
{
  const page = await open({ width: 360, height: 640 }, seedData_({ settings: { textSize: 130 } }));
  log.states.c08 = await fit(page);
  await shot(page, 'c08-short-360-130');
  await page.close();
}

// ---------------------------------------------------------------- C9 + C15 + C20 + fresh install
for (const size of SIZES) {
  const page = await open(
    { width: size.w, height: size.h },
    seedData_({ solves: [], settings: { splits: false, splitNudgeSeen: false, introSeen: true } }),
  );
  log.states[`fresh-${size.tag}`] = await fit(page);
  log.states[`fresh-${size.tag}`].pensOpacity = await page.evaluate(() =>
    [...document.querySelectorAll('.pens .btn')].map((b) => ({ disabled: b.disabled, opacity: getComputedStyle(b).opacity })),
  );
  await shot(page, `c09-c15-c20-fresh-${size.tag}`);

  if (size.tag === '390') {
    // C15 → C17 → C18: one tap turns it on, lands on the switch, and shows the confirmation card
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Turn on').click());
    await sleep(900);
    log.checks.nudgeDeepLink = await page.evaluate(() => ({
      view: document.querySelector('h1')?.textContent?.trim(),
      focused: document.activeElement?.id ?? document.activeElement?.tagName,
      splitsOn: !!document.querySelector('#split-toggle')?.checked,
      cardShown: document.body.textContent.includes('Split timing is on'),
      timerHeadingY: Math.round(document.getElementById('tm-h').getBoundingClientRect().top),
      toggleY: Math.round(document.getElementById('split-toggle').getBoundingClientRect().top),
    }));
    await shot(page, 'c17-settings-arrival-390');
    await shot(page, 'c18-settings-confirm-390');
    // C18: the button back to the timer
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Try it on the timer').click());
    await sleep(900);
    log.checks.settingsBackToSolve = await page.evaluate(() => document.querySelector('h1')?.textContent?.trim());
  }
  await page.close();
}

// ---------------------------------------------------------------- C16: the dismissal survives a reload
{
  const page = await open(
    { width: 390, height: 844 },
    seedData_({ solves: [], settings: { splits: false, splitNudgeSeen: true, introSeen: true } }),
  );
  log.checks.nudgeHiddenAfterSeen = await page.evaluate(() => !document.body.textContent.includes('Want the phase breakdown?'));
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(1200);
  log.checks.nudgeStillHiddenAfterReload = await page.evaluate(() => !document.body.textContent.includes('Want the phase breakdown?'));
  await page.close();
}

// ---------------------------------------------------------------- C12/C13/C14: the pill at 0..3 marks
{
  const page = await open({ width: 390, height: 844 }, seedData_());
  const big = await boxOf(page, '.big');
  const hold = async () => {
    await page.mouse.move(big.x + big.w / 2, big.y + big.h / 2);
    await page.mouse.down();
    await sleep(450);
    await page.mouse.up();
    await sleep(250);
  };
  const stop = async () => {
    await page.mouse.move(20, 20);
    await page.mouse.down();
    await page.mouse.up();
    await sleep(700);
  };
  const xs = [];
  for (let n = 0; n <= 3; n++) {
    await hold();
    for (let k = 0; k < n; k++) {
      const p = await boxOf(page, '.split-press');
      await page.mouse.click(p.x + p.w / 2, p.y + p.h / 2);
      await sleep(220);
    }
    const state = await page.evaluate(() => {
      const e = document.querySelector('.split-press');
      const u = document.querySelector('.split-undo');
      return {
        x: Math.round(e.getBoundingClientRect().x),
        w: Math.round(e.getBoundingClientRect().width),
        label: e.querySelector('.sp-label').textContent.trim(),
        count: e.querySelector('.sp-n').textContent.trim(),
        on: [...e.querySelectorAll('.sp-rail i')].filter((i) => i.classList.contains('on')).length,
        pressDisabled: e.disabled,
        undoDisabled: u.disabled,
        undoOpacity: getComputedStyle(u).opacity,
        sr: document.querySelector('.timer-slot .sr')?.textContent.trim() ?? null,
        dockW: Math.round(document.querySelector('.split-dock').getBoundingClientRect().width),
      };
    });
    xs.push(state.x);
    log.states[`pill-${n}-marks`] = state;
    if (n === 0 || n === 1 || n === 3) await shot(page, `c12-pill-${n}-marks-390`);
    if (n === 3) await shot(page, `c14-all-marked-390`);
    await stop();
  }
  log.checks.pillXEqual = xs.every((x) => x === xs[0]);
  log.checks.pillXs = xs;

  // C14: Undo must re-announce the *previous* phase, not leave the last mark's sentence standing
  await hold();
  for (let k = 0; k < 2; k++) {
    const p = await boxOf(page, '.split-press');
    await page.mouse.click(p.x + p.w / 2, p.y + p.h / 2);
    await sleep(220);
  }
  const beforeUndo = await page.evaluate(() => document.querySelector('.timer-slot .sr')?.textContent.trim());
  await page.evaluate(() => document.querySelector('.split-undo').click());
  await sleep(250);
  log.checks.undoAnnounce = {
    before: beforeUndo,
    after: await page.evaluate(() => document.querySelector('.timer-slot .sr')?.textContent.trim()),
    labelAfter: await page.evaluate(() => document.querySelector('.sp-label')?.textContent.trim()),
  };
  await stop();
  await page.close();
}

// ---------------------------------------------------------------- C21: a refusal, and the nav dim
{
  const page = await open({ width: 390, height: 844 }, seedData_());
  const big = await boxOf(page, '.big');
  await page.mouse.move(big.x + big.w / 2, big.y + big.h / 2);
  await page.mouse.down();
  await sleep(450);
  await page.mouse.up();
  await sleep(300);
  log.checks.navOpacityMidSolve = await page.evaluate(() =>
    [...document.querySelectorAll('nav[aria-label="Main"] button')].map((b) => ({
      label: b.textContent.trim().slice(0, 8),
      current: b.getAttribute('aria-current'),
      opacity: getComputedStyle(b).opacity,
    })),
  );
  await page.evaluate(() => [...document.querySelectorAll('nav[aria-label="Main"] button')].find((b) => b.textContent.includes('Train')).click());
  await sleep(150);
  log.checks.toast = await page.evaluate(() => ({
    text: document.querySelector('.toast')?.textContent ?? null,
    view: document.querySelector('h1')?.textContent?.trim(),
  }));
  await shot(page, 'c20-c21-toast-mid-solve-390');
  await sleep(1700);
  log.checks.toastGone = await page.evaluate(() => !document.querySelector('.toast'));
  await page.close();
}

// ---------------------------------------------------------------- C10: Train's answer card
for (const size of SIZES) {
  const page = await open({ width: size.w, height: size.h }, seedData_({ settings: { splits: false } }));
  await clickText(page, 'Train', 'nav button');
  await sleep(700);
  await clickText(page, 'Start session');
  await sleep(900);
  const big = await boxOf(page, '.big');
  const holdAndTap = async () => {
    await page.mouse.move(big.x + big.w / 2, big.y + big.h / 2);
    await page.mouse.down();
    await sleep(450);
    await page.mouse.up();
    await sleep(700);
    await page.mouse.move(big.x + 10, big.y + 10);
    await page.mouse.down();
    await page.mouse.up();
    await sleep(900);
  };
  await holdAndTap();                      // recognition mark
  await holdAndTap();                      // execution, stops the clock
  await sleep(600);
  log.states[`train-${size.tag}`] = await page.evaluate(() => {
    const c = document.querySelector('.answer-card');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return {
      name: c.querySelector('.ac-name')?.textContent?.trim(),
      times: c.querySelector('.ac-times')?.textContent?.trim().replace(/\s+/g, ' '),
      alg: c.querySelector('.ac-alg')?.textContent?.trim().slice(0, 30),
      diagram: !!c.querySelector('.ac-diagram svg'),
      bottom: Math.round(r.bottom),
      navTop: Math.round(document.querySelector('nav[aria-label="Main"]').getBoundingClientRect().top),
      aboveFold: r.bottom <= innerHeight,
    };
  });
  await shot(page, `c10-train-answer-${size.tag}`);
  await page.close();
}

// ---------------------------------------------------------------- C11: Drills gets its penalties back
for (const size of SIZES) {
  const page = await open({ width: size.w, height: size.h }, seedData_({ settings: { splits: false } }));
  await clickText(page, 'Drills', 'nav button');
  await sleep(900);
  const big = await boxOf(page, '.big');
  await page.mouse.move(big.x + big.w / 2, big.y + big.h / 2);
  await page.mouse.down();
  await sleep(450);
  await page.mouse.up();
  await sleep(800);
  await page.mouse.move(big.x + 10, big.y + 10);
  await page.mouse.down();
  await page.mouse.up();
  await sleep(1000);
  log.states[`drills-${size.tag}`] = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[role="group"][aria-label="Penalty and delete"]')];
    const inSide = rows.filter((r) => r.closest('.side'));
    const r = rows[0]?.getBoundingClientRect();
    return {
      count: rows.length,
      inAside: inSide.length,
      bottom: r ? Math.round(r.bottom) : null,
      navTop: Math.round(document.querySelector('nav[aria-label="Main"]').getBoundingClientRect().top),
      visible: r ? r.width > 0 && r.height > 0 : false,
    };
  });
  await shot(page, `c11-drills-penalty-${size.tag}`);
  await page.close();
}

// ---------------------------------------------------------------- C19: the intro's fixed footer
{
  const page = await open({ width: 390, height: 844 }, seedData_({ solves: [], settings: { introSeen: false, splits: false } }));
  const boxes = [];
  for (let i = 0; i < 4; i++) {
    const b = await page.evaluate(() => {
      const btn = document.querySelector('[data-first]');
      const r = btn.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), label: btn.textContent.trim(), step: document.querySelector('[role=dialog]').textContent.match(/Step \d of \d/)?.[0] };
    });
    boxes.push(b);
    await shot(page, `c19-intro-slide-${i + 1}-390`);
    if (i < 3) {
      await page.keyboard.press('Enter');   // the focused primary: keyboard path, focus stays put
      await sleep(300);
    }
  }
  log.states.introPrimary = boxes;
  log.checks.introPrimaryFixed = boxes.every((b) => b.x === boxes[0].x && b.y === boxes[0].y);
  // Back and ArrowLeft work, and the trap skips the disabled Back on slide 1. The recorder is there so a
  // run that reports "no change" also says whether the key ever reached the page.
  await page.bringToFront();
  await page.evaluate(() => {
    window.__keys = [];
    window.addEventListener('keydown', (e) => window.__keys.push(e.key), true);
    document.querySelector('[data-first]').focus();
  });
  await page.keyboard.press('ArrowLeft');
  await sleep(350);
  log.checks.introKeys = await page.evaluate(() => window.__keys);
  log.checks.introArrowLeft = await page.evaluate(() => document.querySelector('[role=dialog]').textContent.match(/Step \d of \d/)?.[0]);
  // Back to slide 1, then Tab from the last stop must wrap to the first *enabled* one (Skip, not Back)
  for (let k = 0; k < 4; k++) {
    const step = await page.evaluate(() => document.querySelector('[role=dialog]').textContent.match(/Step \d/)?.[0]);
    if (step === 'Step 1') break;
    await page.evaluate(() => document.querySelector('.intro-foot .btn').click());
    await sleep(200);
  }
  await page.evaluate(() => document.querySelector('[data-first]').focus());
  await page.keyboard.press('Tab');
  log.checks.introTabFromPrimaryOnSlide1 = await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 12));
  await page.close();
}

// the same invariance at 360 @130 %, where the copy wraps to more lines
{
  const page = await open({ width: 360, height: 640 }, seedData_({ solves: [], settings: { introSeen: false, splits: false, textSize: 130 } }));
  const boxes = [];
  for (let i = 0; i < 4; i++) {
    boxes.push(await page.evaluate(() => {
      const r = document.querySelector('[data-first]').getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), label: document.querySelector('[data-first]').textContent.trim() };
    }));
    if (i < 3) { await page.keyboard.press('Enter'); await sleep(300); }
  }
  log.states.introPrimary130 = boxes;
  log.checks.introPrimaryFixed130 = boxes.every((b) => b.x === boxes[0].x && b.y === boxes[0].y);
  await shot(page, 'c19-intro-slide-4-360-130');
  await page.close();
}

const report = { base: BASE, shots, log };
writeFileSync(`${OUT}/measurements.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
