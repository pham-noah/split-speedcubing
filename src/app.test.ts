// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { mount, tick, flushSync } from 'svelte';
// loaded on first use: importing it up front doubles this file's startup on a slow drive

const wait = (ms = 20) => new Promise(r => setTimeout(r, ms));
const q = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);
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
    expect((q('nav')!.parentElement as any).inert).toBe(true);   // background is inert while the intro is open (jsdom exposes it as a property)
    await audit('intro');
    byText('Next')!.click(); await tick();
    expect(q('[role=dialog]')!.textContent).toContain('Time solves');
    byText('Next')!.click(); await tick();
    byText('Get started')!.click(); await tick(); await wait();
    expect(q('[role=dialog]')).toBeNull();
    expect((q('nav')!.parentElement as any).inert).toBe(false);
  });

  it('Solve screen: empty state, timer button, no accessibility violations', async () => {
    expect(document.body.textContent).toContain('Ready for your first solve');
    expect(q('.big')).toBeTruthy();
    expect(q('nav [aria-current=page]')!.textContent).toBe('Solve');
    await audit('solve');
  });

  it('every tab opens without errors and passes the accessibility audit', async () => {
    for (const [tab, marker] of [['Train', 'Today'], ['Library', 'Library'], ['Drills', 'Drills'], ['Settings', 'Settings']] as const) {
      byText(tab, q('nav')!)!.click(); await tick();
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
    byText('Library', q('nav')!)!.click(); await tick();
    for (let i = 0; i < 40 && !q('.grid .cell'); i++) { await wait(25); flushSync(); }
    (q('.grid .cell') as HTMLElement).click(); await tick(); await wait();
    expect(document.body.textContent).toContain('Algorithms');
    await audit('library detail');
    press('Escape'); await tick(); await wait();
    expect(document.body.textContent).not.toContain('Add your own algorithm');
    expect(q('nav [aria-current=page]')!.textContent).toBe('Library');
  });

  it('Train: Today lists progress for every case set', async () => {
    byText('Train', q('nav')!)!.click(); await tick();
    for (let i = 0; i < 40 && !byText('Start session'); i++) { await wait(25); flushSync(); }
    const text = document.body.textContent!;
    for (const set of ['PLL', 'OLL', 'F2L']) expect(text).toContain(set);
    expect(text).toContain('mastered');
    expect(text).toContain('new');
  });

  it('Train: Start session shows a scramble; Back returns to Today', async () => {
    byText('Train', q('nav')!)!.click(); await tick();
    for (let i = 0; i < 40 && !byText('Start session'); i++) { await wait(25); flushSync(); }
    byText('Start session')!.click(); await tick(); await wait(30); flushSync();
    expect(q('.scr')!.textContent!.trim().length).toBeGreaterThan(3);
    expect(document.body.textContent).toContain('Press once when you recognise');
    // one full attempt: hold to start, press to mark recognition, press to stop
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })); await wait(350); flushSync();
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true })); await tick(); await wait(80);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })); await tick(); await wait(30); flushSync();
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true })); await tick(); await wait(30);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })); await tick(); await wait(40); flushSync();
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true })); await tick(); await wait(60); flushSync();
    // the case you just trained is revealed by name, next to its diagram
    expect(document.body.textContent).toContain('You just did');
    await audit('train session');
    press('Escape'); await tick(); await wait();
    expect(document.querySelector('h1')!.textContent).toContain('Today');
  });

  it('Library: the grid renders a screenful first and fills in the rest', async () => {
    byText('Library', q('nav')!)!.click(); await tick();
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
    byText('Settings', q('nav')!)!.click(); await tick();
    for (let i = 0; i < 40 && !document.querySelector('input[type=checkbox]'); i++) { await wait(25); flushSync(); }
    const box = [...document.querySelectorAll<HTMLInputElement>('input[type=checkbox]')].find(c => c.closest('label')?.textContent?.includes('Solve: best, ao5'))!;
    box.click(); await tick(); await wait();
    byText('Solve', q('nav')!)!.click(); await tick(); await wait();
    expect(document.body.textContent).not.toContain('Best');   // the best/ao5/ao12 panel is gone (the recent-solves table has its own ao12)
    byText('Settings', q('nav')!)!.click(); await tick();
    for (let i = 0; i < 40 && !document.querySelector('input[type=checkbox]'); i++) { await wait(25); flushSync(); }
    // the key list is collapsed until asked for
    [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent!.trim().startsWith('Show all'))!.click();
    await tick(); await wait(30); flushSync();
    const row = [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.getAttribute('aria-label')?.startsWith('+2 on the last solve'))!;
    row.click(); await tick();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyY', bubbles: true })); await tick(); await wait();
    expect(row.textContent!.trim()).toBe('Y');
  });

  it('theme and text size apply to the document', async () => {
    byText('AMOLED')!.click(); await tick();
    expect(document.documentElement.dataset.theme).toBe('amoled');
    byText('Extra large')!.click(); await tick();
    expect(document.documentElement.style.fontSize).toBe('130%');
  });

  it('timer: hold, release and tap records a solve', async () => {
    byText('Solve', q('nav')!)!.click(); await tick();
    for (let i = 0; i < 40 && !q('.big'); i++) { await wait(25); flushSync(); }
    const before = document.body.textContent;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })); await wait(350); flushSync();
    expect(q('.big')!.textContent).toContain('Release');
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true })); await tick(); await wait(80);
    expect(q('.big')!.textContent).toContain('Tap to stop');
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })); await tick(); await wait(30); flushSync();
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true }));
    expect(document.body.textContent).toContain('History · 1');
    expect(before).not.toContain('History · 1');
  });
});
