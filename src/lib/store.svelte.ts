import { SETS, BUILTIN_CASES, F2L_DATA_REV, type CaseDef, type CaseSet } from './data';
import { readableInk } from './ui/color';
import { createStorage, type Storage } from './storage';
import { defaultData, normalize, type AppData, type CardRecord, type DrillResult, type Session } from './storage/model';
import { newCard, review, type Grade } from './core/srs';
import { validateAlg, solvesCase, isZbllCase } from './core/alg';
import type { Penalty, Solve } from './core/stats';
import { keyFor, matches, conflictFor, canBind, type KeyLike } from './core/shortcuts';
import { withTimestamps, type ImportedSession } from './core/importers';
import { collectLogs, countPoints, MIN_POINTS, type OptResult } from './core/fsrs-optimize';
import { optimizeOffThread } from './core/optimize-offthread';
import { durability, type Durability } from './storage/durability';

const uid = () => crypto.randomUUID?.() ?? String(Date.now() + Math.random());

/** A plain copy, always. `$state.snapshot` returns its argument as-is when it is not a proxy (which is
 *  what it does under a test runner), and a cache holding the live object would compare equal to every
 *  later change — the comparison that decides what to write would never fire. */
const copy = <T>(v: T): T => {
  const snap = $state.snapshot(v) as T;
  return snap === v ? (structuredClone(v) as T) : snap;
};

/** Is a card unchanged since the copy that was last written? Cheap enough to run over 472 cards on
 *  every save, and it catches a change the app forgot to mark: the fields a mutation can move. */
const sameCard = (a: CardRecord, b: CardRecord) =>
  a.seen === b.seen && a.due === b.due && a.defaultAlg === b.defaultAlg &&
  (a.algs?.length ?? 0) === (b.algs?.length ?? 0) && a.attempts.length === b.attempts.length &&
  (b.attempts.length === 0 ||
    (a.attempts.at(-1)!.ts === b.attempts.at(-1)!.ts && a.attempts.at(-1)!.pen === b.attempts.at(-1)!.pen));

class Store {
  data = $state<AppData>(defaultData());
  ready = $state(false);
  /** true while a timer is holding or running: the shell must not navigate away from a live solve */
  timerRunning = $state(false);
  /** a write to storage failed: the screens show it rather than losing data quietly */
  saveError = $state<string | null>(null);
  /** the saved data could not be read; the app runs on empty data until the user tries again */
  loadError = $state<string | null>(null);
  /** whether the browser will keep this origin's data, and how much is used */
  durable = $state<Durability>({ persisted: null, usage: null, quota: null });
  /** Now, refreshed once a minute. Every "is it due yet" read goes through this: a count taken from
   *  Date.now() inside a $derived only changes when something else writes, so a case that came due
   *  while the app sat open would stay hidden until the next solve. */
  now = $state(Date.now());
  focusId = $state<string | null>(null); // case the user asked to train next
  /** when set, train that case with exactly this algorithm (execution only) */
  focusAlg = $state<string | null>(null);
  cubeHidden = $state(false);   // the scramble cube panel, toggled with one key from anywhere
  private storage: Storage = createStorage();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private watching = false;
  private clock: ReturnType<typeof setInterval> | undefined;
  /** the data a backup restore replaced, kept until the next restore so the last one can be undone */
  private replaced = $state<AppData | null>(null);
  /** which of the two undoable actions `replaced` came from, so the button that undoes it says the truth */
  undoKind = $state<'restore' | 'erase' | null>(null);
  /** a deleted session and its solves, kept until the next delete so a mis-tap does not cost a history.
   *  Separate from `replaced` on purpose: deleting a session must not overwrite the backup it could undo. */
  private removed = $state<AppData | null>(null);
  /** ids of the cases changed since the last save: 472 cards with 60 attempts each is 2 MB, and a
   *  graded case used to rewrite all of it. Cleared only once the write succeeded. */
  private touched = new Set<string>();
  /** Bumped whenever the solve list changes shape. Every screen reads `store.solves`, and filtering the
   *  whole history on each read cost ~300 ms per screen switch at 50 000 solves; the lists are now built
   *  once per change and reused. */
  private solvesEpoch = $state(0);
  private solvesCache: { epoch: number; bySession: Map<string, Solve[]> } = { epoch: -1, bySession: new Map() };
  /** a restore or a wipe replaces every card, so the next save has to write them all */
  private writeAllCards = true;
  /** the plain copies handed to storage last time, so a save deep-copies only what changed. Cloning a
   *  50 000-solve history on every solve cost 138 ms of the write; the two fields that can change after
   *  a solve is made are compared instead, and a card is re-copied whenever the app marked it touched. */
  private plainSolves = new Map<string, Solve>();
  private plainCards = new Map<string, CardRecord>();

