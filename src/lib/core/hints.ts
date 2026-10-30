// Vimium-style hint codes for the Library: every case gets a short code you can type to open it.
// The code is the case's own name where possible (Jb-perm -> "jb", OLL 27 -> "27"), so you can
// guess it before you look. Collisions get one extra character rather than a random code.
const POOL = 'asdfghjkl';

/** Lowercase, drop "-perm" and the set word, keep letters and digits. */
export function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/-perm\b/g, '')
    .replace(/^(oll|f2l|zbll)\s+/i, '')
    .replace(/[^a-z0-9]/g, '');
}

/** One code per target, in list order: a taken code grows by a character from the home row, and a name
 *  with nothing typeable in it falls back to its position. */
export function makeHints(targets: { id: string; name: string }[]): Map<string, string> {
  const out = new Map<string, string>();
  const taken = new Set<string>();
  const slugs = targets.map((t, i) => slug(t.name) || String(i + 1));
  // a list that is all numbers (OLL 1..57, F2L 1..41) is padded to one width, otherwise "2"
  // would be an exact match for case 2 and cases 20-29 could never be typed
  const numeric = slugs.every(s => /^\d+$/.test(s));
  const width = numeric ? Math.max(...slugs.map(s => s.length)) : 0;
  targets.forEach((t, i) => {
    let code = numeric ? slugs[i].padStart(width, '0') : slugs[i];
    for (let k = 0; taken.has(code); k++) {
      const extra = POOL[k % POOL.length] + (k >= POOL.length ? String(Math.floor(k / POOL.length) + 1) : '');
      code = slug(t.name) + extra;
    }
    taken.add(code);
    out.set(t.id, code);
  });
  return out;
}
