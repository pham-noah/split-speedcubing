import type { Penalty } from './stats';

export interface ImportedSolve { ms: number; pen: Penalty; scramble: string; ts: number }
export interface ImportedSession { name: string; solves: ImportedSolve[] }
export interface ImportResult { format: string; sessions: ImportedSession[]; notes: string[] }

/** "9.84", "1:05.43", "10.5+", "DNF(12.3)", "12.34" -> {ms, pen}; null if it is not a time. */
export function parseTimeText(raw: string): { ms: number; pen: Penalty } | null {
  let t = raw.trim().replace(/^"|"$/g, '');
  if (!t) return null;
  if (/^dnf/i.test(t)) {
    const inner = /\(([^)]+)\)/.exec(t);
    const v = inner ? parseTimeText(inner[1]) : null;
    return { ms: v?.ms ?? 0, pen: 'DNF' };
  }
  let pen: Penalty = '';
  if (t.endsWith('+')) { pen = '+2'; t = t.slice(0, -1); }
  const parts = t.split(':');
  if (parts.length > 3 || parts.some(p => !/^\d+(\.\d+)?$/.test(p))) return null;
  let s = 0;
  for (const p of parts) s = s * 60 + parseFloat(p);
  if (!isFinite(s) || s <= 0) return null;
  return { ms: Math.round(s * 1000), pen };
}

const normTs = (n: number) => (n > 0 && n < 1e12 ? n * 1000 : n);
const toTs = (v: unknown): number | null => {
  if (typeof v === 'number' && isFinite(v) && v > 0) return normTs(v);
  if (typeof v === 'string' && v.trim()) {
    if (/^\d+(\.\d+)?$/.test(v.trim())) return normTs(Number(v));
    const d = Date.parse(v);
    if (!isNaN(d) && d > 86_400_000) return d; // ignore 1970-01-01 placeholders
  }
  return null;
};

// { "session1": [ [[penalty, ms], scramble, comment, timestamp], ... ], "properties": { "sessionData": "{...}" } }
function parseCsTimer(root: Record<string, unknown>): ImportResult {
  const notes: string[] = [];
  const props = (root.properties ?? {}) as Record<string, unknown>;
  let meta: Record<string, { name?: unknown; opt?: { scrType?: string } }> = {};
  try { meta = typeof props.sessionData === 'string' ? JSON.parse(props.sessionData) : (props.sessionData as typeof meta) ?? {}; } catch { notes.push('Session names could not be read.'); }
  const sessions: ImportedSession[] = [];
  let skippedSessions = 0, skippedSolves = 0;
  const keys = Object.keys(root).filter(k => /^session\d+$/.test(k)).sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)));
  for (const key of keys) {
    const n = key.slice(7);
    const m = meta[n];
    const scr = m?.opt?.scrType; // absent for the standard 3x3x3 scrambler
    const rows = root[key];
    if (!Array.isArray(rows) || !rows.length) continue;
    if (scr && !['333', '333oh'].includes(scr)) { skippedSessions++; skippedSolves += rows.length; continue; }
    const out: ImportedSolve[] = [];
    rows.forEach((r, i) => {
      if (!Array.isArray(r) || !Array.isArray(r[0])) return;
      const penalty = Number(r[0][0]), ms = Number(r[0][1]);
      if (!isFinite(ms) || ms < 0) return;
      out.push({
        ms: Math.round(ms),
        pen: penalty < 0 ? 'DNF' : penalty > 0 ? '+2' : '',
        scramble: typeof r[1] === 'string' ? r[1] : '',
        ts: toTs(r[3]) ?? i,   // the row's date, or its position, which is what keeps the order
      });
    });
    if (out.length) sessions.push({ name: m?.name != null && String(m.name).trim() ? String(m.name) : `Session ${n}`, solves: out });
  }
  if (skippedSessions) notes.push(`Skipped ${skippedSessions} session${skippedSessions > 1 ? 's' : ''} (${skippedSolves} solves) for other puzzles. This app times 3x3 only.`);
  return { format: 'csTimer', sessions, notes };
}

// ---- CubeDesk and other JSON backups: best effort ----
// CubeDesk's own format is not publicly documented; this looks for lists of objects that have a numeric `time`
// (seconds) and a scramble, either nested in sessions or at the top level.
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
function solveFromObj(o: Obj): ImportedSolve | null {
  const time = typeof o.time === 'number' ? o.time : typeof o.time === 'string' ? Number(o.time) : NaN;
  if (!isFinite(time)) return null;
  const scramble = typeof o.scramble === 'string' ? o.scramble : '';
  const ts = toTs(o.ended_at) ?? toTs(o.created_at) ?? toTs(o.date) ?? toTs(o.started_at) ?? 0;
  // CubeDesk writes a DNF as time -1 with dnf: true; either alone is enough
  if (o.dnf === true || o.dnf === 1 || o.penalty === 'DNF' || time < 0) return { ms: 0, pen: 'DNF', scramble, ts };
  if (time <= 0) return null;
  const plus = o.plus_two === true || o.plusTwo === true || o.plus2 === true || o.penalty === '+2';
  return { ms: Math.round(time * 1000), pen: plus ? '+2' : '', scramble, ts };
}

