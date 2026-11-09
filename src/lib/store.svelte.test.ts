import { describe, it, expect, beforeAll } from 'vitest';
import { SETS } from './data';
import { effective } from './core/stats';

// minimal DOM stub: the store only touches documentElement for theme and text size
(globalThis as any).document = { documentElement: { dataset: {}, style: {} } };

let store: typeof import('./store.svelte').store;
beforeAll(async () => { store = (await import('./store.svelte')).store; });

describe('store: sessions and solves', () => {
  it('keeps solves per session and updates stats scope', () => {
    store.addSolve(9000, 'R U');
    store.addSolve(8000, 'F B');
    expect(store.solves.length).toBe(2);
    const first = store.session.id;
    store.addSession('Practice');
    expect(store.session.name).toBe('Practice');
    expect(store.solves.length).toBe(0);
    store.addSolve(7000, 'L D');
    expect(store.solves.length).toBe(1);
    store.switchSession(first);
    expect(store.solves.length).toBe(2);
    expect(store.countIn(first)).toBe(2);
  });
  it('penalty and delete act on the current session only', () => {
    store.setPenalty('+2');
    expect(store.solves.at(-1)!.pen).toBe('+2');
    store.deleteLast();
    expect(store.solves.length).toBe(1);
    const other = store.data.sessions.find(s => s.id !== store.session.id)!;
    expect(store.countIn(other.id)).toBe(1);
  });
  it('rename and delete a session', () => {
    const other = store.data.sessions.find(s => s.id !== store.session.id)!;
    store.renameSession(other.id, 'Renamed');
    expect(store.data.sessions.find(s => s.id === other.id)!.name).toBe('Renamed');
    store.deleteSession(other.id);
    expect(store.data.sessions.length).toBe(1);
    expect(store.data.solves.every(s => s.session === store.session.id)).toBe(true);
  });
  it('deleting the last session only empties it', () => {
    store.deleteSession(store.session.id);
    expect(store.data.sessions.length).toBe(1);
    expect(store.solves.length).toBe(0);
  });
});

describe('store: algorithms and ZBLL import', () => {
  it('accepts a different valid alg for a case and rejects wrong ones', () => {
    const bundled = store.bundledAlgs('PLL-T').length;   // the shipped default plus its alternatives
    expect(store.addAlg('PLL-T', "R U R' U' R' F R2 U' R' U' R U R' F' U")).toBeNull(); // extra final AUF still solves it
    expect(store.addAlg('PLL-T', "R U R' U'")).toContain('does not solve');
    expect(store.addAlg('PLL-T', 'R Q')).toContain('Unknown move');
    expect(store.algsFor('PLL-T').length).toBe(bundled + 1);
    const mine = store.algsFor('PLL-T').at(-1)!;
    store.setDefault('PLL-T', mine);
    expect(store.algFor('PLL-T')).toBe(mine);
    store.removeAlg('PLL-T', mine);
    expect(store.algsFor('PLL-T').length).toBe(bundled);
  });
  it('F2L allows an alg with a leading AUF', () => {
    const base = store.caseOf('F2L-3').alg;
    expect(store.addAlg('F2L-3', `U ${base}`)).toBeNull();
  });
  it('adds an imported algorithm to the bundled case it solves', () => {
    const base = store.caseOf('ZBLL-T-1').alg;
    const mine = `${base} U`;   // one extra AUF still solves the case
    const r = store.importZbll(`T 1: ${mine}`);
    expect(r.attached).toBe(1);
    expect(r.added).toBe(0);
    expect(store.algsFor('ZBLL-T-1')).toContain(mine);
    expect(store.isBundled('ZBLL-T-1', mine)).toBe(false);
    store.clearZbll();
    expect(store.algsFor('ZBLL-T-1')).not.toContain(mine);
  });
  it('keeps a case the app does not ship as the user\'s own', () => {
    const perm = "R U R' U' R' F R2 U' R' U' R U R' F'";   // the T perm is PLL, so no bundled ZBLL case holds it
    const r = store.importZbll(perm);
    expect(r.added).toBe(1);
    expect(store.casesFor('ZBLL').at(-1)!.alg).toBe(perm);
    expect(store.casesFor('ZBLL').length).toBe(SETS.ZBLL.length + 1);
    store.clearZbll();
    expect(store.casesFor('ZBLL').length).toBe(SETS.ZBLL.length);
  });
  it('reports the lines it cannot use', () => {
    const r = store.importZbll(`R U R' U'\nbad line Q`);
    expect(r.added + r.attached).toBe(0);
    expect(r.errors.length).toBe(2);
  });
});

