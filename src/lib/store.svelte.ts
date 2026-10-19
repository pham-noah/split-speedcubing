import { SETS, BUILTIN_CASES, type CaseDef, type CaseSet } from './data';
import { createStorage, type Storage } from './storage';
import { defaultData, normalize, type AppData, type CardRecord, type DrillResult, type Session } from './storage/model';
import { newCard, review, type Grade } from './core/srs';
import { validateAlg, solvesCase, isZbllCase } from './core/alg';
import type { Penalty, Solve } from './core/stats';
import { keyFor, matches, conflictFor, canBind, type KeyLike } from './core/shortcuts';
import { withTimestamps, type ImportedSession } from './core/importers';
import { collectLogs, countPoints, optimizeParameters, MIN_POINTS, type OptResult } from './core/fsrs-optimize';

const uid = () => crypto.randomUUID?.() ?? String(Date.now() + Math.random());

class Store {
  data = $state<AppData>(defaultData());
  ready = $state(false);
  focusId = $state<string | null>(null); // case the user asked to train next
  focusAlg = $state<string | null>(null);
  cubeHidden = $state(false);   // the scramble cube panel, toggled with one key from anywhere // when set, train that case with exactly this algorithm (execution only)
  private storage: Storage = createStorage();
  private timer: ReturnType<typeof setTimeout> | undefined;

  async init() {
    try {
      const d = await this.storage.load();
      if (d) this.data = normalize(d);
    } catch { /* start empty */ }
    this.apply();
    this.ready = true;
  }