// CubeDesk stores a +2 with the penalty already added to `time` (bulkPlusTwoSolves: time = raw_time + 2),
// and a DNF as time -1 with the real time left in raw_time.
function cubeDeskSolve(o: Obj): ImportedSolve | null {
  const time = typeof o.time === 'number' ? o.time : Number(o.time);
  const raw = typeof o.raw_time === 'number' ? o.raw_time : Number(o.raw_time);
  const ts = toTs(o.ended_at) ?? toTs(o.started_at) ?? 0;
  const scramble = typeof o.scramble === 'string' ? o.scramble : '';
  if (o.dnf === true || time < 0) {
    return { ms: isFinite(raw) && raw > 0 ? Math.round(raw * 1000) : 0, pen: 'DNF', scramble, ts };
  }
  if (!isFinite(time) || time <= 0) return null;
  if (o.plus_two === true) {
    const base = isFinite(raw) && raw > 0 ? raw : time - 2;
    return { ms: Math.round(base * 1000), pen: '+2', scramble, ts };
  }
  return { ms: Math.round(time * 1000), pen: '', scramble, ts };
}

// { "solves": [...], "sessions": [{ "id", "name", "order" }] } — CubeDesk's own export
// (types/solve.ts: time in seconds, a DNF stored as -1, trainer solves are not session solves).
function parseCubeDesk(root: Obj): ImportResult | null {
  const { solves, sessions } = root;
  if (!Array.isArray(solves) || !Array.isArray(sessions)) return null;
  const notes: string[] = [];
  const nameOf = new Map<string, string>();
  sessions.filter(isObj).forEach((s, i) => {
    const id = typeof s.id === 'string' ? s.id : '';
    if (id) nameOf.set(id, typeof s.name === 'string' && s.name.trim() ? s.name.trim() : `Session ${i + 1}`);
  });
  const buckets = new Map<string, ImportedSolve[]>();
  let other = 0, trainer = 0, junk = 0;
  for (const raw of solves) {
    if (!isObj(raw)) { junk++; continue; }
    if (typeof raw.trainer_name === 'string' && raw.trainer_name) { trainer++; continue; }
    const event = typeof raw.event_type === 'string' ? raw.event_type : typeof raw.cube_type === 'string' ? raw.cube_type : '';
    if (event && !['333', '333oh'].includes(event)) { other++; continue; }
    const id = typeof raw.session_id === 'string' ? raw.session_id : '';
    const s = id ? cubeDeskSolve(raw) : null;
    if (!id || !s) { junk++; continue; }
    buckets.set(id, [...(buckets.get(id) ?? []), s]);
  }
  const out: ImportedSession[] = [];
  for (const [id, list] of buckets) out.push({ name: nameOf.get(id) ?? `Session ${id.slice(0, 6)}`, solves: list });
  if (other) notes.push(`Skipped ${other} solve${other > 1 ? 's' : ''} for other puzzles. This app times 3x3 only.`);
  if (trainer) notes.push(`Skipped ${trainer} trainer solve${trainer > 1 ? 's' : ''}: only your history is imported.`);
  if (junk) notes.push(`Skipped ${junk} solve${junk > 1 ? 's' : ''} that had no session or an unreadable time.`);
  return { format: 'CubeDesk', sessions: out, notes };
}
function parseGenericJson(root: unknown): ImportResult {
  const found: { name: string; solves: ImportedSolve[] }[] = [];
  // a backup's solves live three or four levels down; anything deeper is not a solve history, and an
  // unbounded walk over a fuzzed file used to end in "Maximum call stack size exceeded"
  const MAX_DEPTH = 32;
  const walk = (v: unknown, name: string, depth = 0) => {
    if (depth > MAX_DEPTH) return;
    if (Array.isArray(v)) {
      const solves = v.filter(isObj).map(solveFromObj).filter((s): s is ImportedSolve => !!s);
      if (solves.length && solves.length >= v.length / 2) found.push({ name, solves });
      else v.forEach((x, i) => walk(x, isObj(x) && typeof x.name === 'string' ? x.name : `${name} ${i + 1}`, depth + 1));
    } else if (isObj(v)) {
      const nm = typeof v.name === 'string' && v.name ? v.name : name;
      for (const [k, x] of Object.entries(v)) if (typeof x === 'object' && x) walk(x, nm || k, depth + 1);
    }
  };
  walk(root, 'Imported');
  return { format: 'JSON backup', sessions: found, notes: found.length ? ['Format recognised by its structure (time in seconds). Check the preview before importing.'] : [] };
}