describe('store: shortcuts, panels and imports', () => {
  it('rebinds keys and refuses conflicts', () => {
    expect(store.key('plus2')).toBe('KeyZ');
    expect(store.setKey('plus2', 'KeyD')).toContain('Already used');
    expect(store.setKey('plus2', 'KeyY')).toBeNull();
    expect(store.key('plus2')).toBe('KeyY');
    expect(store.is({ code: 'KeyY' }, 'plus2')).toBe(true);
    store.resetKeys();
    expect(store.key('plus2')).toBe('KeyZ');
  });
  it('resetting a case forgets its progress but keeps its algorithms', () => {
    store.resetCard('PLL-T');
    // a real custom alg, and the return value is checked: the old version of this test added an alg
    // that addAlg rejected and never looked, so it passed whether the algs survived or not
    const bundled = store.bundledAlgs('PLL-T').length;
    expect(store.addAlg('PLL-T', "R U R' U' R' F R2 U' R' U' R U R' F' U")).toBeNull();
    const algs = store.algsFor('PLL-T');
    expect(algs.length).toBe(bundled + 1);
    const mine = algs.at(-1)!;
    store.setDefault('PLL-T', mine);
    store.grade('PLL-T', 2, 2000, 600);
    expect(store.card('PLL-T').attempts.length).toBe(1);
    store.resetCard('PLL-T');
    expect(store.card('PLL-T').attempts.length).toBe(0);
    expect(store.card('PLL-T').seen).toBe(false);
    expect(store.algsFor('PLL-T')).toEqual(algs);
    expect(store.algFor('PLL-T')).toBe(mine);   // the default the user picked survives too
  });
  it('a deleted solve can be put back where it was', () => {
    store.erase();
    store.addSolve(9000, 'R U', '');
    store.addSolve(8000, 'F B', '');
    const [first, second] = store.solves;
    store.deleteSolve(second.id);
    expect(store.solves.map(s => s.id)).toEqual([first.id]);
    store.restoreSolve(second, 1);
    expect(store.solves.map(s => s.id)).toEqual([first.id, second.id]);
    store.restoreSolve(second, 1);            // restoring twice does nothing
    expect(store.solves.length).toBe(2);
  });
  it('hides and shows panels', () => {
    expect(store.shown('solve.stats')).toBe(true);
    store.setShown('solve.stats', false);
    expect(store.shown('solve.stats')).toBe(false);
    store.setShown('solve.stats', true);
    expect(store.shown('solve.stats')).toBe(true);
  });
  it('imports sessions once and skips duplicates on a second import', () => {
    const sessions = [{ name: 'Main', solves: [{ ms: 9000, pen: '' as const, scramble: 'R U', ts: 1700000000000 }, { ms: 8000, pen: '+2' as const, scramble: 'F B', ts: 1700000100000 }] }];
    const before = store.data.sessions.length;
    const a = store.importSolves(sessions, 'csTimer');
    expect(a).toEqual({ added: 2, duplicates: 0, sessions: 1 });
    expect(store.data.sessions.length).toBe(before + 1);
    expect(store.data.sessions.at(-1)!.name).toBe('Main (csTimer)');
    const b = store.importSolves(sessions, 'csTimer');
    expect(b).toEqual({ added: 0, duplicates: 2, sessions: 0 });
    expect(store.data.sessions.length).toBe(before + 1);
  });
});

