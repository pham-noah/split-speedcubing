// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { mount, unmount, tick } from 'svelte';
import ImportPanel from './ImportPanel.svelte';

describe('import panel', () => {
  it('refuses a file too large to parse on the main thread', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const app = mount(ImportPanel, { target: host });
    const ta = host.querySelector('textarea')!;
    ta.value = '9.84\n'.repeat(1_500_000);            // ~6 MB of times
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    expect(host.textContent).toContain('too large');
    expect(host.textContent).not.toContain('solves in');   // it never parsed it
    unmount(app);
    host.remove();
    // 6 MB through jsdom's event path is slow on a loaded machine; the work is real, the default 5 s is not
  }, 60_000);
});
