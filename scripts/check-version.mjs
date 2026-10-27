// One version, five files, plus the Android versionCode and the store changelog that goes with it.
// Run by CI (and by hand before a release) so the app, the desktop shell, the APK and the changelog
// can never disagree about what they are.
import { readFileSync, existsSync } from 'node:fs';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const version = JSON.parse(read('package.json')).version;

const gradle = read('android/app/build.gradle');
const fromCargo = /^version\s*=\s*"([^"]+)"/m.exec(read('src-tauri/Cargo.toml'))?.[1];
const fromTauri = JSON.parse(read('src-tauri/tauri.conf.json')).version;
const fromAndroid = /versionName\s+"([^"]+)"/.exec(gradle)?.[1];
const fromChangelog = /^## \[([^\]]+)\]/m.exec(read('CHANGELOG.md'))?.[1];
const versionCode = /versionCode\s+(\d+)/.exec(gradle)?.[1];

const found = [
  ['package.json', version],
  ['src-tauri/Cargo.toml', fromCargo],
  ['src-tauri/tauri.conf.json', fromTauri],
  ['android/app/build.gradle versionName', fromAndroid],
  ['CHANGELOG.md (newest entry)', fromChangelog],
];

let bad = 0;
for (const [file, v] of found) {
  const ok = !!v && v === version;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${file}: ${v ?? 'not found'}${ok ? '' : ` (package.json says ${version})`}`);
}

// the store changelog is named after versionCode; a bump without it ships an empty "what's new"
const storeNote = `fastlane/metadata/android/en-US/changelogs/${versionCode}.txt`;
const hasNote = !!versionCode && existsSync(new URL(`../${storeNote}`, import.meta.url));
if (!hasNote) bad++;
console.log(`${hasNote ? 'ok  ' : 'FAIL'}  ${storeNote}${hasNote ? '' : ' (missing: the store shows no changelog for this build)'}`);

if (bad) {
  console.log(`\n${bad} problem(s): bump every manifest together and add the store changelog.`);
  process.exit(1);
}
console.log(`\nAll five agree on ${version} and build ${versionCode} has its store changelog.`);