describe('store: backups that can be undone', () => {
  it('a restore replaces the data and can be put back', () => {
    store.erase();
    store.addSolve(9000, 'R U');
    expect(store.solves.length).toBe(1);
    store.importJson(JSON.stringify({ solves: [{ id: 'x', ms: 5000, pen: '', scramble: 'F B', event: '333', ts: 1 }], cards: {} }));
    expect(store.solves.map(s => s.ms)).toEqual([5000]);
    expect(store.canUndoRestore).toBe(true);
    expect(store.undoRestore()).toBe(true);
    expect(store.solves.map(s => s.ms)).toEqual([9000]);
    expect(store.canUndoRestore).toBe(false);
  });
  it('a file that is not a backup leaves the data alone', () => {
    const before = store.solves.length;
    expect(() => store.importJson('not a backup')).toThrow();
    expect(() => store.importJson(JSON.stringify({ hello: 'world' }))).toThrow();
    expect(store.solves.length).toBe(before);
    expect(store.canUndoRestore).toBe(false);
  });
  it('deleting a session and its solves can be undone', () => {
    store.erase();
    store.addSolve(9000, 'R U');
    store.addSession('Doomed');
    store.addSolve(8000, 'F B');
    const doomed = store.session.id;
    expect(store.solves.length).toBe(1);
    const armed = store.canUndoRestore;               // erase() above armed the backup undo
    store.deleteSession(doomed);
    expect(store.data.sessions.some(s => s.id === doomed)).toBe(false);
    expect(store.undoKind).toBe('erase');             // the delete did not take the slot over
    expect(store.canUndoRestore).toBe(armed);
    expect(store.undoDeleteSession()).toBe(true);
    expect(store.data.sessions.some(s => s.id === doomed)).toBe(true);
    expect(store.data.solves.some(s => s.session === doomed)).toBe(true);
    expect(store.undoKind).toBe('erase');             // and the erase is still undoable afterwards
  });
  it('erasing everything can be undone', () => {
    store.erase();
    store.addSolve(9000, 'R U');
    const before = store.solves.map(s => s.id);
    store.erase();
    expect(store.solves.length).toBe(0);
    expect(store.canUndoRestore).toBe(true);
    expect(store.undoRestore()).toBe(true);
    expect(store.solves.map(s => s.id)).toEqual(before);
  });
  it('importing the same date-less list twice adds nothing the second time', () => {
    store.erase();
    const list = [{ name: 'List', solves: [{ ms: 9000, pen: '' as const, scramble: '', ts: 0 }, { ms: 8000, pen: '' as const, scramble: '', ts: 1 }] }];
    expect(store.importSolves(list, 'List')).toEqual({ added: 2, duplicates: 0, sessions: 1 });
    expect(store.importSolves(list, 'List')).toEqual({ added: 0, duplicates: 2, sessions: 0 });
  });
  it('undo puts a deleted solve back where it was in a second session too', () => {
    store.erase();
    store.addSolve(9000, 'R U');
    store.addSession('Second');
    store.addSolve(8000, 'F B');
    store.addSolve(7000, 'L D');
    const [older, newer] = store.solves;
    const index = store.data.solves.findIndex(s => s.id === older.id);
    store.deleteSolve(older.id);
    expect(store.solves.map(s => s.id)).toEqual([newer.id]);
    store.restoreSolve(older, index);
    expect(store.solves.map(s => s.id)).toEqual([older.id, newer.id]);
  });
});

describe('store: personalised scheduling', () => {
  it('declines politely with too little history and leaves the settings alone', async () => {
    store.erase();
    const r = await store.optimizeFsrs();
    expect(r.applied).toBe(false);
    expect(r.reason).toContain('Not enough');
    expect(store.data.settings.fsrsW).toBeUndefined();
    expect(store.fsrsPoints).toBe(0);
  });
  it('uses stored parameters when grading, and resetting removes them', () => {
    const w = [0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.3];
    store.data.settings.fsrsW = w;
    store.grade('PLL-T', 2, 3000, 1000);
    expect(store.card('PLL-T').seen).toBe(true);
    store.resetFsrs();
    expect(store.data.settings.fsrsW).toBeUndefined();
  });
});

