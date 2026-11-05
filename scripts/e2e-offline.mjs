// Builds the web target with VITE_SW=1 into dist-sw/ (dist-web/ is left alone), serves it on :4174 and runs scripts/e2e.mjs
// with EXPECT_SW=1, because the offline checks need a build that registers the worker.
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const PORT = process.env.SW_PORT || '4174';
const out = 'dist-sw';

// the installed entry point directly: an `npx` layer can resolve slowly enough to race the readiness loop,
// and the .bin shim is a shell script on Windows, which spawn cannot run
const VITE = ['node_modules/vite/bin/vite.js'];
const build = spawnSync(process.execPath, [...VITE, 'build', '--mode', 'web', '--outDir', out], { stdio: 'inherit', env: { ...process.env, VITE_SW: '1' } });
if (build.status !== 0) { console.error('offline build failed'); process.exit(1); }

// keep the server's output: if it refuses to start, that log is the only clue
const fs = await import('node:fs');
const logPath = join(tmpdir(), 'split-preview-sw.log');
let server = null;
const stop = () => { try { server?.kill('SIGTERM'); } catch { /* already gone */ } };
process.on('exit', stop);
process.on('SIGINT', () => { stop(); process.exit(130); });

const answered = () => spawnSync('node', ['-e', `fetch('http://127.0.0.1:${PORT}/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))`]).status === 0;

// A preview left behind by an earlier run holds the port, and --strictPort then makes the next one exit at
// once. Clear only this run's own preview, by port.
const holderPid = () => {
  const r = spawnSync('ss', ['-ltnp'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;   // no `ss` (Windows): the retry below still copes with a busy port
  const line = (r.stdout || '').split('\n').find(l => l.includes(`:${PORT} `));
  const m = line && /pid=(\d+)/.exec(line);
  return m ? Number(m[1]) : null;
};
if (answered()) {
  const pid = holderPid();
  console.log(`port ${PORT} was held by a leftover preview${pid ? ` (pid ${pid})` : ''}; clearing it`);
  if (pid) { try { process.kill(pid, 'SIGTERM'); } catch { /* already gone */ } }
  for (let i = 0; i < 20 && answered(); i++) await wait(250);
  if (answered() && pid) { try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ } }
}

// one attempt, then one retry: a preview that silently fails to bind must not fail the gate
let up = false;
for (let attempt = 0; attempt < 2 && !up; attempt++) {
  const logFile = fs.openSync(logPath, 'w');
  // --host 127.0.0.1: the default binds "localhost", which is ::1 on Windows and never answers on 127.0.0.1
  server = spawn(process.execPath, [...VITE, 'preview', '--outDir', out, '--host', '127.0.0.1', '--port', PORT, '--strictPort'], { stdio: ['ignore', logFile, logFile] });
  for (let i = 0; i < 80 && !up; i++) {   // 20 s per attempt
    await wait(250);
    up = answered();
  }
  if (!up) { stop(); await wait(500); }
}
if (!up) {
  console.error(`preview on ${PORT} never answered; its log:`);
  try { console.error(fs.readFileSync(logPath, 'utf8').trim() || '(empty)'); } catch { console.error('(no log)'); }
  stop();
  process.exit(1);
}

const run = spawnSync(process.execPath, ['scripts/e2e.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, BASE_URL: `http://127.0.0.1:${PORT}/`, EXPECT_SW: '1' },
});
// SIGTERM, then confirm the port is free: an orphaned preview breaks the next run
stop();
for (let i = 0; i < 20 && answered(); i++) await wait(250);
if (answered()) { try { server?.kill('SIGKILL'); } catch { /* already gone */ } await wait(500); }
process.exit(run.status ?? 1);
