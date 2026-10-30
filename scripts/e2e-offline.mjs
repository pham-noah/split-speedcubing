// The offline checks need a build that registers the service worker, served on its own port so the normal
// build in dist/ is left alone. Builds, serves, runs scripts/e2e.mjs with EXPECT_SW=1, then cleans up.
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

const PORT = process.env.SW_PORT || '4174';
const out = 'dist-sw';

// call the installed binaries directly: an `npx` layer sometimes resolves slowly enough that the
// port is still closed when the readiness loop gives up
const VITE = 'node_modules/.bin/vite';
const build = spawnSync(VITE, ['build', '--outDir', out], { stdio: 'inherit', env: { ...process.env, VITE_SW: '1' } });
if (build.status !== 0) { console.error('offline build failed'); process.exit(1); }

// keep the server's own output: when it refuses to start, that log is the only useful clue
const fs = await import('node:fs');
const logPath = '/tmp/split-preview-sw.log';
let server = null;
const stop = () => { try { server?.kill('SIGTERM'); } catch {} };
process.on('exit', stop);
process.on('SIGINT', () => { stop(); process.exit(130); });

const answered = () => spawnSync('node', ['-e', `fetch('http://127.0.0.1:${PORT}/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))`]).status === 0;

// A preview left behind by an earlier run holds the port, and --strictPort then makes the next one exit
// instantly - which reads as "never answered". Clear only our own preview, never anything else.
const holderPid = () => {
  const r = spawnSync('ss', ['-ltnp'], { encoding: 'utf8' });
  const line = (r.stdout || '').split('\n').find(l => l.includes(`:${PORT} `));
  const m = line && /pid=(\d+)/.exec(line);
  return m ? Number(m[1]) : null;
};
if (answered()) {
  const pid = holderPid();
  console.log(`port ${PORT} was held by a leftover preview${pid ? ` (pid ${pid})` : ''}; clearing it`);
  if (pid) { try { process.kill(pid, 'SIGTERM'); } catch {} }
  for (let i = 0; i < 20 && answered(); i++) await wait(250);
  if (answered() && pid) { try { process.kill(pid, 'SIGKILL'); } catch {} }
}

// one attempt, then one retry: a preview that silently fails to bind must not fail the gate
let up = false;
for (let attempt = 0; attempt < 2 && !up; attempt++) {
  const logFile = fs.openSync(logPath, 'w');
  server = spawn(VITE, ['preview', '--outDir', out, '--port', PORT, '--strictPort'], { stdio: ['ignore', logFile, logFile] });
  for (let i = 0; i < 80 && !up; i++) {   // 20 s per attempt
    await wait(250);
    up = answered();
  }
  if (!up) { stop(); await wait(500); }
}
if (!up) {
  console.error(`preview on ${PORT} never answered; its log:`);
  try { console.error(fs.readFileSync(logPath, 'utf8').trim() || '(empty)'); } catch {}
  stop();
  process.exit(1);
}

const run = spawnSync('node', ['scripts/e2e.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, BASE_URL: `http://127.0.0.1:${PORT}/`, EXPECT_SW: '1' },
});
// SIGTERM, then make sure the port really went away: an orphaned preview breaks the next run
stop();
for (let i = 0; i < 20 && answered(); i++) await wait(250);
if (answered()) { try { server?.kill('SIGKILL'); } catch {} await wait(500); }
process.exit(run.status ?? 1);