describe('store: bundled F2L algorithms', () => {
  it('lists the whole bundled set for a case, default first', () => {
    const list = store.algsFor('F2L-1');
    expect(list[0]).toBe("U R U' R'");
    expect(list.length).toBeGreaterThan(1);
    expect(list.every(a => store.isBundled('F2L-1', a))).toBe(true);
  });
  it('refuses to remove a bundled algorithm, and lets the user delete their own', () => {
    store.removeAlg('F2L-1', "R' F R F'");
    expect(store.algsFor('F2L-1')).toContain("R' F R F'");
    const mine = 'R U2 R2 F R F';
    expect(store.addAlg('F2L-1', mine)).toBe('That algorithm does not solve this case.');
    const ok = "U2 R' F R F' U2";   // the bundled alt with a U2 on each end: still the same solution
    expect(store.addAlg('F2L-1', ok)).toBeNull();
    expect(store.algsFor('F2L-1')).toContain(ok);
    store.removeAlg('F2L-1', ok);
    expect(store.algsFor('F2L-1')).not.toContain(ok);
  });
  it('keeps a bundled alternative as the default without dropping it on reset', () => {
    const alt = store.algsFor('F2L-2')[1];
    store.setDefault('F2L-2', alt);
    expect(store.algFor('F2L-2')).toBe(alt);
    store.resetCard('F2L-2');
    expect(store.algFor('F2L-2')).toBe(alt);
    store.setDefault('F2L-2', store.algsFor('F2L-2')[0]);
    expect(store.algFor('F2L-2')).toBe(store.algsFor('F2L-2')[0]);
  });
});

describe('store: the weekly safety copy', () => {
  it('is due only when there is something to lose and a week has passed', () => {
    store.update({ autoBackup: true, lastBackupAt: 0 });
    // nothing to lose yet: the first-run app must not litter the downloads folder
    const before = store.solves.length;
    expect(store.needsAutoBackup()).toBe(before > 0);
    store.addSolve(12000, 'R U');
    expect(store.needsAutoBackup()).toBe(true);
    store.update({ lastBackupAt: Date.now() });
    expect(store.needsAutoBackup()).toBe(false);
    store.update({ autoBackup: false });
    store.update({ lastBackupAt: 0 });
    expect(store.needsAutoBackup()).toBe(false);
  });
});