  /** push theme and text size into the document */
  apply() {
    const s = this.data.settings;
    document.documentElement.dataset.theme = s.theme;
    document.documentElement.style.fontSize = `${s.textSize}%`;
    // accent colour: '' keeps the theme's own amber
    if (s.accent) {
      const c = [1, 3, 5].map(i => parseInt(s.accent.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      const light = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] > 0.55;
      document.documentElement.style.setProperty('--am', s.accent);
      document.documentElement.style.setProperty('--on-am', light ? '#12161C' : '#FFFFFF');
    } else {
      try {
        document.documentElement.style.removeProperty('--am');
        document.documentElement.style.removeProperty('--on-am');
      } catch { /* jsdom has no removeProperty on the inline style */ }
    }
  }
  persist() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.storage.save($state.snapshot(this.data) as AppData).catch(() => {});
    }, 250);
  }

  // ---- sessions ----
  get session(): Session { return this.data.sessions.find(s => s.id === this.data.session) ?? this.data.sessions[0]; }
  /** solves of the current session, oldest first */
  get solves(): Solve[] { const id = this.session.id; return this.data.solves.filter(s => (s.session ?? this.data.sessions[0].id) === id); }
  countIn(id: string) { return this.data.solves.filter(s => s.session === id).length; }
  switchSession(id: string) { if (this.data.sessions.some(s => s.id === id)) { this.data.session = id; this.persist(); } }
  addSession(name: string) {
    const s = { id: uid(), name: name.trim() || `Session ${this.data.sessions.length + 1}` };
    this.data.sessions.push(s); this.data.session = s.id; this.persist();
  }
  renameSession(id: string, name: string) {
    const s = this.data.sessions.find(x => x.id === id);
    if (s && name.trim()) { s.name = name.trim(); this.persist(); }
  }
  /** deletes the session and its solves; the last remaining session is emptied instead of removed */
  deleteSession(id: string) {
    this.data.solves = this.data.solves.filter(s => s.session !== id);
    if (this.data.sessions.length > 1) {
      this.data.sessions = this.data.sessions.filter(s => s.id !== id);
      if (this.data.session === id) this.data.session = this.data.sessions[0].id;
    }
    this.persist();
  }

  // ---- solves ----
  addSolve(ms: number, scramble: string, pen: Penalty = '') {
    this.data.solves.push({ id: uid(), ms, pen, scramble, event: '333', ts: Date.now(), session: this.session.id });
    this.persist();
  }
  setPenalty(p: Penalty) {
    const s = this.solves.at(-1);
    if (!s) return;
    const live = this.data.solves.find(x => x.id === s.id)!;
    live.pen = live.pen === p ? '' : p;
    this.persist();
  }
  deleteLast() {
    const s = this.solves.at(-1);
    if (s) this.deleteSolve(s.id);
  }
  deleteSolve(id: string) { this.data.solves = this.data.solves.filter(s => s.id !== id); this.persist(); }
  /** put a deleted solve back where it was (undo) */
  restoreSolve(solve: Solve, index: number) {
    if (this.data.solves.some(s => s.id === solve.id)) return;
    this.data.solves.splice(Math.min(index, this.data.solves.length), 0, solve);
    this.persist();
  }
  cyclePenalty(id: string) {
    const s = this.data.solves.find(x => x.id === id);
    if (!s) return;
    s.pen = s.pen === '' ? '+2' : s.pen === '+2' ? 'DNF' : '';
    this.persist();
  }

  // ---- drills ----
  addDrill(d: Omit<DrillResult, 'ts'>) { this.data.drills.push({ ...d, ts: Date.now() }); this.data.drills = this.data.drills.slice(-500); this.persist(); }

  // ---- cases ----
  /** all cases of a set; ZBLL comes from the user's import */
  casesFor(set: CaseSet): CaseDef[] {
    return set === 'ZBLL' ? this.data.zbll.map(c => ({ id: c.id, set: 'ZBLL' as const, name: c.name, alg: c.alg })) : SETS[set];
  }
  caseOf(id: string): CaseDef {
    return BUILTIN_CASES.find(c => c.id === id) ?? this.casesFor('ZBLL').find(c => c.id === id)!;
  }
  card(id: string): CardRecord { return this.data.cards[id] ?? { ...newCard(), attempts: [] }; }
  /** built-in alg first, then the user's own */
  algsFor(id: string): string[] {
    const builtin = this.caseOf(id).alg;
    return [builtin, ...(this.data.cards[id]?.algs ?? []).filter(a => a !== builtin)];
  }
  algFor(id: string): string {
    const list = this.algsFor(id), d = this.data.cards[id]?.defaultAlg;
    return d && list.includes(d) ? d : list[0];
  }
  private ensure(id: string): CardRecord {
    return (this.data.cards[id] ??= { ...newCard(), attempts: [] });
  }
  setDefault(id: string, alg: string) {
    this.ensure(id).defaultAlg = alg === this.caseOf(id).alg ? undefined : alg;
    this.persist();
  }
  /** returns an error message, or null when added */
  addAlg(id: string, alg: string): string | null {
    const a = alg.trim().replace(/\s+/g, ' ');
    const err = validateAlg(a);
    if (err) return err;
    if (this.algsFor(id).includes(a)) return 'That algorithm is already in the list.';
    const c0 = this.caseOf(id);
    // F2L algs may need an AUF in front, last-layer algs a U turn at the end
    if (!solvesCase(c0.alg, a, c0.set === 'F2L')) return 'That algorithm does not solve this case.';
    const c = this.ensure(id);
    c.algs = [...(c.algs ?? []), a];
    this.persist();
    return null;
  }
  removeAlg(id: string, alg: string) {
    const c = this.ensure(id);
    c.algs = (c.algs ?? []).filter(a => a !== alg);
    if (c.defaultAlg === alg) c.defaultAlg = undefined;
    this.persist();
  }
  grade(id: string, g: Grade, total: number, recog: number | null, alg?: string) {
    const c = this.ensure(id);
    Object.assign(c, review(c, g, Date.now(), this.data.settings.retention, this.data.settings.fsrsW));
    c.attempts = [...c.attempts, { ts: Date.now(), total, recog, grade: g, alg: alg ?? this.algFor(id) }].slice(-60);
    this.persist();
  }
  /** forget everything learned about one case (keeps its algorithms) */
  resetCard(id: string) { delete this.data.cards[id]; this.persist(); }
  /** the last attempt of a case: penalty, or drop it */
  penAttempt(id: string, pen: '+2' | 'DNF' | '') {
    const card = this.data.cards[id];
    const last = card?.attempts.at(-1);
    if (!last) return;
    if (!pen) delete last.pen; else last.pen = pen;
    this.persist();
  }
  deleteLastAttempt(id: string) {
    const card = this.data.cards[id];
    if (!card?.attempts.length) return;
    card.attempts = card.attempts.slice(0, -1);
    this.persist();
  }
  /** the last drill result of a mode */
  penDrill(type: DrillResult['type'], pen: '+2' | 'DNF' | '') {
    const last = [...this.data.drills].reverse().find(d => d.type === type);
    if (!last) return;
    if (!pen) delete last.pen; else last.pen = pen;
    this.persist();
  }
  deleteLastDrill(type: DrillResult['type']) {
    const i = this.data.drills.map(d => d.type).lastIndexOf(type);
    if (i < 0) return;
    this.data.drills.splice(i, 1);
    this.persist();
  }
  /** ask the timer to load a scramble (used by "retry this scramble" in History) */
  retry: string | null = null;
  retryScramble(scramble: string) { this.retry = scramble; }
  cardsFor(set: CaseSet) {
    return Object.fromEntries(this.casesFor(set).map(c => [c.id, this.card(c.id)]));
  }

  // ---- ZBLL import: one "name: alg" or bare "alg" per line ----
  importZbll(text: string): { added: number; errors: string[] } {
    const errors: string[] = [];
    let added = 0;
    const have = new Set(this.data.zbll.map(c => c.alg));
    text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#')).forEach((line, i) => {
      const m = /^([^:]{1,40}):\s*(.+)$/.exec(line);
      const name = m ? m[1].trim() : `ZBLL ${this.data.zbll.length + added + 1}`;
      const alg = (m ? m[2] : line).trim().replace(/\s+/g, ' ');
      const err = validateAlg(alg) ?? (isZbllCase(alg) ? null : 'does not start from a last layer with oriented edges and solved F2L');
      if (err) errors.push(`Line ${i + 1}: ${err}`);
      else if (have.has(alg)) errors.push(`Line ${i + 1}: duplicate`);
      else { this.data.zbll.push({ id: `ZBLL-${uid()}`, name, alg }); have.add(alg); added++; }
    });
    this.persist();
    return { added, errors };
  }
  clearZbll() { this.data.zbll = []; this.persist(); }

  // ---- personalised scheduling ----
  /** how many of the user's reviews the optimiser can learn from */
  get fsrsPoints() { return countPoints(collectLogs(this.data.cards)); }
  readonly fsrsMinPoints = MIN_POINTS;
  async optimizeFsrs(onProgress?: (f: number) => void): Promise<OptResult> {
    const r = await optimizeParameters(collectLogs($state.snapshot(this.data.cards) as AppData['cards']), undefined, { onProgress, yieldToUi: true });
    if (r.applied) { this.data.settings.fsrsW = r.w; this.persist(); }
    return r;
  }
  resetFsrs() { delete this.data.settings.fsrsW; this.persist(); }

  // ---- shortcuts and panels ----
  key(id: string) { return keyFor(id, this.data.settings.keys); }
  is(e: KeyLike, id: string) { return matches(e, id, this.data.settings.keys); }
  /** null when bound, otherwise a message */
  setKey(id: string, code: string): string | null {
    if (!canBind(code)) return 'That key cannot be used.';
    const c = conflictFor(id, code, this.data.settings.keys);
    if (c) return `Already used for “${c.label}”.`;
    this.data.settings.keys = { ...this.data.settings.keys, [id]: code };
    this.persist();
    return null;
  }
  resetKeys() { this.data.settings.keys = {}; this.persist(); }
  shown(panel: string) { return !this.data.settings.hidden[panel]; }
  setShown(panel: string, on: boolean) { this.data.settings.hidden = { ...this.data.settings.hidden, [panel]: !on }; this.persist(); }

  // ---- importing solves from other timers ----
  /** each imported session becomes a new session; solves already present (same time, scramble and date) are skipped */
  importSolves(sessions: ImportedSession[], label: string): { added: number; duplicates: number; sessions: number } {
    const seen = new Set(this.data.solves.map(s => `${s.ts}|${s.ms}|${s.scramble}`));
    let added = 0, duplicates = 0, made = 0;
    for (const sess of sessions) {
      const id = uid();
      const rows = withTimestamps(sess).flatMap(x => {
        const k = `${x.ts}|${x.ms}|${x.scramble}`;
        if (seen.has(k)) { duplicates++; return []; }
        seen.add(k);
        return [{ id: uid(), ms: x.ms, pen: x.pen, scramble: x.scramble, event: '333', ts: x.ts, session: id }];
      });
      if (!rows.length) continue;
      this.data.sessions.push({ id, name: `${sess.name} (${label})` });
      this.data.solves.push(...rows);
      added += rows.length; made++;
    }
    this.persist();
    return { added, duplicates, sessions: made };
  }

  // ---- settings and backups ----
  update(patch: Partial<AppData['settings']>) { Object.assign(this.data.settings, patch); this.apply(); this.persist(); }
  exportJson() { return JSON.stringify($state.snapshot(this.data), null, 1); }
  importJson(text: string) { this.data = normalize(JSON.parse(text)); this.apply(); this.persist(); }
  erase() { this.data = defaultData(); this.apply(); this.persist(); }
}
export const store = new Store();
