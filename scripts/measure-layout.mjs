import puppeteer from 'puppeteer-core';

const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] });
const p = await b.newPage();

const boxSource = `(e => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width), cx: Math.round(r.x + r.width / 2), y: Math.round(r.y), h: Math.round(r.height), cy: Math.round(r.y + r.height / 2) }; })`;

for (const [w, h] of [[1100, 760], [1280, 800], [1440, 900]]) {
  await p.setViewport({ width: w, height: h });
  await p.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await p.waitForSelector('.page', { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 1200));
  const m = await p.evaluate((src) => {
    const box = eval(src);
    const q = (s) => box(document.querySelector(s));
    const page = document.querySelector('.page');
    const split = document.querySelector('.split');
    return {
      vw: innerWidth,
      vh: innerHeight,
      bodyPadLeft: getComputedStyle(document.body).paddingLeft,
      nav: q('nav'),
      page: q('.page'),
      pageMax: getComputedStyle(page).maxWidth,
      splitCols: getComputedStyle(split).gridTemplateColumns,
      col: q('.split > .col'),
      side: q('.side'),
      time: q('.time'),
      big: q('.big'),
      rail: q('.rail'),
      hasRail: document.body.classList.contains('has-rail'),
      overflow: { scroll: document.documentElement.scrollHeight, client: document.documentElement.clientHeight },
      stack: [...(document.querySelector('.split > .col')?.children ?? [])].map((e) => ({ cls: e.className || e.tagName, h: Math.round(e.getBoundingClientRect().height) })),
      cube: q('.cube-panel'),
      scr: q('.scr'),
    };
  }, boxSource);
  console.log(`\n=== ${w}x${h}  window center x=${w / 2} y=${h / 2} ===`);
  console.log(`  nav x=${m.nav?.x} w=${m.nav?.w}  body padding-left=${m.bodyPadLeft}`);
  console.log(`  page x=${m.page.x} w=${m.page.w} cx=${m.page.cx} max=${m.pageMax}`);
  console.log(`  split cols=${m.splitCols}  col cx=${m.col.cx}  side w=${m.side?.w ?? '-'}`);
  console.log(`  timer .time cx=${m.time.cx} cy=${m.time.cy} h=${m.time.h}  => dx=${m.time.cx - w / 2} dy=${m.time.cy - h / 2}`);
  console.log(`  big button cx=${m.big.cx} cy=${m.big.cy}  cube panel h=${m.cube?.h ?? '-'} y=${m.cube?.y ?? '-'}`);
  console.log(`  rail=${m.rail ? 'x' + m.rail.x + ' w' + m.rail.w : 'absent'} hasRail=${m.hasRail}  scroll=${m.overflow.scroll} client=${m.overflow.client}`);
  console.log('  stack: ' + m.stack.map((x) => `${x.cls.slice(0, 18)}=${x.h}`).join('  '));
}
await b.close();
