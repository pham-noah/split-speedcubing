import { describe, it, expect, beforeAll } from 'vitest';

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
    expect(store.addAlg('PLL-T', "R U R' U' R' F R2 U' R' U' R U R' F' U")).toBeNull(); // extra final AUF still solves it
    expect(store.addAlg('PLL-T', "R U R' U'")).toContain('does not solve');
    expect(store.addAlg('PLL-T', 'R Q')).toContain('Unknown move');
    expect(store.algsFor('PLL-T').length).toBe(2);
    store.setDefault('PLL-T', store.algsFor('PLL-T')[1]);
    expect(store.algFor('PLL-T')).toContain('U');
    store.removeAlg('PLL-T', store.algsFor('PLL-T')[1]);
    expect(store.algsFor('PLL-T').length).toBe(1);
  });
  it('F2L allows an alg with a leading AUF', () => {
    const base = store.caseOf('F2L-3').alg;
    expect(store.addAlg('F2L-3', `U ${base}`)).toBeNull();
  });
  it('imports valid ZBLL lines and reports bad ones', () => {
    const r = store.importZbll(`# comment
Sune: R U R' U R U2 R'
R U R' U'
bad line Q
Sune: R U R' U R U2 R'`);
    expect(r.added).toBe(1);
    expect(r.errors.length).toBe(3);
    expect(store.casesFor('ZBLL').length).toBe(1);
    expect(store.casesFor('ZBLL')[0].name).toBe('Sune');
    expect(store.caseOf(store.casesFor('ZBLL')[0].id).alg).toBe("R U R' U R U2 R'");
    store.clearZbll();
    expect(store.casesFor('ZBLL').length).toBe(0);
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
    expect(store.addAlg('PLL-T', "R U R' U' R' F R2 U' R' U' R U R' F' U")).toBeNull();
    const algs = store.algsFor('PLL-T');
    expect(algs.length).toBe(2);
    store.setDefault('PLL-T', algs[1]);
    store.grade('PLL-T', 2, 2000, 600);
    expect(store.card('PLL-T').attempts.length).toBe(1);
    store.resetCard('PLL-T');
    expect(store.card('PLL-T').attempts.length).toBe(0);
    expect(store.card('PLL-T').seen).toBe(false);
    expect(store.algsFor('PLL-T')).toEqual(algs);
    expect(store.algFor('PLL-T')).toBe(algs[1]);   // the default the user picked survives too
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
    store.deleteSession(doomed);
    expect(store.data.sessions.some(s => s.id === doomed)).toBe(false);
    expect(store.canUndoRestore).toBe(true);
    expect(store.undoRestore()).toBe(true);
    expect(store.data.sessions.some(s => s.id === doomed)).toBe(true);
    expect(store.data.solves.some(s => s.session === doomed)).toBe(true);
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
