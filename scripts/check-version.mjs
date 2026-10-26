// One version, four files. Run by CI (and by hand before a release) so the app, the desktop
// shell and the APK can never disagree about what they are.
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const version = JSON.parse(read('package.json')).version;

const fromCargo = /^version\s*=\s*"([^"]+)"/m.exec(read('src-tauri/Cargo.toml'))?.[1];
const fromTauri = JSON.parse(read('src-tauri/tauri.conf.json')).version;
const fromAndroid = /versionName\s+"([^"]+)"/.exec(read('android/app/build.gradle'))?.[1];
const changelog = read('CHANGELOG.md');
const fromChangelog = /^## \[([^\]]+)\]/m.exec(changelog)?.[1];

const found = [
  ['package.json', version],
  ['src-tauri/Cargo.toml', fromCargo],
  ['src-tauri/tauri.conf.json', fromTauri],
  ['android/app/build.gradle', fromAndroid],
  ['CHANGELOG.md (newest entry)', fromChangelog],
];

let bad = 0;
for (const [file, v] of found) {
  const ok = !!v && v === version;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${file}: ${v ?? 'not found'}${ok ? '' : ` (package.json says ${version})`}`);
}
if (bad) {
  console.log(`\n${bad} file(s) out of step: bump them all to the same version.`);
  process.exit(1);
}
console.log(`\nAll five agree on ${version}.`);