  async init() {
    try {
      const d = await this.storage.load();
      if (d) { this.data = normalize(d); this.writeAllCards = false; }   // what is on disk now matches
      this.loadError = null;
    } catch (e) {
      // keep running, but say so: silently showing an empty history looks exactly like lost data
      this.loadError = e instanceof Error ? e.message : 'Could not read the saved data';
    }
    this.migrateF2L();
    this.solvesChanged();
    this.apply();
    this.ready = true;
    this.watchUnload();
    this.startClock();
    // best effort until asked: on Android the origin can be evicted with the app still installed
    void durability().then((d) => (this.durable = d));
  }
  /** 0.5.0 renumbered F2L: case N is a different shape than it was, so progress logged against the old
   *  numbers would sit on the wrong case. Clear that progress once, and keep only the user's algorithms
   *  that still solve the case they now sit on. */
  private migrateF2L() {
    if ((this.data.f2lRev ?? 1) >= F2L_DATA_REV) return;
    for (const c of SETS.F2L) {
      const card = this.data.cards[c.id];
      if (!card) continue;
      const kept = (card.algs ?? []).filter(a => a !== c.alg && solvesCase(c.alg, a, true));
      const keepDefault = card.defaultAlg && (card.defaultAlg === c.alg || kept.includes(card.defaultAlg)) ? card.defaultAlg : undefined;
      const blank: CardRecord = { seen: false, due: 0, attempts: [] };
      if (kept.length) blank.algs = kept;
      if (keepDefault) blank.defaultAlg = keepDefault;
      this.data.cards[c.id] = blank;
    }
    this.data.f2lRev = F2L_DATA_REV;
    this.writeAllCards = true;
    this.persist();
  }
  private startClock() {
    if (this.clock || typeof window === 'undefined') return;
    this.clock = setInterval(() => (this.now = Date.now()), 60_000);
    // a test runner must not be held open by this timer
    (this.clock as unknown as { unref?: () => void }).unref?.();
  }
  /** write the pending change before the app is backgrounded or closed, instead of losing it */
  private watchUnload() {
    if (this.watching || typeof window === 'undefined') return;
    this.watching = true;
    const flush = () => { if (this.timer) void this.flush(); };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  }

