// The offline checks need a build that registers the service worker, served on its own port so the normal
// build in dist/ is left alone. Builds, serves, runs scripts/e2e.mjs with EXPECT_SW=1, then cleans up.
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

const PORT = process.env.SW_PORT || '4174';
const out = 'dist-sw';

const build = spawnSync('npx', ['vite', 'build', '--outDir', out], { stdio: 'inherit', env: { ...process.env, VITE_SW: '1' } });
if (build.status !== 0) { console.error('offline build failed'); process.exit(1); }

// keep the server's own output: when it refuses to start, that log is the only useful clue
const logFile = (await import('node:fs')).openSync('/tmp/split-preview-sw.log', 'w');
const server = spawn('npx', ['vite', 'preview', '--outDir', out, '--port', PORT, '--strictPort'], { stdio: ['ignore', logFile, logFile] });
const stop = () => { try { server.kill('SIGTERM'); } catch {} };
process.on('exit', stop);
process.on('SIGINT', () => { stop(); process.exit(130); });

// wait for the port to answer rather than guessing a sleep
let up = false;
for (let i = 0; i < 120; i++) {   // 30 s: a cold vite start on the Windows drive is slow
  await wait(250);
  const r = spawnSync('node', ['-e', `fetch('http://127.0.0.1:${PORT}/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))`]);
  if (r.status === 0) { up = true; break; }
}
if (!up) {
  console.error(`preview on ${PORT} never answered; its log:`);
  try { console.error((await import('node:fs')).readFileSync('/tmp/split-preview-sw.log', 'utf8').trim() || '(empty)'); } catch {}
  stop();
  process.exit(1);
}

const run = spawnSync('node', ['scripts/e2e.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, BASE_URL: `http://127.0.0.1:${PORT}/`, EXPECT_SW: '1' },
});
stop();
process.exit(run.status ?? 1);
