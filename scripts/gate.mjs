// The pre-push gate, run the way CI runs it: in parallel.
//
// Each stage is independent — nothing here reads what another stage writes — so running them one after the
// other is a wait on the slowest machine core rather than on the work. On eight cores this takes about as
// long as the single slowest stage instead of the sum, and the output of every stage is kept so a failure
// still reads normally.
//
//   node scripts/gate.mjs
//
// The browser checks are not here: they need a production build and a preview server, which is what
// `npm run build:web && npm run e2e:offline` does.
import { spawn } from 'node:child_process';

const STAGES = [
  { name: 'version', cmd: 'node scripts/check-version.mjs' },
  { name: 'lint', cmd: 'npx eslint .' },
  { name: 'types', cmd: 'npx svelte-check --tsconfig ./tsconfig.json' },
  { name: 'unit', cmd: 'npx vitest run' },
];

const run = (stage) =>
  new Promise((resolve) => {
    const started = Date.now();
    const chunks = [];
    const child = spawn(stage.cmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (d) => chunks.push(d));
    child.stderr.on('data', (d) => chunks.push(d));
    child.on('close', (code) => {
      resolve({ ...stage, code, seconds: (Date.now() - started) / 1000, output: Buffer.concat(chunks).toString() });
    });
  });

const results = await Promise.all(STAGES.map(run));

for (const r of results) {
  const label = `${r.name} ${r.code === 0 ? 'ok' : 'FAILED'}`;
  console.log(`${label.padEnd(16)} ${r.seconds.toFixed(1)}s`);
  if (r.code !== 0) console.log(r.output.split('\n').slice(-40).join('\n'));
}

const failed = results.filter((r) => r.code !== 0);
const wall = results.reduce((m, r) => Math.max(m, r.seconds), 0);
console.log(`\n${failed.length ? `${failed.length} stage(s) failed` : 'all stages passed'} — slowest ${wall.toFixed(1)}s`);

if (failed.length) process.exit(1);