  apply() {
    const s = this.data.settings;
    document.documentElement.dataset.theme = s.theme;
    document.documentElement.style.fontSize = `${s.textSize}%`;
    // accent colour: '' keeps the theme's own amber
    if (s.accent) {
      document.documentElement.style.setProperty('--am', s.accent);
      document.documentElement.style.setProperty('--on-am', readableInk(s.accent, '#12161C', '#FFFFFF'));
    } else {
      try {
        document.documentElement.style.removeProperty('--am');
        document.documentElement.style.removeProperty('--on-am');
      } catch { /* jsdom has no removeProperty on the inline style */ }
    }
  }
  persist() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.flush(); }, 250);
  }
  /** Everything to write, deep-copied only where it changed. `$state.snapshot(this.data)` was the whole
   *  history every time; the caches below turn that into one copy per solve that actually changed. */
  private forSave(): AppData {
    const d = this.data;
    const solves: Solve[] = [];
    for (const s of d.solves) {
      const kept = this.plainSolves.get(s.id);
      // a solve only ever changes its time or its penalty once it exists: two comparisons, no copy
      if (kept && kept.ms === s.ms && kept.pen === s.pen) { solves.push(kept); continue; }
      const plain = copy(s);
      this.plainSolves.set(s.id, plain);
      solves.push(plain);
    }
    if (this.plainSolves.size !== solves.length) {
      const live = new Set(d.solves.map(s => s.id));
      for (const id of this.plainSolves.keys()) if (!live.has(id)) this.plainSolves.delete(id);
    }
    const cards: Record<string, CardRecord> = {};
    for (const id in d.cards) {
      const card = d.cards[id];
      const kept = this.plainCards.get(id);
      if (kept && !this.touched.has(id) && sameCard(kept, card)) { cards[id] = kept; continue; }
      const plain = copy(card);
      this.plainCards.set(id, plain);
      cards[id] = plain;
      // a card whose copy had to be refreshed is a card that changed: say so, so storage writes it even
      // if the mutation never went through a method that marks one
      this.touched.add(id);
    }
    if (this.plainCards.size !== Object.keys(cards).length) {
      for (const id of this.plainCards.keys()) if (!(id in cards)) this.plainCards.delete(id);
    }
    return {
      v: d.v,
      solves,
      cards,
      settings: $state.snapshot(d.settings) as AppData['settings'],
      sessions: $state.snapshot(d.sessions) as AppData['sessions'],
      session: d.session,
      zbll: $state.snapshot(d.zbll) as AppData['zbll'],
      drills: $state.snapshot(d.drills) as AppData['drills'],
      ...(d.f2lRev != null ? { f2lRev: d.f2lRev } : {}),
    };
  }
  /** Write now: the debounce is short, but a phone can kill the app inside it. */
  async flush() {
    clearTimeout(this.timer);
    this.timer = undefined;
    try {
      const all = this.writeAllCards ? undefined : this.touched;
      await this.storage.save(this.forSave(), all);
      this.touched.clear();
      this.writeAllCards = false;
      this.saveError = null;
    } catch (e) {
      this.saveError = e instanceof Error ? e.message : 'Could not save to this device';
    }
  }

  get session(): Session { return this.data.sessions.find(s => s.id === this.data.session) ?? this.data.sessions[0]; }
  /** solves of the current session, oldest first */
  get solves(): Solve[] { return this.solvesBySession().get(this.session.id) ?? []; }
  /** every session's solves, built once per change to the solve list */
  private solvesBySession(): Map<string, Solve[]> {
    const epoch = this.solvesEpoch;   // a reactive read: a change to the list re-runs the screens
    if (this.solvesCache.epoch === epoch) return this.solvesCache.bySession;
    const bySession = new Map<string, Solve[]>();
    const fallback = this.data.sessions[0]?.id ?? 'default';
    for (const s of this.data.solves) {
      const id = s.session ?? fallback;
      const list = bySession.get(id);
      if (list) list.push(s); else bySession.set(id, [s]);
    }
    this.solvesCache = { epoch, bySession };
    return bySession;
  }
  /** the list changed shape: the next read rebuilds it */
  private solvesChanged() { this.solvesEpoch++; }
  countIn(id: string) { return this.solvesBySession().get(id)?.length ?? 0; }
  switchSession(id: string) { if (this.data.sessions.some(s => s.id === id)) { this.data.session = id; this.persist(); } }
  addSession(name: string) {
    const s = { id: uid(), name: name.trim() || `Session ${this.data.sessions.length + 1}` };
    this.data.sessions.push(s); this.data.session = s.id; this.persist();
  }
  renameSession(id: string, name: string) {
    const s = this.data.sessions.find(x => x.id === id);
    if (s && name.trim()) { s.name = name.trim(); this.persist(); }
  }
  /** deletes the session and its solves; the last remaining session is emptied instead of removed.
   *  Undoable through `undoDeleteSession`: a session's history is not something to lose by mis-tap. */
  deleteSession(id: string) {
    this.removed = $state.snapshot(this.data) as AppData;
    this.data.solves = this.data.solves.filter(s => s.session !== id);
    if (this.data.sessions.length > 1) {
      this.data.sessions = this.data.sessions.filter(s => s.id !== id);
      if (this.data.session === id) this.data.session = this.data.sessions[0].id;
    }
    this.solvesChanged();
    this.persist();
  }
  /** put back the session the last delete removed */
  undoDeleteSession(): boolean {
    if (!this.removed) return false;
    this.data = this.removed;
    this.plainSolves.clear();
    this.plainCards.clear();
    this.writeAllCards = true;
    this.removed = null;
    this.solvesChanged();
    this.apply();
    this.persist();
    return true;
  }

  addSolve(ms: number, scramble: string, pen: Penalty = '') {
    // a solve started before the first scramble arrived would otherwise be saved with the placeholder text
    const scr = scramble.startsWith('Generating') ? '' : scramble;
    this.data.solves.push({ id: uid(), ms, pen, scramble: scr, event: '333', ts: Date.now(), session: this.session.id });
    this.solvesChanged();
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
  deleteSolve(id: string) { this.data.solves = this.data.solves.filter(s => s.id !== id); this.solvesChanged(); this.persist(); }
  /** put a deleted solve back where it was (undo). `index` is a position in data.solves, not in the
   *  current session: the two differ as soon as there is more than one session. */
  restoreSolve(solve: Solve, index: number) {
    if (this.data.solves.some(s => s.id === solve.id)) return;
    this.data.solves.splice(Math.min(Math.max(0, index), this.data.solves.length), 0, solve);
    this.solvesChanged();
    this.persist();
  }
  cyclePenalty(id: string) {
    const s = this.data.solves.find(x => x.id === id);
    if (!s) return;
    s.pen = s.pen === '' ? '+2' : s.pen === '+2' ? 'DNF' : '';
    this.persist();
  }

  addDrill(d: Omit<DrillResult, 'ts'>) { this.data.drills.push({ ...d, ts: Date.now() }); this.data.drills = this.data.drills.slice(-500); this.persist(); }

  /** all cases of a set; ZBLL is the bundled 472 plus anything the user imported on top */
  casesFor(set: CaseSet): CaseDef[] {
    if (set !== 'ZBLL') return SETS[set];
    const own = this.data.zbll.map(c => ({ id: c.id, set: 'ZBLL' as const, name: c.name, alg: c.alg }));
    return [...SETS.ZBLL, ...own];
  }
  caseOf(id: string): CaseDef {
    const found = BUILTIN_CASES.find(c => c.id === id) ?? this.casesFor('ZBLL').find(c => c.id === id);
    if (!found) throw new Error(`Unknown case: ${id}`);
    return found;
  }
  card(id: string): CardRecord { return this.data.cards[id] ?? { ...newCard(), attempts: [] }; }
  /** every algorithm that ships with this case: the default first, then the bundled alternatives */
  bundledAlgs(id: string): string[] {
    const c = this.caseOf(id);
    return [c.alg, ...(c.alts ?? [])];
  }
  /** true when the algorithm ships with the app, so the UI must not offer to remove it */
  isBundled(id: string, alg: string): boolean { return this.bundledAlgs(id).includes(alg); }
  /** built-in algs first, then the user's own */
  algsFor(id: string): string[] {
    const builtin = this.bundledAlgs(id);
    return [...builtin, ...(this.data.cards[id]?.algs ?? []).filter(a => !builtin.includes(a))];
  }
  algFor(id: string): string {
    const list = this.algsFor(id), d = this.data.cards[id]?.defaultAlg;
    return d && list.includes(d) ? d : list[0];
  }
  private ensure(id: string): CardRecord {
    this.touched.add(id);
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
    if (this.isBundled(id, alg)) return;   // a shipped algorithm is not the user's to delete
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
  /** forget everything learned about one case, but keep the algorithms the user added and their
   *  default: this resets progress, it does not undo the Library work */
  resetCard(id: string) {
    const card = this.data.cards[id];
    if (!card) return;
    this.touched.add(id);
    this.data.cards[id] = {
      seen: false, due: 0, attempts: [],
      ...(card.algs?.length ? { algs: [...card.algs] } : {}),
      ...(card.defaultAlg ? { defaultAlg: card.defaultAlg } : {}),
    };
    this.persist();
  }
  /** the last attempt of a case: penalty, or drop it */
  penAttempt(id: string, pen: '+2' | 'DNF' | '') {
    const card = this.data.cards[id];
    const last = card?.attempts.at(-1);
    if (!last) return;
    this.touched.add(id);
    if (!pen) delete last.pen; else last.pen = pen;
    this.persist();
  }
  deleteLastAttempt(id: string) {
    const card = this.data.cards[id];
    if (!card?.attempts.length) return;
    this.touched.add(id);
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
  retry = $state<string | null>(null);
  retryScramble(scramble: string) { this.retry = scramble; }
  cardsFor(set: CaseSet) {
    return Object.fromEntries(this.casesFor(set).map(c => [c.id, this.card(c.id)]));
  }

  // ---- ZBLL import: one "name: alg" or bare "alg" per line ----
  /** a pasted name matches a bundled case: "U1", "U 1" and "ZBLL U 1" are the same case */
  private zbllNamed(text: string): CaseDef | undefined {
    const key = text.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^zbll/, '');
    if (!key) return undefined;
    return SETS.ZBLL.find(c => c.name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^zbll/, '') === key);
  }
  importZbll(text: string): { added: number; attached: number; errors: string[] } {
    const errors: string[] = [];
    let added = 0, attached = 0;
    const have = new Set(this.data.zbll.map(c => c.alg));
    // keep the file's own line numbers: a comment or blank line must not shift every "Line N"
    text.split(/\r?\n/)
      .map((line, n) => ({ line: line.trim(), n: n + 1 }))
      .filter(x => x.line && !x.line.startsWith('#'))
      .forEach(({ line, n }) => {
        const m = /^([^:]{1,40}):\s*(.+)$/.exec(line);
        const name = m ? m[1].trim() : '';
        const alg = (m ? m[2] : line).trim().replace(/\s+/g, ' ');
        const err = validateAlg(alg) ?? (isZbllCase(alg) ? null : 'does not start from a last layer with oriented edges and solved F2L');
        if (err) { errors.push(`Line ${n}: ${err}`); return; }
        // a named case first, then whichever bundled case this algorithm actually solves
        const target = this.zbllNamed(name) ?? SETS.ZBLL.find(c => solvesCase(c.alg, alg, false));
        if (target) {
          const bad = this.addAlg(target.id, alg);
          if (bad) errors.push(`Line ${n}: ${bad}`);
          else attached++;
          return;
        }
        if (have.has(alg)) { errors.push(`Line ${n}: duplicate`); return; }
        // length is read before the push and already counts what this loop added: incrementing twice
        // would name the cases 1, 3, 5 … in an imported file
        this.data.zbll.push({ id: `ZBLL-${uid()}`, name: name || `ZBLL ${this.data.zbll.length + 1}`, alg });
        have.add(alg);
        added++;
      });
    this.persist();
    return { added, attached, errors };
  }
  /** removes the user's own ZBLL material: imported cases, and the algorithms they added to bundled ones */
  clearZbll() {
    for (const c of SETS.ZBLL) {
      const card = this.data.cards[c.id];
      if (card) { card.algs = []; card.defaultAlg = undefined; this.touched.add(c.id); }
    }
    this.data.zbll = [];
    this.persist();
  }

  /** how many of the user's reviews the optimiser can learn from */
  get fsrsPoints() { return countPoints(collectLogs(this.data.cards)); }
  readonly fsrsMinPoints = MIN_POINTS;
  async optimizeFsrs(onProgress?: (f: number) => void): Promise<OptResult> {
    // off the UI thread: replaying thousands of reviews inline is seconds of stutter on a phone
    const r = await optimizeOffThread(collectLogs($state.snapshot(this.data.cards) as AppData['cards']), onProgress);
    if (r.applied) { this.data.settings.fsrsW = r.w; this.persist(); }
    return r;
  }
  resetFsrs() { delete this.data.settings.fsrsW; this.persist(); }

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
    this.solvesChanged();
    this.persist();
    return { added, duplicates, sessions: made };
  }

  update(patch: Partial<AppData['settings']>) { Object.assign(this.data.settings, patch); this.apply(); this.persist(); }
  exportJson() { return JSON.stringify($state.snapshot(this.data), null, 1); }
  /** A copy on disk is the only thing that survives eviction, so make one when the device will not
   *  promise to keep this origin's data. The caller writes the file; the store only says when. */
  needsAutoBackup() {
    if (!this.data.settings.autoBackup || !this.data.solves.length) return false;
    const last = this.data.settings.lastBackupAt ?? 0;
    return Date.now() - last > 7 * 864e5;
  }
  /** Replaces everything, but keeps what it replaced so the restore can be undone. Throws before
   *  touching the data when the file is not a backup. */
  importJson(text: string) {
    const next = normalize(JSON.parse(text));
    this.replaced = $state.snapshot(this.data) as AppData;
    this.undoKind = 'restore';
    this.data = next;
    this.writeAllCards = true;   // a different history entirely: every card on disk is stale
    this.plainSolves.clear();
    this.plainCards.clear();
    this.solvesChanged();
    this.apply();
    this.persist();
  }
  get canUndoRestore() { return this.replaced !== null; }
  /** put back the data the last restore replaced */
  undoRestore(): boolean {
    if (!this.replaced) return false;
    this.data = this.replaced;
    this.plainSolves.clear();       // a different object graph: every cached copy is stale
    this.plainCards.clear();
    this.writeAllCards = true;
    this.replaced = null;
    this.undoKind = null;
    this.solvesChanged();
    this.apply();
    this.persist();
    return true;
  }
  /** wipe everything, but keep the data it replaced: this is the one action that can throw away
   *  years of history, and it is undoable for exactly that reason */
  erase() {
    this.replaced = $state.snapshot(this.data) as AppData;
    this.undoKind = 'erase';
    this.data = defaultData();
    this.writeAllCards = true;
    this.plainSolves.clear();
    this.plainCards.clear();
    this.solvesChanged();
    this.apply();
    this.persist();
  }
}
export const store = new Store();
