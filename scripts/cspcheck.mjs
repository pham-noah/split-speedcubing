import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CSP = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8')).app.security.csp;

const root = path.resolve('dist-desktop');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const srv = http.createServer((req, res) => {
  let f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'content-security-policy': CSP });
  fs.createReadStream(f).pipe(res);
}).listen(4199);

const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] });
const p = await b.newPage();
const violations = [];
p.on('console', (m) => { if (/Content Security Policy|Refused to connect/i.test(m.text())) violations.push(m.text().slice(0, 120)); });
await p.goto('http://127.0.0.1:4199/', { waitUntil: 'networkidle0' });
const r = await p.evaluate(async () => {
  try {
    const res = await fetch('https://api.github.com/repos/pham-noah/split-speedcubing/releases/latest');
    return { ok: true, status: res.status };
  } catch (e) { return { ok: false, error: String(e).slice(0, 120) }; }
});
console.log('fetch from the desktop CSP:', JSON.stringify(r));
console.log('console violations:', violations.length ? violations : 'none');
await b.close();
srv.close();
