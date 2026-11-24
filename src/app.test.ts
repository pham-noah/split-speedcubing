// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { mount, tick, flushSync } from 'svelte';
// loaded on first use: importing it up front doubles this file's startup on a slow drive

// The whole app, mounted, plus an axe audit per screen: slower than vitest's 5 s default when the other
// 25 files are running beside it.
vi.setConfig({ testTimeout: 20_000 });

const wait = (ms = 20) => new Promise(r => setTimeout(r, ms));
const q = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);
// the app's tab bar, not just "the first nav on the page": a view can now carry its own nav (Settings has a
// section jump bar), and a bare 'nav' selector silently started pointing at that one
const NAV = 'nav[aria-label="Main"]';
const byText = (text: string, scope: ParentNode = document) =>
  [...scope.querySelectorAll<HTMLElement>('button, a, label')].find(b => b.textContent?.trim().startsWith(text));
const press = (code: string, init: KeyboardEventInit = {}) => { window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, ...init })); window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true, ...init })); };

async function audit(name: string) {
  const axe = (await import('axe-core')).default;
  const r = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } }); // jsdom cannot compute colours; contrast is checked separately
  const bad = r.violations.map(v => `${v.id}: ${v.help} -> ${v.nodes.slice(0, 2).map(n => n.html.slice(0, 90)).join(' | ')}`);
  expect(bad, `${name}\n${bad.join('\n')}`).toEqual([]);
}

beforeAll(async () => {
  (globalThis as any).matchMedia ??= () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  const App = (await import('./App.svelte')).default;
  mount(App, { target: document.body });
  // the screens load on demand, so wait for the first one to be there instead of a fixed delay
  for (let i = 0; i < 60; i++) {
    await wait(25); flushSync();
    if (document.querySelector('.big')) break;
  }
});

