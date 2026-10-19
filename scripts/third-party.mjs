// Lists every package that ends up in the shipped app (production dependencies, transitive) with its licence.
// Run: node scripts/third-party.mjs > THIRD_PARTY_LICENSES.md
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const tree = JSON.parse(execSync('npm ls --omit=dev --all --json', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
const seen = new Map();
(function walk(deps) {
  for (const [name, info] of Object.entries(deps ?? {})) {
    if (!seen.has(name)) {
      const f = `node_modules/${name}/package.json`;
      const pj = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
      const lic = typeof pj.license === 'string' ? pj.license : pj.license?.type ?? (pj.licenses ?? []).map(l => l.type).join(' OR ') ?? 'UNKNOWN';
      seen.set(name, { version: info.version ?? pj.version, license: lic || 'UNKNOWN', homepage: pj.homepage ?? pj.repository?.url ?? '' });
    }
    walk(info.dependencies);
  }
})(tree.dependencies);

const rows = [...seen].sort((a, b) => a[0].localeCompare(b[0]));
const compatible = /^(MIT|ISC|BSD-[23]-Clause|Apache-2\.0|MPL-2\.0|0BSD|OFL-1\.1|CC0-1\.0|Unlicense|BlueOak-1\.0\.0|Python-2\.0|GPL-3\.0.*|LGPL.*|\(.*\))$/;
console.log('# Third-party software\n');
console.log('Split is licensed under the GNU GPL v3 or later (see LICENSE). It includes the following open-source packages, each under its own licence (the full text is in each package):\n');
console.log('| Package | Version | Licence |\n|---|---|---|');
for (const [n, i] of rows) console.log(`| ${n} | ${i.version} | ${i.license} |`);
console.log('\nBundled fonts: Manrope and JetBrains Mono, SIL Open Font License 1.1.');
const ok = lic => lic.replace(/[()]/g, '').split(/ OR | AND /).some(x => compatible.test(x.trim()));
const odd = rows.filter(([, i]) => !ok(i.license));
if (odd.length) console.error('CHECK THESE LICENCES:', odd.map(([n, i]) => `${n}: ${i.license}`).join('; '));
else console.error(`${rows.length} packages, all licences are GPL-3.0-compatible`);
