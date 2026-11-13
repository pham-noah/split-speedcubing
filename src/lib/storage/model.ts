import type { Penalty, Solve } from '../core/stats';
import type { Card } from '../core/srs';

export interface Attempt { ts: number; total: number; recog: number | null; grade: number; alg?: string; pen?: '+2' | 'DNF' }
// algs = extra algorithms the user added (the built-in one is always available); defaultAlg = the one used for training.
// `alg` is the legacy single-alg field from v0.1, migrated in normalize().
export interface CardRecord extends Card { algs?: string[]; defaultAlg?: string; alg?: string; attempts: Attempt[] }
export interface Settings { theme: 'midnight' | 'amoled' | 'contrast'; textSize: number; holdMs: number; inspection: boolean; beeps: boolean; hideTime: boolean; tapStart: boolean; retention: number; keys: Record<string, string>; hidden: Record<string, boolean>; introSeen: boolean; coverOn: boolean; coverColor: string; accent: string; walkAutoplay: boolean; walkSpeed: number; cubeColors: string[]; swapRO: boolean; checkUpdates?: boolean; drillTwoLook?: boolean; lastBackupAt?: number; autoBackup?: boolean; fsrsW?: number[]; splits?: boolean }
export interface DrillResult { type: 'cross' | 'bld' | 'oll2' | 'pll2'; ms: number; memo: number | null; ok: boolean; ts: number; info?: string; pen?: '+2' | 'DNF' }
/** A session times one puzzle. Older backups have no event: they are 3x3, which is all there was. */
export interface Session { id: string; name: string; event?: '333' | '222' }
export interface CustomCase { id: string; name: string; alg: string }
export interface AppData { v: 1; solves: Solve[]; cards: Record<string, CardRecord>; settings: Settings; drills: DrillResult[]; sessions: Session[]; session: string; zbll: CustomCase[]; f2lRev?: number }

export const defaultSettings = (): Settings => ({ theme: 'midnight', textSize: 100, holdMs: 300, tapStart: false, inspection: false, beeps: true, hideTime: false, retention: 0.9, keys: {}, hidden: {}, introSeen: false, coverOn: true, coverColor: '', accent: '', walkAutoplay: false, walkSpeed: 900, cubeColors: [], swapRO: false, autoBackup: true, splits: false });
export const defaultData = (): AppData => ({ v: 1, solves: [], cards: {}, settings: defaultSettings(), drills: [], sessions: [{ id: 'default', name: 'Session 1' }], session: 'default', zbll: [] });

const PENALTIES = new Set(['', '+2', 'DNF']);
const THEMES = ['midnight', 'amoled', 'contrast'];
const TEXT_SIZES = [100, 115, 130];
const HOLD_TIMES = [150, 300, 500];

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const positive = (n: unknown): n is number => finite(n) && n > 0;

/** Phase splits from a backup: positive lengths only, at most one per phase plus a tail. Anything else
 *  (strings, zeroes, a hand-edited mess) drops the split rather than drawing a broken bar. */
function splitTimes(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(positive).slice(0, 8);
}

// A backup file is user-supplied JSON: every field that reaches the screens is checked here, so a
// corrupt or hand-edited file cannot produce NaN averages, a "bogus" penalty or duplicate keys.
function cleanSolves(raw: unknown[]): Solve[] {
  const ids = new Set<string>();
  const out: Solve[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const s = item as Partial<Solve>;
    const pen = (typeof s.pen === 'string' && PENALTIES.has(s.pen) ? s.pen : '') as Penalty;
    // a DNF can legitimately have no time at all: importers store it as 0
    if (!positive(s.ms) && !(s.ms === 0 && pen === 'DNF')) continue;
    let id = typeof s.id === 'string' && s.id ? s.id : `solve-${out.length + 1}`;
    while (ids.has(id)) id = `${id}-copy`;
    ids.add(id);
    out.push({
      id,
      ms: s.ms as number,
      pen,
      scramble: typeof s.scramble === 'string' ? s.scramble.trim() : '',
      event: typeof s.event === 'string' && s.event ? s.event : '333',
      ts: finite(s.ts) ? s.ts : 0,
      ...(typeof s.session === 'string' ? { session: s.session } : {}),
      ...(splitTimes(s.splits).length ? { splits: splitTimes(s.splits) } : {}),
    });
  }
  return out;
}

function cleanSessions(raw: unknown): Session[] {
  if (!Array.isArray(raw) || !raw.length) return [{ id: 'default', name: 'Session 1' }];
  const ids = new Set<string>();
  const out: Session[] = [];
  for (const item of raw) {
    const s = item as Partial<Session> | null;
    if (!s || typeof s.id !== 'string' || !s.id || ids.has(s.id)) continue;
    ids.add(s.id);
    out.push({
      id: s.id,
      name: typeof s.name === 'string' && s.name.trim() ? s.name.trim() : `Session ${out.length + 1}`,
      event: s.event === '222' ? '222' : '333',
    });
  }
  return out.length ? out : [{ id: 'default', name: 'Session 1' }];
}

const DRILL_TYPES = new Set(['cross', 'bld', 'oll2', 'pll2']);
const HEX = /^#[0-9a-f]{6}$/i;

/** The user's own ZBLL cases: `name` is what the Library and the importer match on, so a number here
 *  used to throw inside `zbllNamed` and leave a broken cell in the grid. */
