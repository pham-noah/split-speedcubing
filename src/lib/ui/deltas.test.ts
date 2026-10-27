// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { mount, unmount } from 'svelte';
import Deltas from './Deltas.svelte';

/** render the panel with a known history and hand back its text */
function render(times: number[]): string {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const app = mount(Deltas, { target: host, props: { times } });
  const text = host.textContent ?? '';
  unmount(app);
  host.remove();
  return text.replace(/\s+/g, ' ');
}

describe('deltas panel', () => {
  it('shows the WCA ao5, the same number the ao5 card shows', () => {
    // 10.00 12.00 11.00 9.00 20.00 -> drop 9.00 and 20.00, mean of the rest = 11.00
    const text = render([10000, 12000, 11000, 9000, 20000]);
    expect(text).toContain('11.00');
    expect(text).not.toContain('12.40');   // the plain mean of all five, which is what it used to show
  });

  it('keeps a DNF as a row instead of dropping it', () => {
    const text = render([11000, 10000, 12000, 9000, Infinity]);
    expect(text).toContain('DNF');
    // one DNF is dropped as the worst, so the average is still a time
    expect(text).toContain('11.00');
  });

  it('two DNFs in the window make the average a DNF', () => {
    const text = render([10000, Infinity, 11000, Infinity, 12000]);
    expect((text.match(/DNF/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});