describe('undo and penalties across a second session', () => {
  it('puts a deleted solve back at its GLOBAL position, not its index inside the session', () => {
    const a = store.data.session;
    store.addSession('Undo A');
    const A = store.session.id;
    store.addSolve(1000, 'R U');            // global 0
    store.addSession('Undo B');
    store.addSolve(2000, 'F B');            // global 1
    store.switchSession(A);
    store.addSolve(3000, 'L D');            // global 2 — session index 1, which is the trap
    const target = store.solves.at(-1)!;
    const globalIndex = store.data.solves.findIndex(s => s.id === target.id);
    expect(globalIndex).toBeGreaterThan(store.solves.findIndex(s => s.id === target.id));

    store.deleteSolve(target.id);
    store.restoreSolve(target, globalIndex);

    // a session-relative index would have spliced it in before B's solve
    expect(store.data.solves.slice(-3).map(s => s.ms)).toEqual([1000, 2000, 3000]);
    expect(store.solves.map(s => s.ms)).toEqual([1000, 3000]);

    store.switchSession(a);
  });

  it('refuses to restore a solve that is already in the list', () => {
    store.addSession('Undo C');
    store.addSolve(4000, 'R U');
    const s = store.solves.at(-1)!;
    const n = store.data.solves.length;
    store.restoreSolve(s, 0);
    expect(store.data.solves.length).toBe(n);
  });

  it('a drill penalty reaches the number the screen shows, and only its own mode', () => {
    store.addDrill({ type: 'cross', ms: 5000, memo: null, ok: true });
    store.addDrill({ type: 'pll2', ms: 7000, memo: null, ok: true });
    const shown = (type: 'cross' | 'pll2') => {
      const d = store.data.drills.filter(x => x.type === type).at(-1)!;
      return effective({ ms: d.ms, pen: d.pen ?? '' });      // what Drills.svelte's exec() does
    };

    store.penDrill('cross', '+2');
    expect(shown('cross')).toBe(5000 + 2000);
    expect(store.data.drills.filter(d => d.type === 'pll2').at(-1)!.pen).toBeUndefined();

    store.penDrill('cross', 'DNF');
    expect(shown('cross')).toBe(Infinity);                   // a DNF is not "best"

    store.penDrill('cross', '');
    expect(shown('cross')).toBe(5000);
  });

  // deleting a session is undoable on its own: it must not overwrite the snapshot a restore or a wipe
  // is holding, or "Undo restore" quietly starts bringing back the wrong data
  it('a session delete leaves the backup undo alone, and can be undone by itself', () => {
    store.erase();
    store.undoRestore();                       // nothing armed now
    expect(store.canUndoRestore).toBe(false);

    store.addSession('Temporary');
    const id = store.data.sessions.find(s => s.name === 'Temporary')!.id;
    store.addSolve(4321, 'R U');
    store.deleteSession(id);

    expect(store.canUndoRestore).toBe(false);  // the delete did not arm the restore button
    expect(store.undoDeleteSession()).toBe(true);
    expect(store.data.sessions.some(s => s.id === id)).toBe(true);   // the session and its solve are back
    expect(store.data.solves.some(s => s.session === id)).toBe(true);
    expect(store.undoDeleteSession()).toBe(false);                   // one undo per delete
  });

  it('names the action the undo slot holds, so the button can say which one it undoes', () => {
    store.erase();
    expect(store.canUndoRestore).toBe(true);
    expect(store.undoKind).toBe('erase');
    store.undoRestore();
    expect(store.undoKind).toBe(null);
    store.importJson(JSON.stringify({ solves: [], cards: {} }));
    expect(store.undoKind).toBe('restore');
  });

  // a due count read from Date.now() inside a $derived never changes while the app sits open; every
  // screen reads store.now instead, which the store refreshes once a minute
  it('a case that comes due shows up when the clock moves', () => {
    store.erase();
    store.undoRestore();
    const id = SETS.PLL[0].id;
    store.data.cards[id] = { seen: true, due: store.now + 30_000, attempts: [] };
    const dueNow = () => Object.values(store.data.cards).filter(c => c.seen && c.due <= store.now).length;
    expect(dueNow()).toBe(0);
    store.now = store.now + 31_000;
    expect(dueNow()).toBe(1);
  });
});

// the per-session lists are cached: every change to the solve list has to invalidate them
describe('store: the per-session solve index stays current', () => {
  it('reflects adds, deletes, undo, imports and a deleted session', () => {
    store.addSession('Index A');
    expect(store.solves.length).toBe(0);           // builds the index
    store.addSolve(5000, 'R U');
    expect(store.solves.length).toBe(1);           // add
    const kept = store.solves[0];
    store.deleteSolve(kept.id);
    expect(store.solves.length).toBe(0);           // delete
    store.restoreSolve(kept, 0);
    expect(store.solves.length).toBe(1);           // undo
    expect(store.solves[0].id).toBe(kept.id);
    const mine = store.session.id;
    const before = store.data.solves.length;
    store.importSolves([{ name: 'Imported', solves: [{ ms: 6000, pen: '', scramble: '', ts: 1700000000000 }] }], 'test');
    expect(store.data.solves.length).toBe(before + 1);   // the import landed in its own session…
    expect(store.solves.length).toBe(1);                 // …so this one is unchanged
    store.deleteSession(mine);
    expect(store.countIn(mine)).toBe(0);                 // and a deleted session's list is gone
  });
});