function cleanZbll(raw: unknown): CustomCase[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set<string>();
  const out: CustomCase[] = [];
  for (const item of raw) {
    const c = item as Partial<CustomCase> | null;
    if (!c || typeof c.id !== 'string' || !c.id) continue;
    if (typeof c.alg !== 'string' || !c.alg.trim()) continue;
    if (ids.has(c.id)) continue;
    ids.add(c.id);
    const name = typeof c.name === 'string' && c.name.trim() ? c.name.trim() : c.id;
    out.push({ id: c.id, name, alg: c.alg.trim() });
  }
  return out;
}

/** Drill results: the type is one of four, and a row from an unknown mode has no screen to land on. */
function cleanDrills(raw: unknown): DrillResult[] {
  if (!Array.isArray(raw)) return [];
  const out: DrillResult[] = [];
  for (const item of raw) {
    const d = item as Partial<DrillResult> | null;
    if (!d || typeof d.type !== 'string' || !DRILL_TYPES.has(d.type)) continue;
    if (!finite(d.ms) || d.ms < 0) continue;
    out.push({
      type: d.type as DrillResult['type'],
      ms: d.ms,
      memo: finite(d.memo) ? d.memo : null,
      ok: d.ok === true,
      ts: finite(d.ts) ? d.ts : 0,
      ...(typeof d.info === 'string' ? { info: d.info } : {}),
      ...(d.pen === '+2' || d.pen === 'DNF' ? { pen: d.pen } : {}),
    });
  }
  return out;
}

function cleanSettings(raw: Partial<Settings> | undefined): Settings {
  const d: Settings = { ...defaultSettings(), ...(raw && typeof raw === 'object' ? raw : {}) };
  if (!THEMES.includes(d.theme)) d.theme = 'midnight';
  if (!TEXT_SIZES.includes(d.textSize)) d.textSize = 100;
  if (!HOLD_TIMES.includes(d.holdMs)) d.holdMs = 300;
  if (!finite(d.retention)) d.retention = 0.9;
  d.retention = Math.min(0.99, Math.max(0.7, d.retention));
  if (!Number.isFinite(d.walkSpeed) || d.walkSpeed < 150) d.walkSpeed = 900;
  if (typeof d.coverColor !== 'string' || !HEX.test(d.coverColor)) d.coverColor = '';
  if (typeof d.accent !== 'string' || !HEX.test(d.accent)) d.accent = '';
  d.cubeColors = Array.isArray(d.cubeColors) ? d.cubeColors.filter(c => typeof c === 'string' && HEX.test(c)).slice(0, 6) : [];
  d.keys = d.keys && typeof d.keys === 'object' ? Object.fromEntries(Object.entries(d.keys).filter(([, v]) => typeof v === 'string')) : {};
  d.hidden = d.hidden && typeof d.hidden === 'object' ? { ...d.hidden } : {};
  d.checkUpdates = d.checkUpdates === true;
  d.autoBackup = d.autoBackup !== false;
  d.splits = d.splits === true;
  return d;
}

// Accepts anything parsed from a backup file and returns safe, complete data (throws if it is not a backup).
export function normalize(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object') throw new Error('Not a Split backup');
  const r = raw as Partial<AppData>;
  // typeof null is 'object': a null cards field must not count as a usable backup
  const hasSolves = Array.isArray(r.solves);
  const hasCards = !!r.cards && typeof r.cards === 'object' && !Array.isArray(r.cards);
  if (!hasSolves && !hasCards) throw new Error('Not a Split backup');
  // a backup from a newer version may hold fields this one would silently drop: refuse it instead
  if (r.v != null && (typeof r.v !== 'number' || r.v > 1)) throw new Error('That backup was made by a newer version of Split');
  const out: AppData = {
    v: 1,
    solves: cleanSolves(Array.isArray(r.solves) ? r.solves : []),
    cards: migrateCards(r.cards && typeof r.cards === 'object' ? (r.cards as Record<string, CardRecord>) : {}),
    settings: cleanSettings(r.settings),
    sessions: cleanSessions(r.sessions),
    session: typeof r.session === 'string' ? r.session : 'default',
    zbll: cleanZbll(r.zbll),
    drills: cleanDrills(r.drills),
  };
  if (typeof r.f2lRev === 'number' && Number.isFinite(r.f2lRev)) out.f2lRev = r.f2lRev;
  if (out.settings.fsrsW && !(out.settings.fsrsW.length === 21 && out.settings.fsrsW.every(Number.isFinite))) delete out.settings.fsrsW;
  // solves from before sessions existed belong to the first session
  const first = out.sessions[0].id;
  const known = new Set(out.sessions.map(s => s.id));
  for (const s of out.solves) if (!s.session || !known.has(s.session)) s.session = first;
  if (!known.has(out.session)) out.session = first;
  return out;
}

function migrateCards(cards: Record<string, CardRecord>): Record<string, CardRecord> {
  for (const [id, c] of Object.entries(cards)) {
    if (!c || typeof c !== 'object') { delete cards[id]; continue; }
    if (c.alg) {
      c.algs = [...new Set([...(c.algs ?? []), c.alg])];
      c.defaultAlg ??= c.alg;
      delete c.alg;
    }
    c.attempts = Array.isArray(c.attempts) ? c.attempts.filter(a => a && finite(a.total)) : [];
    if (!finite(c.due)) c.due = 0;
    c.seen = !!c.seen;
  }
  return cards;
}