describe('whole app in a simulated browser', () => {
  it('shows the first-launch intro as an accessible dialog, and it can be completed', async () => {
    const dlg = q('[role=dialog]')!;
    expect(dlg).toBeTruthy();
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    expect(dlg.textContent).toContain('Welcome to Split');
    expect((q(NAV)!.parentElement as any).inert).toBe(true);   // background is inert while the intro is open (jsdom exposes it as a property)
    await audit('intro');
    // Back is on every slide (disabled on the first), so the footer never re-flows and Next never moves
    expect((byText('Back') as HTMLButtonElement).disabled).toBe(true);
    byText('Next')!.click(); await tick();
    expect(q('[role=dialog]')!.textContent).toContain('Time solves');
    byText('Next')!.click(); await tick();
    expect(q('[role=dialog]')!.textContent).toContain('Split a solve into phases');
    byText('Next')!.click(); await tick();
    expect(q('[role=dialog]')!.textContent).toContain('Make it yours');
    expect((byText('Back') as HTMLButtonElement).disabled).toBe(false);
    // ArrowLeft is Back (C19), and Back itself walks the slides without leaving the dialog
    press('ArrowLeft'); await tick();
    expect(q('[role=dialog]')!.textContent).toContain('Split a solve into phases');
    byText('Back')!.click(); await tick();
    expect(q('[role=dialog]')!.textContent).toContain('Time solves');
    byText('Next')!.click(); await tick();
    byText('Next')!.click(); await tick();
    expect(q('[role=dialog]')!.textContent).toContain('Make it yours');
    await audit('intro last slide');
    byText('Get started')!.click(); await tick(); await wait();
    expect(q('[role=dialog]')).toBeNull();
    expect((q(NAV)!.parentElement as any).inert).toBe(false);
  });

  it('Solve screen: empty state, timer button, no accessibility violations', async () => {
    expect(document.body.textContent).toContain('Ready for your first solve');
    expect(q('.big')).toBeTruthy();
    expect(q('nav [aria-current=page]')!.textContent).toBe('Solve');
    await audit('solve');
  });

  it('every tab opens without errors and passes the accessibility audit', async () => {
    for (const [tab, marker] of [['Train', 'Today'], ['Library', 'Library'], ['Drills', 'Drills'], ['Settings', 'Settings']] as const) {
      byText(tab, q(NAV)!)!.click(); await tick();
      for (let i = 0; i < 160; i++) {
        await wait(25); flushSync();
        if (document.querySelector('h1')?.textContent?.includes(marker)) break;
      }
      expect(document.querySelector('h1')!.textContent, tab).toContain(marker);
      expect(q('nav [aria-current=page]')!.textContent).toBe(tab);
      await audit(tab);
    }
  });

  it('keyboard shortcuts navigate between tabs', async () => {
    press('Digit3'); await tick(); await wait();
    expect(q('nav [aria-current=page]')!.textContent).toBe('Solve');
    press('Digit2'); await tick(); await wait();
    expect(q('nav [aria-current=page]')!.textContent).toBe('Library');
  });

  it('Back (Escape) returns to the previous tab', async () => {
    press('Digit1'); await tick(); await wait();
    press('Escape'); await tick(); await wait();
    expect(q('nav [aria-current=page]')!.textContent).toBe('Library');
  });

  it('Library: a case opens, shows algorithms, and Back closes it before leaving', async () => {
    byText('Library', q(NAV)!)!.click(); await tick();
    for (let i = 0; i < 40 && !q('.grid .cell'); i++) { await wait(25); flushSync(); }
    (q('.grid .cell') as HTMLElement).click(); await tick(); await wait();
    expect(document.body.textContent).toContain('Algorithms');
    await audit('library detail');
    press('Escape'); await tick(); await wait();
    expect(document.body.textContent).not.toContain('Add your own algorithm');
    expect(q('nav [aria-current=page]')!.textContent).toBe('Library');
  });

  it('Train: Today lists progress for every case set', async () => {
    byText('Train', q(NAV)!)!.click(); await tick();
    for (let i = 0; i < 40 && !byText('Start session'); i++) { await wait(25); flushSync(); }
    const text = document.body.textContent!;
    for (const set of ['PLL', 'OLL', 'F2L']) expect(text).toContain(set);
    // each set's row carries its counts; a set nobody has started reads "<n> new", with the zero parts left
    // out — the row is one line in a narrow column and "0 mastered · 0 learning" is noise
    expect(text).toMatch(/\d+ new/);
    expect(text).not.toContain('0 mastered');
  });

  it('Train: the hero CTA shows a scramble; Back returns to Today', async () => {
    byText('Train', q(NAV)!)!.click(); await tick();
    for (let i = 0; i < 40 && !q('.big-cta'); i++) { await wait(25); flushSync(); }
    // the label follows the state ("Learn 21 new" / "Start review"): the class is the stable handle
    q('.big-cta')!.click(); await tick(); await wait(30); flushSync();
    expect(q('.scr')!.textContent!.trim().length).toBeGreaterThan(3);
    expect(document.body.textContent).toContain('Press once when you recognise');
    // one full attempt: hold to start, press to mark recognition, press to stop
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })); await wait(350); flushSync();
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true })); await tick(); await wait(400);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })); await tick(); await wait(30); flushSync();
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true })); await tick(); await wait(400);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })); await tick(); await wait(40); flushSync();
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true })); await tick(); await wait(60); flushSync();
    // the case you just trained is revealed by name, next to its diagram
    expect(document.body.textContent).toContain('You just did');
    // counters keep their separator spaced: a bare "·" on the line after {#if} renders as "new· 1 done"
    expect(document.body.textContent).toContain(' new · 1 done');
    expect(document.body.textContent).toMatch(/ · best \d/);
    await audit('train session');
    press('Escape'); await tick(); await wait();
    expect(document.querySelector('h1')!.textContent).toContain('Today');
  });

  it('Library: the grid renders a screenful first and fills in the rest', async () => {
    byText('Library', q(NAV)!)!.click(); await tick();
    for (let i = 0; i < 40 && !document.querySelector('.grid .cell'); i++) { await wait(25); flushSync(); }
    const f2l = [...document.querySelectorAll<HTMLButtonElement>('.seg button')].find(b => b.textContent?.trim() === 'F2L')!;
    f2l.click(); await tick();
    const first = document.querySelectorAll('.grid .cell').length;
    expect(first).toBeLessThanOrEqual(12);
    for (let i = 0; i < 60 && document.querySelectorAll('.grid .cell').length <= first; i++) { await wait(60); flushSync(); }
    const later = document.querySelectorAll('.grid .cell').length;
    expect(later).toBeGreaterThan(first);      // the rest arrive without a click
  });

  it('Settings: panels can be hidden and shortcut capture works', async () => {
    byText('Settings', q(NAV)!)!.click(); await tick();
    for (let i = 0; i < 40 && !document.querySelector('input[type=checkbox]'); i++) { await wait(25); flushSync(); }
    const box = [...document.querySelectorAll<HTMLInputElement>('input[type=checkbox]')].find(c => c.closest('label')?.textContent?.includes('Solve: best, ao5'))!;
    box.click(); await tick(); await wait();
    byText('Solve', q(NAV)!)!.click(); await tick(); await wait();
    expect(document.body.textContent).not.toContain('Best');   // the best/ao5/ao12 panel is gone (the recent-solves table has its own ao12)
    byText('Settings', q(NAV)!)!.click(); await tick();
    for (let i = 0; i < 40 && !document.querySelector('input[type=checkbox]'); i++) { await wait(25); flushSync(); }
    // the key list is collapsed until asked for
    [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent!.trim().startsWith('Show all'))!.click();
    await tick(); await wait(30); flushSync();
    const row = [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.getAttribute('aria-label')?.startsWith('+2 on the last solve'))!;
    row.click(); await tick();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyY', bubbles: true })); await tick(); await wait();
    expect(row.textContent!.trim()).toBe('Y');
  });

  // a chip that scrolls with behavior:'smooth' does nothing at all in this app: .card is
  // content-visibility:auto, so the animation targets an estimated offset and is cancelled when the real
  // layout lands. Instant scrolling is the only one that works, and the chip has to say it is current.
  it('Settings: a section chip jumps to its heading and marks itself', async () => {
    byText('Settings', q(NAV)!)!.click(); await tick();
    for (let i = 0; i < 40 && !document.querySelector('.secnav-row button'); i++) { await wait(25); flushSync(); }
    const proto = Element.prototype as unknown as { scrollIntoView: (o?: unknown) => void };
    const orig = proto.scrollIntoView;
    const calls: [string, unknown][] = [];
    proto.scrollIntoView = function (this: Element, o?: unknown) { calls.push([this.id, o]); };
    try {
      const chip = document.querySelector<HTMLButtonElement>('.secnav-row button[data-id="bk-h"]')!;
      chip.click(); await tick();
      // the jump is settled twice after the click (rAF + 90ms), so wait out both before restoring the stub
      await new Promise((r) => setTimeout(r, 180));
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0][0]).toBe('bk-h');
      for (const [id, opts] of calls) {
        expect(id).toBe('bk-h');
        expect(opts).toEqual({ block: 'start' });   // no behaviour key: 'smooth' never moves this page
      }
      expect(chip.getAttribute('aria-current')).toBe('true');
      expect(chip.className).toContain('on');
    } finally {
      proto.scrollIntoView = orig;
    }
  });

  it('Library: a filter that keeps nothing says so and offers a way back', async () => {
    byText('Library', q(NAV)!)!.click(); await tick();
    for (let i = 0; i < 40 && !document.querySelector('.grid .cell'); i++) { await wait(25); flushSync(); }
    const due = [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent!.trim() === 'Due')!;
    due.click(); await tick(); await wait(40); flushSync();
    expect(document.querySelectorAll('.grid .cell').length).toBe(0);
    expect(document.body.textContent).toMatch(/Nothing is due/);
    const back = [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent!.trim() === 'Show every case')!;
    expect(back).toBeTruthy();
    back.click(); await tick(); await wait(40); flushSync();
    expect(document.querySelectorAll('.grid .cell').length).toBeGreaterThan(0);
    // a counter that names only what is there: "0 mastered" was printed next to 21 new cases
    expect(document.body.textContent).not.toMatch(/0 mastered|0 learning/);
  });

  it('theme and text size apply to the document', async () => {
    byText('Settings', q(NAV)!)!.click(); await tick(); await wait(25); flushSync();
    byText('AMOLED')!.click(); await tick();
    expect(document.documentElement.dataset.theme).toBe('amoled');
    byText('Extra large')!.click(); await tick();
    expect(document.documentElement.style.fontSize).toBe('130%');
  });

  it('timer: hold, release and tap records a solve', async () => {
    byText('Solve', q(NAV)!)!.click(); await tick();
    for (let i = 0; i < 40 && !q('.big'); i++) { await wait(25); flushSync(); }
    const before = document.body.textContent;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })); await wait(350); flushSync();
    expect(q('.big')!.textContent).toContain('Release');
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true })); await tick(); await wait(400);
    expect(q('.big')!.textContent).toContain('Tap to stop');
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })); await tick(); await wait(30); flushSync();
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true }));
    expect(document.body.textContent).toContain('History · 1');
    expect(before).not.toContain('History · 1');
  });

  // a fumbled double-tap must not save a 0.05 s solve
  it('a press under 300 ms is thrown away instead of recorded', async () => {
    const history = () => document.body.textContent!.match(/History · (\d+)/)![1];
    const before = history();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })); await wait(350); flushSync();
    // start and stop in the same turn, so the gap is microseconds whatever the machine is doing
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
    await tick(); await wait(60); flushSync();
    expect(history()).toBe(before);                        // nothing saved
    expect(q('.time')!.textContent).toContain('Too short'); // and the screen says why
  });

  // the stop press must not click the control underneath it
  it('the press that stops the clock does not also press what is behind it', async () => {
    const history = () => document.body.textContent!.match(/History · (\d+)/)![1];
    const before = Number(history());
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })); await wait(350); flushSync();
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true })); await tick(); await wait(400);
    const chip = q('.chip')!;
    chip.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    await tick(); await wait(20); flushSync();
    chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick(); await wait(60); flushSync();
    expect(Number(history())).toBe(before + 1);              // the solve was recorded…
    expect(document.querySelector('[role=radiogroup]')).toBeNull();   // …and Sessions did not open
  });
});
