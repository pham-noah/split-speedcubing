// Shared helper for the browser scripts. Point CHROME_PATH at Chrome/Chromium (CHROME_ARGS adds launch flags).
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);

export async function launch() {
  const executablePath = CANDIDATES.find(p => existsSync(p));
  if (!executablePath) throw new Error('Set CHROME_PATH to a Chrome or Chromium executable.');
  const args = ['--no-sandbox', ...(process.env.CHROME_ARGS ? process.env.CHROME_ARGS.split(' ') : [])];
  return puppeteer.launch({ executablePath, args, headless: 'shell' });
}
export const BASE = process.env.BASE_URL ?? 'http://localhost:4173/';
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const clickText = (page, text, sel = 'button, label') =>
  page.evaluate((t, s) => { const el = [...document.querySelectorAll(s)].find(b => b.textContent.trim().startsWith(t)); if (!el) throw new Error('no element: ' + t); el.click(); }, text, sel);
export async function seedData(page, json) {
  await page.evaluate(async j => new Promise((res, rej) => {
    const r = indexedDB.open('cube-trainer', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put(JSON.parse(j), 'app'); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); };
    r.onerror = () => rej(r.error);
  }), json);
}
