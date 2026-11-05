// Builds one Android flavour. npm scripts run through cmd.exe on Windows and bash in CI, and neither
// spelling of the gradle wrapper works in both (`./gradlew` fails in cmd, `gradlew` fails in bash), so
// the call is made here once and the scripts stay portable.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const flavour = process.argv[2];
const TASKS = { store: 'assembleStoreRelease', github: 'assembleGithubRelease' };
if (!TASKS[flavour]) {
  console.error(`usage: node scripts/android-build.mjs <${Object.keys(TASKS).join('|')}>`);
  process.exit(2);
}

const android = fileURLToPath(new URL('../android/', import.meta.url));
const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const r = spawnSync(gradlew, [TASKS[flavour]], {
  cwd: android,
  stdio: 'inherit',
  // cmd needs the shell to resolve the .bat; a POSIX shell would re-parse the path with spaces
  shell: process.platform === 'win32',
});
process.exit(r.status ?? 1);
