// Proves the weekly safety copy fires when the shell refuses to persist the origin. The app is loaded
// with its entry script blocked, so a solve can be seeded before the store reads the database (a store
// that loaded first would correctly treat the seeded row as a deletion and drop it).
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const URL = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
const DL = '/home/noah/.hermes/cache/scratch/dl';
fs.rmSync(DL, { recursive: true, force: true });
fs.mkdirSync(DL, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 800 },
});
const page = await browser.newPage();
const cdp = await page.createCDPSession();
await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL });

// the only thing faked is the device's answer
await page.evaluateOnNewDocument(() => {
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: {
      persisted: async () => false,
      persist: async () => false,
      estimate: async () => ({ usage: 4096, quota: 120 * 1024 * 1024 }),
    },
  });
});

// boot the origin without the app: the database is reachable, the store is not running
await page.setRequestInterception(true);
page.on('request', (r) => {
  if (!r.isInterceptResolutionHandled?.()) void (/\/assets\/index-.*\.js$/.test(r.url()) ? r.abort().catch(() => {}) : r.continue().catch(() => {}));
});
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

const seeded = await page.evaluate(async () => {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('cube-trainer', 2);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
      if (!d.objectStoreNames.contains('solves')) d.createObjectStore('solves', { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  await new Promise((res, rej) => {
    const t = db.transaction('solves', 'readwrite');
    t.objectStore('solves').put({
      id: 'seed1',
      ms: 12340,
      pen: '',
      ts: Date.now() - 864e5,
      event: '333',
      session: 'default',
      scramble: 'R U R2 F',
    });
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
  return 'ok';
});

await page.setRequestInterception(false);
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('.page', { timeout: 30000 });

const deadline = Date.now() + 25000;
let files = [];
while (Date.now() < deadline) {
  files = fs.readdirSync(DL).filter((f) => f.endsWith('.json'));
  if (files.length) break;
  await new Promise((r) => setTimeout(r, 400));
}

if (!files.length) {
  console.log(`seeded=${seeded} NO BACKUP WRITTEN`);
  await browser.close();
  process.exit(1);
}

const body = JSON.parse(fs.readFileSync(path.join(DL, files[0]), 'utf8'));
console.log(`seeded=${seeded}`);
console.log(`file: ${files[0]}`);
console.log(`name matches the date pattern: ${/^split-backup-\d{4}-\d{2}-\d{2}\.json$/.test(files[0])}`);
console.log(`solves in the backup: ${Array.isArray(body.solves) ? body.solves.length : 'missing'}`);
console.log(`settings carried over: ${typeof body.settings === 'object'}`);
await browser.close();