function splitCsv(text: string): string[][] {
  const first = text.split(/\r?\n/, 1)[0];
  const delim = [';', '\t', ','].reduce((b, d) => (first.split(d).length > first.split(b).length ? d : b), ',');
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}
function parseCsv(text: string): ImportResult | null {
  const rows = splitCsv(text);
  if (rows.length < 2) return null;
  const head = rows[0].map(h => h.trim().toLowerCase());
  const col = (...names: string[]) => head.findIndex(h => names.includes(h));
  const iTime = col('time', 'result', 'solve time', 'time (s)');
  if (iTime < 0) return null;
  const iScr = col('scramble'), iDate = col('date', 'timestamp', 'datetime', 'created_at');
  const iPen = col('penalty', 'result', 'status'), iSes = col('session', 'category', 'session name');
  const iPuz = col('puzzle', 'event');
  const sessions = new Map<string, ImportedSolve[]>();
  let skipped = 0, other = 0;
  rows.slice(1).forEach((r, k) => {
    if (iPuz >= 0 && r[iPuz] && !/^(3x3x3|333|3x3)$/i.test(r[iPuz].trim())) { other++; return; }
    let t = parseTimeText(r[iTime] ?? '');
    if (!t) {
      const n = Number(r[iTime]);
      if (isFinite(n) && n > 0) t = { ms: n >= 1000 && Number.isInteger(n) ? n : Math.round(n * 1000), pen: '' };
    }
    if (!t) { skipped++; return; }
    let pen: Penalty = t.pen;
    const p = iPen >= 0 && iPen !== iTime ? (r[iPen] ?? '').trim().toLowerCase() : '';
    if (p === '1' || p === '+2' || p === 'plus2') pen = '+2';
    else if (p === '2' || p === 'dnf') pen = 'DNF';
    const name = iSes >= 0 && r[iSes]?.trim() ? r[iSes].trim() : 'Imported';
    const list = sessions.get(name) ?? [];
    list.push({ ms: t.ms, pen, scramble: iScr >= 0 ? (r[iScr] ?? '') : '', ts: (iDate >= 0 ? toTs(r[iDate]) : null) ?? k });
    sessions.set(name, list);
  });
  const notes: string[] = [];
  if (skipped) notes.push(`${skipped} row${skipped > 1 ? 's' : ''} without a readable time were skipped.`);
  if (other) notes.push(`${other} row${other > 1 ? 's' : ''} for other puzzles were skipped.`);
  return { format: 'CSV', sessions: [...sessions].map(([name, solves]) => ({ name, solves })), notes };
}

function parseList(text: string): ImportResult {
  const solves: ImportedSolve[] = [];
  let skipped = 0;
  text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach((l, i) => {
    const t = parseTimeText(l.split(/[\s,;]+/)[0]);
    if (t) solves.push({ ms: t.ms, pen: t.pen, scramble: '', ts: i });
    else skipped++;
  });
  return { format: 'List of times', sessions: solves.length ? [{ name: 'Imported', solves }] : [], notes: skipped ? [`${skipped} line${skipped > 1 ? 's' : ''} could not be read.`] : [] };
}

export function parseImport(text: string): ImportResult {
  const t = text.trim().replace(/^\uFEFF/, '');
  if (!t) return { format: 'unknown', sessions: [], notes: ['The file is empty.'] };
  if (t.startsWith('{') || t.startsWith('[')) {
    let root: unknown;
    try { root = JSON.parse(t); } catch { return { format: 'unknown', sessions: [], notes: ['That is not valid JSON.'] }; }
    try {
      if (isObj(root) && Object.keys(root).some(k => /^session\d+$/.test(k))) return parseCsTimer(root);
      if (isObj(root)) {
        const desk = parseCubeDesk(root);
        if (desk) return desk;
      }
      const g = parseGenericJson(root);
      return g.sessions.length ? g : { format: 'unknown', sessions: [], notes: ['No solves found in this JSON file.'] };
    } catch {
      // a shape this parser did not expect is a bad file, not a crash
      return { format: 'unknown', sessions: [], notes: ['No solves found in this JSON file.'] };
    }
  }
  const csv = parseCsv(t);
  if (csv && csv.sessions.length) return csv;
  return parseList(t);
}

/** Fill in timestamps for solves that had none, so order is kept. They are anchored to the start of
 *  the day rather than to the clock, so importing the same date-less file twice produces the same
 *  timestamps and the duplicate check can actually see them. */
export function withTimestamps(s: ImportedSession, now = Date.now()): ImportedSolve[] {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const base = dayStart.getTime();
  let i = 0;
  return s.solves.map(x => (x.ts >= 1e11 ? x : { ...x, ts: base + i++ }));
}
