// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { markShell, pickFileViaInput, saveFileViaAnchor } from './dom';
import { platform as web } from './web';
import { platform as android } from './android';
import { platform as desktop } from './desktop';

describe('platform adapters', () => {
  it('reports one kind each', () => {
    expect([web.kind, android.kind, desktop.kind]).toEqual(['web', 'android', 'desktop']);
  });

  it('only android claims a back button', () => {
    expect(android.caps.backButton).toBe(true);
    expect(web.caps.backButton).toBe(false);
    expect(desktop.caps.backButton).toBe(false);
  });

  it('only desktop can check for updates: Android asks for no INTERNET permission, so a fetch there cannot succeed', () => {
    expect(desktop.caps.updateCheck).toBe(true);
    expect(android.caps.updateCheck).toBe(false);
    expect(web.caps.updateCheck).toBe(false);
  });

  it('every shell can save a file', () => {
    for (const p of [web, android, desktop]) expect(p.caps.saveFile).toBe(true);
  });
});

describe('markShell', () => {
  it('exposes the shell to the stylesheet', () => {
    markShell('android');
    expect(document.documentElement.dataset.platform).toBe('android');
    markShell('desktop');
    expect(document.documentElement.dataset.platform).toBe('desktop');
  });
});

describe('saveFileViaAnchor', () => {
  it('downloads under the given name', async () => {
    const create = vi.fn(() => 'blob:split');
    const revoke = vi.fn();
    const created = vi.spyOn(URL, 'createObjectURL').mockImplementation(create);
    const revoked = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revoke);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await saveFileViaAnchor('split-2026-10-30.json', '{"v":1}');

    expect(create).toHaveBeenCalledOnce();
    const a = click.mock.instances[0] as HTMLAnchorElement;
    expect(a.download).toBe('split-2026-10-30.json');
    expect(a.href).toContain('blob:split');
    click.mockRestore();
    created.mockRestore();
    revoked.mockRestore();
  });
});

describe('pickFileViaInput', () => {
  it('resolves null when the picker is cancelled', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      this.dispatchEvent(new Event('cancel'));
    });
    await expect(pickFileViaInput('application/json')).resolves.toBeNull();
    click.mockRestore();
  });

  it('every shell can open an external link its own way', () => {
    expect([web.caps.openLinks, android.caps.openLinks, desktop.caps.openLinks]).toEqual([true, true, true]);
  });
});

